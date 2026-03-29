import pytest
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

from database.repository import ProductRepository, PriceHistoryRepository
from analysis.price_analyzer import PriceAnalyzer


@pytest.mark.asyncio
async def test_get_price_stats(db):
    product_repo = ProductRepository(db)
    history_repo = PriceHistoryRepository(db)
    analyzer = PriceAnalyzer(history_repo)

    # Test ürünü ekle
    product_id = await product_repo.create({
        "name": "Analyzer Test",
        "url": "https://www.trendyol.com/analyzer-test",
        "site": "trendyol",
        "target_price": 200.0,
        "current_price": 0.0,
        "active": True,
        "currency": "TRY",
        "error_count": 0,
        "created_at": datetime.utcnow()
    })

    # Fiyat geçmişi ekle
    prices = [500.0, 480.0, 460.0, 400.0, 350.0, 300.0]
    for i, price in enumerate(prices):
        await history_repo.create({
            "product_id": product_id,
            "price": price,
            "currency": "TRY",
            "timestamp": datetime.utcnow() - timedelta(days=len(prices) - i),
            "scrape_ms": 300
        })

    stats = await analyzer.get_price_stats(product_id)
    assert stats is not None
    assert stats["min"] == 300.0
    assert stats["max"] == 500.0
    assert stats["avg"] == pytest.approx(415.0, rel=0.01)
    assert stats["change_pct"] < 0  # Fiyat düşmüş


@pytest.mark.asyncio
async def test_is_significant_drop(db):
    history_repo = PriceHistoryRepository(db)
    analyzer = PriceAnalyzer(history_repo)

    product_repo = ProductRepository(db)
    product_id = await product_repo.create({
        "name": "Drop Test",
        "url": "https://www.trendyol.com/drop-test",
        "site": "trendyol",
        "target_price": 100.0,
        "current_price": 0.0,
        "active": True,
        "currency": "TRY",
        "error_count": 0,
        "created_at": datetime.utcnow()
    })

    # %40 düşüş
    for i, price in enumerate([500.0, 490.0, 480.0, 300.0]):
        await history_repo.create({
            "product_id": product_id,
            "price": price,
            "currency": "TRY",
            "timestamp": datetime.utcnow() - timedelta(days=4 - i),
            "scrape_ms": 300
        })

    drop = await analyzer.is_significant_drop(product_id, threshold=0.10)
    assert drop is True


@pytest.mark.asyncio
async def test_empty_history(db):
    history_repo = PriceHistoryRepository(db)
    analyzer = PriceAnalyzer(history_repo)

    stats = await analyzer.get_price_stats("000000000000000000000000")
    assert stats is None