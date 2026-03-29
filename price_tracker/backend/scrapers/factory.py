from scrapers.trendyol import TrendyolScraper
from scrapers.hepsiburada import HepsiburadaScraper
from scrapers.amazon import AmazonScraper
from cache.redis_client import get_cached, set_cached
from loguru import logger


class ScraperFactory:

    @staticmethod
    def get_scraper(url: str):
        url_lower = url.lower()

        if "trendyol.com" in url_lower:
            return TrendyolScraper()
        elif "hepsiburada.com" in url_lower:
            return HepsiburadaScraper()
        elif "amazon.com.tr" in url_lower:
            return AmazonScraper()
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