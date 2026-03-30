import re
import asyncio
import sys
import os
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from scrapers.base import BaseScraper
# playwright_stealth importunu kaldırdık


class AmazonScraper(BaseScraper):

    async def scrape(self, url: str) -> dict | None:
        try:
            # new_page içinde context ve stealth ayarlanıyor
            await self.launch_browser()
            page = await self.new_page()
            
            logger.info(f"Amazon scrape başlıyor: {url}")

            # Timeout süresini artır
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            
            # Sayfa yüklendikten sonra biraz bekle (Bot tespiti için kritik)
            await self.random_wait(3.0, 6.0)

            # Scroll yaparak lazy loading tetikle
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(1)

            body_text = await page.evaluate("() => document.body.innerText")

            if "robot" in body_text.lower() or "captcha" in body_text.lower():
                logger.warning(f"Amazon CAPTCHA tespit edildi: {url}")
                # Belki burada screenshot alıp debug edebiliriz
                # await page.screenshot(path="captcha_debug.png")
                return None

            title_el = await page.query_selector('#productTitle')
            title = (await title_el.inner_text()).strip() if title_el else None

            price = None
            currency = "TRY"
            
            # Selector stratejileri (Sırasıyla dene)
            selectors = [
                 '.a-price .a-offscreen',           # Standart fiyat
                 '#price_inside_buybox',            # Buybox fiyatı
                 '#priceblock_ourprice',            # Eski stil
                 '#priceblock_dealprice',           # Fırsat fiyatı
                 '.abc-price-whole',                # Alternatif
                 'span.a-price-whole',              # Sadece tam sayı kısmı (dikkatli olmalı)
            ]
            
            for sel in selectors:
                el = await page.query_selector(sel)
                if el:
                    txt = await el.inner_text()
                    # Eğer a-price-whole ise, kuruş kısmını da bulmaya çalış
                    if sel == 'span.a-price-whole':
                        fraction = await page.query_selector('span.a-price-fraction')
                        if fraction:
                            txt += f".{await fraction.inner_text()}"
                            
                        # Özellikle Amazon US'de $ simgesi .a-price-symbol sınıfındadır, bunu bulmayı deneyelim.
                        symbol = await page.query_selector('span.a-price-symbol')
                        if symbol:
                            txt = f"{await symbol.inner_text()} {txt}"
                    
                    p, curr = self.extract_price_and_currency(txt)
                    if p:
                        price = p
                        currency = curr
                        break

            # Hala bulunamadıysa regex ile dene
            if not price:
                 match = re.search(r'([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*TL', body_text)
                 if match:
                      p, curr = self.extract_price_and_currency(match.group(1) + " TRY")
                      price, currency = p, curr

            if not price:
                logger.warning(f"Fiyat bulunamadı: {url}")
                return None

            out_of_stock = "stokta yok" in body_text.lower() or "tükendi" in body_text.lower() or "currently unavailable" in body_text.lower()

            # Amazon: imgTagWrapper altındaki görseli öncelikle al
            image_url = None
            try:
                img = await page.query_selector('#imgTagWrapperId img, .imgTagWrapper img')
                if img:
                    image_url = self._normalize_image_url(await img.get_attribute('src'))
            except Exception:
                image_url = None

            if not image_url:
                image_url = await self.extract_first_image_url(page, "amazon")
            
            result = {
                "name": title or "Unknown Product",
                "price": price,
                "currency": currency,
                "inStock": not out_of_stock,
                "image_url": image_url,
            }

            logger.success(f"Amazon scrape başarılı: {result['name']} -> {result['price']} {currency}")
            return result

        except Exception as e:
            logger.error(f"Amazon scrape hatası: {e}")
            return None
        finally:
            await self.close()