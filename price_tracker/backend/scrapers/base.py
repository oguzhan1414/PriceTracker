import random
import asyncio
import re
from urllib.parse import urlparse
from abc import ABC, abstractmethod
from playwright.async_api import async_playwright, Browser, Page, Playwright
from loguru import logger
from playwright_stealth import Stealth

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]


class BaseScraper(ABC):

    def __init__(self):
        self.browser: Browser | None = None
        self.playwright: Playwright | None = None

    async def launch_browser(self):
        """Tarayıcıyı asenkron olarak başlatır."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,
            ignore_default_args=["--enable-automation"],
            args=[
                "--headless=new",
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--ignore-certificate-errors",
                "--disable-web-security",
                "--disable-infobars",
                "--window-size=1920,1080"
            ]
        )
        logger.info("Tarayıcı başlatıldı (Async)")

    async def close(self):
        """Tarayıcıyı ve Playwright'ı kapatır."""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("Tarayıcı kapatıldı")

    async def new_page(self) -> Page:
        """Yeni bir sayfa (sekme) oluşturur."""
        if not self.browser:
            await self.launch_browser()
            
        context = await self.browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1920, "height": 1080},
            locale="tr-TR",
            ignore_https_errors=True,
            java_script_enabled=True
        )
        
        page = await context.new_page()
        stealth = Stealth()
        await stealth.apply_stealth_async(page)
        
        return page

    async def random_wait(self, min_sec: float = 1.0, max_sec: float = 3.0):
        """Bot algılanmasını önlemek için rastgele bekleme."""
        wait_time = random.uniform(min_sec, max_sec)
        await asyncio.sleep(wait_time)

    async def apply_stealth(self, page: Page):
        """Artık doğrudan playwright-stealth kullanıyoruz, bu metot geriye dönük uyumluluk için boş tutulabilir veya kullanılmayabilir."""
        pass

    @staticmethod
    def _normalize_image_url(url: str | None) -> str | None:
        if not url:
            return None
        normalized = url.strip().replace("\\u002F", "/").replace("\\/", "/")
        if normalized.startswith("//"):
            normalized = f"https:{normalized}"
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"}:
            return None
        return normalized

    @staticmethod
    def _first_match_from_patterns(text: str, patterns: list[str]) -> str | None:
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                candidate = BaseScraper._normalize_image_url(match.group(0))
                if candidate:
                    return candidate
        return None

    async def extract_first_image_url(self, page: Page, site: str) -> str | None:
        """Önce OG image, sonra site-pattern ve generic pattern ile ilk görsel URL'yi bul."""
        try:
            og = await page.query_selector('meta[property="og:image"], meta[name="og:image"]')
            if og:
                og_url = self._normalize_image_url(await og.get_attribute("content"))
                if og_url:
                    return og_url
        except Exception:
            pass

        try:
            html = await page.content()
        except Exception:
            return None

        site_patterns: dict[str, list[str]] = {
            "trendyol": [
                r"https://cdn\\.dsmcdn\\.com/[^\"'\\s>]+",
                r"https://ty[0-9]\\.dsmcdn\\.com/[^\"'\\s>]+",
            ],
            "n11": [
                r"https://n11scdn\\.akamaized\\.net/a1/org/[^\"'\\s>]+"
            ],
            "amazon": [
                r"https://m\\.media-amazon\\.com/images/I/[^\"'\\s>]+",
            ],
            "itopya": [
                r"https://img\\.itopya\\.com/[^\"'\\s>]+"
            ],
            "incehesap": [
                r"https://incehesap\\.com/resim/[^\"'\\s>]+"
            ],
            "vatan": [
                r"https://cdn\\.vatanbilgisayar\\.com/Upload/[^\"'\\s>]+"
            ],
            "newegg": [
                r"https://c1\\.neweggimages\\.com/ProductImage/[^\"'\\s>]+"
            ],
            "banggood": [
                r"https://imgaz\\d?\\.banggood\\.com/[^\"'\\s>]+"
            ],
            "etsy": [
                r"https://i\\.etsystatic\\.com/[^\"'\\s>]+"
            ]
        }

        candidate = self._first_match_from_patterns(html, site_patterns.get(site, []))
        if candidate:
            return candidate

        return self._first_match_from_patterns(
            html,
            [
                r"https?://[^\"'\\s>]+\\.(?:jpg|jpeg|png|webp)",
            ],
        )

    def extract_price_and_currency(self, text: str) -> tuple[float | None, str]:
        """Fiyatı ve para birimini ayıklar. USD, EUR, GBP gibi kurların format farklılıklarını yönetir."""
        if not text:
            return None, "TRY"
            
        text_upper = text.upper()
        currency = "TRY"
        if "$" in text_upper or "USD" in text_upper:
            currency = "USD"
        elif "€" in text_upper or "EUR" in text_upper:
            currency = "EUR"
        elif "£" in text_upper or "GBP" in text_upper:
            currency = "GBP"
            
        try:
            nums = re.findall(r'\d+(?:[.,]\d+)*', text)
            if not nums:
                return None, currency
                
            raw_price = nums[-1] # En sondaki veya en büyük eşleşmeyi alıyoruz (genelde fiyat sondadır veya tekdir)
            
            # Öncelikle USD gibi kur logolarıyla eşleşen tam bloğu (Örn: $50.99) bulmaya çalışalım
            matches_with_currency = re.findall(r'(?:USD|EUR|GBP|TRY|\$|€|£|₺)\s*(\d+(?:[.,]\d+)*)|(\d+(?:[.,]\d+)*)\s*(?:USD|EUR|GBP|TRY|\$|€|£|₺)', text_upper)
            if matches_with_currency:
                # Eşleşmelerin içindeki boş olmayan gruba bak
                for m1, m2 in matches_with_currency:
                    valid_match = m1 if m1 else m2
                    if valid_match:
                        raw_price = valid_match
                        break

            if currency in ["USD", "GBP"]:
                # Amerikan / İngiliz stili: 1,299.99 -> 1299.99
                cleaned = raw_price.replace(',', '')
                return float(cleaned), currency
            else:
                # Avrupa / TR stili: 1.250,99 -> 1250.99
                cleaned = raw_price
                if ',' in cleaned and '.' in cleaned:
                    cleaned = cleaned.replace('.', '').replace(',', '.')
                elif ',' in cleaned:
                    cleaned = cleaned.replace(',', '.')
                elif '.' in cleaned:
                    parts = cleaned.split('.')
                    if len(parts[-1]) == 3:
                        cleaned = cleaned.replace('.', '')
                return float(cleaned), currency
        except Exception as e:
            logger.warning(f"Fiyat/Kur parse edilemedi ({e}): {text}")
            return None, currency

    def clean_price(self, text: str) -> float | None:
        """Fiyat metnini float'a çevirir (1.299,90 TL -> 1299.90)."""
        if not text:
            return None
        try:
            def parse_match(raw_price: str) -> float | None:
                cleaned = re.sub(r'[^\d.,]', '', raw_price)
                if not cleaned:
                    return None
                if ',' in cleaned and '.' in cleaned:
                    cleaned = cleaned.replace('.', '').replace(',', '.')
                elif ',' in cleaned:
                    cleaned = cleaned.replace(',', '.')
                elif '.' in cleaned:
                    parts = cleaned.split('.')
                    if len(parts[-1]) == 3:
                        cleaned = cleaned.replace('.', '')
                try:
                    return float(cleaned)
                except ValueError:
                    return None

            # Öncelikle açıkça TL/₺ belirten fiyatları arayalım (Örn: "2.445 TL", "3.492,86 TL")
            matches = re.findall(r'(\d+(?:[.,]\d+)*)\s*(?:TL|₺|tl|TRY|try)', text)
            if matches:
                prices = [p for p in (parse_match(m) for m in matches) if p is not None]
                if prices:
                    return min(prices)
            
            nums = re.findall(r'\d+(?:[.,]\d+)*', text)
            if not nums:
                return None
            
            prices = [p for p in (parse_match(m) for m in nums) if p is not None]
            if prices:
                return prices[-1]

            return None
        except Exception as e:
            logger.warning(f"Fiyat parse edilemedi ({e}): {text}")
            return None
    
    @abstractmethod
    async def scrape(self, url: str) -> dict | None:
        """Her alt sınıf bu metodu asenkron olarak implemente etmelidir."""
        pass