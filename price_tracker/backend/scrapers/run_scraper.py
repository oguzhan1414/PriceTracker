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
    elif site == "hepsiburada":
        from scrapers.hepsiburada import HepsiburadaScraper
        scraper = HepsiburadaScraper()
    elif site == "amazon":
        from scrapers.amazon import AmazonScraper
        scraper = AmazonScraper()
    else:
        print(json.dumps(None))
        return

    result = await scraper.scrape(url)
    print(json.dumps(result, ensure_ascii=False))


asyncio.run(main())