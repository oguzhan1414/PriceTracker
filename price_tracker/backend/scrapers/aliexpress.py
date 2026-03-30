import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from scrapers.base import BaseScraper


class AliexpressScraper(BaseScraper):

    async def scrape(self, url: str) -> dict | None:
        try:
            await self.launch_browser()
            page = await self.new_page()
            
            logger.info(f"AliExpress scrape başlıyor: {url}")

            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            
            # Anti-bot için bekleme ve ciddi bir scroll
            await self.random_wait(3.0, 5.0)
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(2)
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(1)

            body_text = await page.evaluate("() => document.body.innerText")

            if "slide to verify" in body_text.lower() or "security focus" in body_text.lower():
                logger.warning(f"AliExpress bot engeli/captcha tespit edildi: {url}")
                return None

            # Title
            title = None
            title_selectors = ['h1[data-pl="product-title"]', '.product-title-text']
            for s in title_selectors:
                el = await page.query_selector(s)
                if el:
                    title = (await el.inner_text()).strip()
                    break

            price = None
            currency = "TRY"
            
            # Selector stratejileri (Sırasıyla dene)
            price_selectors = [
                 '.product-price-value',           # Standart Yeni UI
                 '.pdp-info-right .product-price', # Bazı alternatif layoutlar
                 '.uniform-banner-box-price',      # Banner
                 '[class*="price-default--current"]', # CSS Modules: current price
                 '[class*="price--currentPrice"]',    # CSS Modules: alt
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
                logger.warning(f"AliExpress fiyat bulunamadı: {url}")
                return None

            # Stok kontrolü
            out_of_stock = "out of stock" in body_text.lower() or "no longer available" in body_text.lower()

            image_url = None
            try:
                img_selectors = ['.pdp-info-left .pdp-image-preview img', '.magnifier-image']
                for img_sel in img_selectors:
                    img = await page.query_selector(img_sel)
                    if img:
                        image_url = self._normalize_image_url(await img.get_attribute('src'))
                        if image_url:
                            break
            except Exception:
                image_url = None

            if not image_url:
                image_url = await self.extract_first_image_url(page, "aliexpress")

            result = {
                "name": title or "Unknown Product (AliExpress)",
                "price": price,
                "currency": currency,
                "inStock": not out_of_stock,
                "image_url": image_url,
            }

            logger.success(f"AliExpress scrape başarılı: {result['name']} -> {result['price']} {currency}")
            return result

        except Exception as e:
            logger.error(f"AliExpress scrape hatası: {e}")
            return None
        finally:
            await self.close()
