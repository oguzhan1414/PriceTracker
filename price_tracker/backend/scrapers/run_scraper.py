"""
Bu script FastAPI'den bağımsız çalışır.
Argüman olarak site ve URL alır, sonucu stdout'a JSON olarak yazar.
"""
import sys
import os
import json
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    if len(sys.argv) < 3:
        print(json.dumps(None))
        return

    site = sys.argv[1]  # trendyol, hepsiburada, amazon
    url = sys.argv[2]

    if site == "trendyol":
        from scrapers.trendyol import TrendyolScraper
        scraper = TrendyolScraper()
    elif site == "n11":
        from scrapers.n11 import N11Scraper
        scraper = N11Scraper()
    elif site == "itopya":
        from scrapers.itopya import ItopyaScraper
        scraper = ItopyaScraper()
    elif site == "incehesap":
        from scrapers.incehesap import IncehesapScraper
        scraper = IncehesapScraper()
    elif site == "vatan":
        from scrapers.vatan import VatanScraper
        scraper = VatanScraper()
    elif site == "newegg":
        from scrapers.newegg import NeweggScraper
        scraper = NeweggScraper()
    elif site == "banggood":
        from scrapers.banggood import BanggoodScraper
        scraper = BanggoodScraper()
    elif site == "etsy":
        from scrapers.etsy import EtsyScraper
        scraper = EtsyScraper()
    elif site == "amazon":
        from scrapers.amazon import AmazonScraper
        scraper = AmazonScraper()
    elif site == "ebay":
        from scrapers.ebay import EbayScraper
        scraper = EbayScraper()
    elif site == "aliexpress":
        from scrapers.aliexpress import AliexpressScraper
        scraper = AliexpressScraper()
    else:
        print(json.dumps(None))
        return

    result = await scraper.scrape(url)
    print(json.dumps(result, ensure_ascii=False))


asyncio.run(main())