import re
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from scrapers.base import BaseScraper

class N11Scraper(BaseScraper):

    async def scrape(self, url: str) -> dict | None:
        try:
            await self.launch_browser()
            page = await self.new_page()
            
            logger.info(f"N11 scrape başlıyor: {url}")

            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            
            # Anti-bot için bekleme ve scroll
            await self.random_wait(2.0, 4.0)
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(1)

            body_text = await page.evaluate("() => document.body.innerText")

            if "captcha" in body_text.lower() or "doğrulama" in body_text.lower() or "ben robot değilim" in body_text.lower():
                logger.warning(f"N11 bot engeli/captcha tespit edildi: {url}")
                return None

            # Title
            title = None
            title_selectors = ['h1.proName', 'h1']
            for s in title_selectors:
                el = await page.query_selector(s)
                if el:
                    title = (await el.inner_text()).strip()
                    break

            price = None
            currency = "TRY"
            
            # Selector stratejileri
            price_selectors = [
                 '.newPrice ins',
                 '.newPrice',
                 'div.price ins',
                 'div.priceDetail .newPrice',
                 'meta[itemprop="price"]'
            ]
            
            for sel in price_selectors:
                el = await page.query_selector(sel)
                if el:
                    if sel.startswith('meta'):
                        txt = await el.get_attribute('content')
                    else:
                        txt = await el.inner_text()
                    
                    if txt:
                        p, curr = self.extract_price_and_currency(txt)
                        if p:
                            price = p
                            currency = curr
                            break

            if not price:
                logger.warning(f"N11 fiyat bulunamadı: {url}")
                return None

            # Stok kontrolü
            out_of_stock = "tükendi" in body_text.lower() or "stokta yok" in body_text.lower()

            image_url = None
            try:
                img_selectors = [
                    'meta[property="og:image"]',
                    'meta[name="twitter:image"]',
                    '.imgObj a img', 
                    '.proDetailArea .imgObj img'
                ]
                for img_sel in img_selectors:
                    img = await page.query_selector(img_sel)
                    if img:
                        src = None
                        if img_sel.startswith('meta'):
                            src = await img.get_attribute('content')
                        else:
                            src = await img.get_attribute('data-original') or await img.get_attribute('src')
                        
                        if src:
                            image_url = self._normalize_image_url(src)
                            if image_url:
                                break
            except Exception:
                pass
                
            if not image_url:
                html = await page.content()
                match = re.search(r'(https://n11scdn.akamaized.net/a1/org/[^"\'\s>]+)', html)
                if match:
                    image_url = match.group(1)

            if not image_url:
                image_url = await self.extract_first_image_url(page, "n11")

            result = {
                "name": title or "Unknown Product (N11)",
                "price": price,
                "currency": currency,
                "inStock": not out_of_stock,
                "image_url": image_url,
            }

            logger.success(f"N11 scrape başarılı: {result['name']} -> {result['price']} {currency}")
            return result

        except Exception as e:
            logger.error(f"N11 scrape hatası: {e}")
            return None
        finally:
            await self.close()
