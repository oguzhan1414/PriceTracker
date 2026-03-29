"""
test_clean_price.py — BaseScraper.clean_price() unit testleri
Mock scraper ile gerçek browser olmadan çalışır.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from scrapers.base import BaseScraper


class ConcreteScraper(BaseScraper):
    """Test için abstract metod implemente edilmiş minimal scraper."""
    def scrape(self, url: str):
        return None


@pytest.fixture
def scraper():
    return ConcreteScraper()


class TestCleanPrice:

    def test_simple_integer_price(self, scraper):
        """'899 TL' → 899.0"""
        assert scraper.clean_price("899 TL") == 899.0

    def test_thousands_with_dot(self, scraper):
        """'2.445 TL' → 2445.0"""
        assert scraper.clean_price("2.445 TL") == 2445.0

    def test_decimal_with_comma(self, scraper):
        """'3.492,86 TL' → 3492.86"""
        assert scraper.clean_price("3.492,86 TL") == 3492.86

    def test_mixed_string_with_multiple_prices(self, scraper):
        """'Sepette %30 İndirimSepette2.445 TL3.492,86 TL' → 2445.0 (en düşük)"""
        raw = "Sepette %30 İndirimSepette2.445 TL3.492,86 TL"
        result = scraper.clean_price(raw)
        assert result == 2445.0

    def test_large_price(self, scraper):
        """'15.000 TL' → 15000.0"""
        assert scraper.clean_price("15.000 TL") == 15000.0

    def test_small_decimal(self, scraper):
        """'1.299,00 TL' → 1299.0"""
        assert scraper.clean_price("1.299,00 TL") == 1299.0

    def test_none_input(self, scraper):
        """None girişi None döndürmeli."""
        assert scraper.clean_price(None) is None

    def test_empty_string(self, scraper):
        """Boş string None döndürmeli."""
        assert scraper.clean_price("") is None

    def test_no_price_text(self, scraper):
        """Sayı içermeyen metin None döndürmeli."""
        assert scraper.clean_price("Fiyat bilgisi yok") is None

    def test_lira_sign(self, scraper):
        """₺ işareti ile yazılan fiyat da parse edilmeli."""
        result = scraper.clean_price("1.299 ₺")
        assert result == 1299.0
