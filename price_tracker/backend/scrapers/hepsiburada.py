import re
import sys
import os
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from scrapers.base import BaseScraper


class HepsiburadaScraper(BaseScraper):

    async def scrape(self, url: str) -> dict | None:
        if not self.browser:
            await self.launch_browser()

        try:
            page = await self.new_page()
            logger.info(f"Hepsiburada scrape başlıyor: {url}")

            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            except Exception as e:
                logger.error(f"Sayfa yüklenirken hata: {e}")
                return None

            if response and response.status == 404:
                logger.warning(f"Sayfa bulunamadı (404): {url}")
                return None

            # Sayfanın yüklenmesi için bekle
            await asyncio.sleep(8)

            # Scroll yaparak lazy load tetikle
            try:
                await page.evaluate("window.scrollBy(0, 500)")
                await asyncio.sleep(2)
            except Exception:
                pass

            # Başlık
            title = None
            try:
                title_el = await page.query_selector("h1")
                if title_el:
                    title = (await title_el.inner_text()).strip()
            except Exception:
                pass

            # body_text'ten regex ile fiyat çek — en stabil yöntem
            body_text = await page.evaluate("() => document.body.innerText")

            if not body_text:
                logger.warning(f"Sayfa içeriği boş: {url}")
                return None

            # "7.830,00 TL" formatını yakala
            match = re.search(r'([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*TL', body_text)
            if not match:
                logger.warning(f"Hepsiburada fiyat yok: {url}")
                return None

            price = self.clean_price(match.group(1) + " TL")
            if not price:
                logger.warning(f"Fiyat parse edilemedi: {match.group(1)}")
                return None

            out_of_stock = (
                "tükendi" in body_text.lower() or
                "stokta yok" in body_text.lower() or
                "geçici olarak temin edilememektedir" in body_text.lower()
            )

            if out_of_stock:
                logger.warning(f"Ürün stokta yok: {url}")
                return None

            # Hepsiburada: <source type="image/webp"> öncelikli al
            image_url = None
            try:
                source_el = await page.query_selector('source[type="image/webp"]')
                if source_el:
                    srcset = await source_el.get_attribute("srcset")
                    src = await source_el.get_attribute("src")
                    raw = srcset or src
                    if raw:
                        # srcset virgüllü olabilir, ilk URL'yi al
                        first_candidate = raw.split(",")[0].strip().split(" ")[0].strip()
                        image_url = self._normalize_image_url(first_candidate)
            except Exception:
                image_url = None

            if not image_url:
                image_url = await self.extract_first_image_url(page, "hepsiburada")

            result = {
                "name": title or "",
                "price": price,
                "currency": "TRY",
                "inStock": True,
                "image_url": image_url,
            }

            logger.success(f"Hepsiburada scrape başarılı: {result['name']} → {result['price']} TRY")
            return result

        except Exception as e:
            logger.error(f"Hepsiburada scrape hatası: {e}")
            return None
        finally:
            await self.close()