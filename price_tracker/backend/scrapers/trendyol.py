import re
import sys
import os
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from scrapers.base import BaseScraper


class TrendyolScraper(BaseScraper):

    async def scrape(self, url: str) -> dict | None:
        # Browser'ı başlat (Scraper'ı engine yönetiyorsa bu burada kalabilir, 
        # ancak engine her seferinde yeni instance yaratıyor)
        if not self.browser:
            await self.launch_browser()
            
        try:
            page = await self.new_page()
            
            logger.info(f"Trendyol scrape başlıyor: {url}")
            
            # Navigasyon
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            except Exception as e:
                logger.error(f"Sayfa yüklenemedi: {e}")
                return None

            # Bot tespiti için bekleme ve hareketler
            await self.random_wait(2.0, 4.0)
            
            # Scroll to trigger caching/lazy loads
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(1)

            # --- Seçiciler (Selectors) ---
            # Trendyol fiyat seçicileri (Sırayla denenir)
            price_selectors = [
                '.product-price-container .prc-dsc', # Yaygın
                '.ps-curr',                          # Alternatif
                '.prc-dsc',                          # Eski
                '.prc-slg',                          # İndirimli
                '[class*="price"]',                  # Genel fallback
                'div.product-price-container span'
            ]
            
            price = None
            price_text = ""
            
            for sel in price_selectors:
                el = await page.query_selector(sel)
                if el:
                    price_text = await el.inner_text()
                    cleaned = self.clean_price(price_text)
                    if cleaned:
                        price = cleaned
                        logger.info(f"Fiyat bulundu ({sel}): {price}")
                        break
            
            # Hala yoksa JS ile sayfadaki fiyat benzeri metinleri ara
            if not price:
                body_text = await page.evaluate("document.body.innerText")
                if "Anasayfaya Dön" in body_text or "Aradığınız sayfayı bulamadık" in body_text:
                    logger.warning(f"Ürün bulunamadı veya 404: {url}")
                    return None
                    
                import re
                # Basit Regex: "1.234,56 TL" formatı
                match = re.search(r'([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*TL', body_text)
                if match:
                    price = self.clean_price(match.group(1))

            if not price:
                logger.warning(f"Fiyat bulunamadı: {url} | Son denenen metin: {price_text[:50]}")
                # Hata ayıklamak için screenshot alınabilir
                # await page.screenshot(path="trendyol_error.png")
                return None

            # İsim Çekme
            name_selectors = ['h1.pr-new-br', 'h1.product-name', 'h1', '.name-holder']
            name = "Unknown Product"
            for n_sel in name_selectors:
                n_el = await page.query_selector(n_sel)
                if n_el:
                    name = (await n_el.inner_text()).strip()
                    break

            # Stok Kontrolü
            body_lower = (await page.content()).lower()
            out_of_stock = "tükendi" in body_lower or "stokta yok" in body_lower or "gelince haber ver" in body_lower
            image_url = await self.extract_first_image_url(page, "trendyol")

            result = {
                "name": name,
                "price": price,
                "currency": "TRY",
                "inStock": not out_of_stock,
                "image_url": image_url,
            }

            logger.success(f"Trendyol scrape başarılı: {result['name']} -> {result['price']} TRY")
            return result

        except Exception as e:
            logger.error(f"Trendyol scrape hatası: {e}")
            return None
        finally:
            await self.close()