import re
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from scrapers.base import BaseScraper

class VatanScraper(BaseScraper):

    async def scrape(self, url: str) -> dict | None:
        try:
            await self.launch_browser()
            page = await self.new_page()
            
            logger.info(f"Vatan Bilgisayar scrape başlıyor: {url}")

            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await self.random_wait(2.0, 4.0)
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(1)

            title = None
            title_selectors = ['h1.product-list__product-name', 'h1']
            for s in title_selectors:
                el = await page.query_selector(s)
                if el:
                    title = (await el.inner_text()).strip()
                    break

            price = None
            currency = "TRY"
            
            price_selectors = [
                 '.product-list__price',
                 '.product-list__current-price',
                 'span.product-list__price'
            ]
            
            for sel in price_selectors:
                el = await page.query_selector(sel)
                if el:
                    txt = await el.inner_text()
                    if txt:
                        p, curr = self.extract_price_and_currency(txt)
                        if p:
                            price = p
                            currency = curr
                            break

            if not price:
                logger.warning(f"Vatan Bilgisayar fiyat bulunamadı: {url}")
                return None

            body_text = await page.evaluate("() => document.body.innerText")
            out_of_stock = "tükendi" in body_text.lower() or "stokta yok" in body_text.lower()

            image_url = None
            try:
                img_selectors = [
                    'meta[property="og:image"]',
                    '.swiper-slide img'
                ]
                for img_sel in img_selectors:
                    img = await page.query_selector(img_sel)
                    if img:
                        if img_sel.startswith('meta'):
                            src = await img.get_attribute('content')
                        else:
                            src = await img.get_attribute('src')
                        
                        if src:
                            image_url = self._normalize_image_url(src)
                            if image_url:
                                break
            except Exception:
                pass

            if not image_url:
                image_url = await self.extract_first_image_url(page, "vatan")

            result = {
                "name": title or "Unknown Product (Vatan Bilgisayar)",
                "price": price,
                "currency": currency,
                "inStock": not out_of_stock,
                "image_url": image_url,
            }

            logger.success(f"Vatan Bilgisayar scrape başarılı: {result['name']} -> {result['price']} {currency}")
            return result

        except Exception as e:
            logger.error(f"Vatan Bilgisayar scrape hatası: {e}")
            return None
        finally:
            await self.close()
