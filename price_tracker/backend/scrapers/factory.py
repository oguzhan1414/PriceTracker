from scrapers.trendyol import TrendyolScraper
from scrapers.amazon import AmazonScraper
from scrapers.ebay import EbayScraper
from scrapers.aliexpress import AliexpressScraper
from scrapers.n11 import N11Scraper
from scrapers.vatan import VatanScraper
from scrapers.itopya import ItopyaScraper
from scrapers.incehesap import IncehesapScraper
from scrapers.newegg import NeweggScraper
from scrapers.banggood import BanggoodScraper
from scrapers.etsy import EtsyScraper
from cache.redis_client import get_cached, set_cached
from loguru import logger


class ScraperFactory:

    @staticmethod
    def get_scraper(url: str):
        url_lower = url.lower()

        if "trendyol.com" in url_lower:
            return TrendyolScraper()
        elif "n11.com" in url_lower:
            return N11Scraper()
        elif "vatanbilgisayar.com" in url_lower:
            return VatanScraper()
        elif "itopya.com" in url_lower:
            return ItopyaScraper()
        elif "incehesap.com" in url_lower:
            return IncehesapScraper()
        elif "amazon." in url_lower:
            return AmazonScraper()
        elif "newegg." in url_lower:
            return NeweggScraper()
        elif "banggood." in url_lower:
            return BanggoodScraper()
        elif "etsy." in url_lower:
            return EtsyScraper()
        elif "ebay." in url_lower:
            return EbayScraper()
        elif "aliexpress." in url_lower:
            return AliexpressScraper()
        else:
            return None

    @staticmethod
    async def scrape_with_cache(url: str) -> dict | None:
        # Önce cache'e bak
        cached = await get_cached(url)
        if cached:
            logger.info(f"Cache'den döndü: {url}")
            return cached

        # Cache'de yoksa scrape et
        scraper = ScraperFactory.get_scraper(url)
        if not scraper:
            logger.warning(f"Desteklenmeyen site: {url}")
            return None

        result = await scraper.scrape(url)

        # Başarılıysa cache'e yaz
        if result:
            await set_cached(url, result)

        return result