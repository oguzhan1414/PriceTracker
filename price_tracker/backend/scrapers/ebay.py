import re
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from scrapers.base import BaseScraper


class EbayScraper(BaseScraper):

    async def scrape(self, url: str) -> dict | None:
        try:
            await self.launch_browser()
            page = await self.new_page()
            
            logger.info(f"eBay scrape başlıyor: {url}")

            # Timeout süresini artır, domcontentloaded kullan
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            
            # Anti-bot için hafif bekleme ve scroll
            await self.random_wait(2.0, 4.0)
            await page.evaluate("window.scrollBy(0, 400)")
            await asyncio.sleep(1)

            body_text = await page.evaluate("() => document.body.innerText")

            if "security measure" in body_text.lower() or "captcha" in body_text.lower():
                logger.warning(f"eBay bot engeli/captcha tespit edildi: {url}")
                return None

            # Title
            title = None
            title_selectors = ['h1.x-item-title__mainTitle', '#itemTitle']
            for s in title_selectors:
                el = await page.query_selector(s)
                if el:
                    title = (await el.inner_text()).replace("Details about", "").strip()
                    break

            price = None
            currency = "TRY"
            
            # Selector stratejileri
            price_selectors = [
                 '.x-price-primary',               # Modern yapı
                 'span[itemprop="price"]',         # Microdata formatı
                 '#prcIsum',                       # Ortak eski format
                 '#mm-saleDscPrc',                 # İndirimli
            ]
            
            for sel in price_selectors:
                el = await page.query_selector(sel)
                if el:
                    txt = await el.inner_text()
                    p, curr = self.extract_price_and_currency(txt)
                    if p:
                        price = p
                        currency = curr
                        break

            if not price:
                logger.warning(f"eBay fiyat bulunamadı: {url}")
                return None

            # Stok kontrolü
            out_of_stock = "out of stock" in body_text.lower() or "ended" in body_text.lower()

            image_url = None
            try:
                # UX carousel veya eski ana görsel idsine bakıyoruz
                img_selectors = ['.ux-image-carousel-item img', '#icImg', 'img[itemprop="image"]']
                for img_sel in img_selectors:
                    img = await page.query_selector(img_sel)
                    if img:
                        image_url = self._normalize_image_url(await img.get_attribute('src'))
                        if image_url:
                            break
            except Exception:
                image_url = None

            if not image_url:
                image_url = await self.extract_first_image_url(page, "ebay")

            result = {
                "name": title or "Unknown Product (eBay)",
                "price": price,
                "currency": currency,
                "inStock": not out_of_stock,
                "image_url": image_url,
            }

            logger.success(f"eBay scrape başarılı: {result['name']} -> {result['price']} {currency}")
            return result

        except Exception as e:
            logger.error(f"eBay scrape hatası: {e}")
            return None
        finally:
            await self.close()
