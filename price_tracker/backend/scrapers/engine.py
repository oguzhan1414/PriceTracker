import asyncio
import json
import sys
import os
from datetime import datetime
from loguru import logger
from database.repository import ProductRepository, PriceHistoryRepository
from analysis.price_analyzer import PriceAnalyzer
from notifications.telegram import send_alert, format_alert
import traceback
SCRIPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "run_scraper.py")


def detect_site(url: str) -> str:
    url_lower = url.lower()
    if "trendyol.com" in url_lower:
        return "trendyol"
    elif "n11.com" in url_lower:
        return "n11"
    elif "vatanbilgisayar.com" in url_lower:
        return "vatan"
    elif "itopya.com" in url_lower:
        return "itopya"
    elif "incehesap.com" in url_lower:
        return "incehesap"
    elif "amazon." in url_lower:
        return "amazon"
    elif "newegg." in url_lower:
        return "newegg"
    elif "banggood." in url_lower:
        return "banggood"
    elif "etsy." in url_lower:
        return "etsy"
    elif "ebay." in url_lower:
        return "ebay"
    elif "aliexpress." in url_lower:
        return "aliexpress"
    return "unknown"


async def run_scraper_process(site: str, url: str) -> dict | None:
    try:
        loop = asyncio.get_event_loop()
        
        def run_in_thread():
            import subprocess
            result = subprocess.run(
                [sys.executable, SCRIPT_PATH, site, url],
                capture_output=True,
                text=True,
                timeout=120
            )
            return result
        
        proc = await loop.run_in_executor(None, run_in_thread)
        
        if proc.stderr:
            logger.debug(f"Scraper stderr: {proc.stderr[:500]}")

        if proc.returncode != 0:
            logger.error(f"Scraper process hata kodu: {proc.returncode}\n{proc.stderr}")
            return None

        output = proc.stdout.strip()
        if not output or output == "null":
            return None

        return json.loads(output)

    except Exception as e:
        import traceback
        logger.error(f"Scraper process hatası: {e}\n{traceback.format_exc()}")
        return None

async def scrape_product(product: dict, product_repo: ProductRepository, history_repo: PriceHistoryRepository) -> bool:
    product_id = product["id"]
    url = product["url"]
    site = detect_site(url)
    max_retries = 3

    if site == "unknown":
        logger.warning(f"Desteklenmeyen site: {url}")
        return False

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Scrape deneme {attempt}/{max_retries}: {url}")

            result = await run_scraper_process(site, url)

            if not result:
                raise Exception("Scrape sonucu boş döndü")

            old_price = product.get("current_price") or result["price"]

            await history_repo.create({
                "product_id": product_id,
                "price": result["price"],
                "currency": result["currency"],
                "timestamp": datetime.utcnow(),
            })

            await product_repo.update_price(product_id, result["price"])

            analyzer = PriceAnalyzer(history_repo)
            target_price = product.get("target_price")
            should_notify = await analyzer.should_notify(product_id, target_price)
            logger.info(f"Bildirim gerekli mi: {should_notify}, target_price: {target_price}")

            if should_notify:
                message = format_alert(
                    name=result["name"] or product.get("name", "Ürün"),
                    old_price=old_price,
                    new_price=result["price"],
                    url=url
                )
                await send_alert(message)

            logger.success(f"Scrape başarılı: {result['name']} → {result['price']} TRY")
            return True

        except Exception as e:
            logger.warning(f"Deneme {attempt} başarısız: {e}")

            if attempt == 1:
                logger.info("30 saniye bekleniyor...")
                await asyncio.sleep(30)
            elif attempt == 2:
                logger.info("2 dakika bekleniyor...")
                await asyncio.sleep(120)
            else:
                await product_repo.increment_error(product_id)
                logger.error(f"Tüm denemeler başarısız: {url}")
                return False

    return False


async def scrape_all(product_repo: ProductRepository, history_repo: PriceHistoryRepository):
    products = await product_repo.get_all_active()

    if not products:
        logger.info("Aktif ürün bulunamadı")
        return

    logger.info(f"{len(products)} aktif ürün scrape edilecek")

    semaphore = asyncio.Semaphore(3)

    async def scrape_with_semaphore(product):
        async with semaphore:
            await scrape_product(product, product_repo, history_repo)

    await asyncio.gather(*[scrape_with_semaphore(p) for p in products])
    logger.success("Tüm ürünler scrape edildi")