import statistics
from datetime import datetime, timedelta
from loguru import logger
from database.repository import PriceHistoryRepository


class PriceAnalyzer:

    def __init__(self, history_repo: PriceHistoryRepository):
        self.history_repo = history_repo

    async def get_30day_average(self, product_id: str) -> float | None:
        history = await self.history_repo.get_by_product(product_id, days=30)
        if not history:
            return None
        prices = [h["price"] for h in history]
        return round(statistics.mean(prices), 2)

    async def get_price_stats(self, product_id: str) -> dict | None:
        history = await self.history_repo.get_by_product(product_id, days=30)
        if not history:
            return None

        prices = [h["price"] for h in history]
        first_price = prices[0]
        last_price = prices[-1]
        change_pct = round(((last_price - first_price) / first_price) * 100, 2)

        return {
            "min": min(prices),
            "max": max(prices),
            "avg": round(statistics.mean(prices), 2),
            "change_pct": change_pct,
            "data_points": len(prices)
        }

    async def is_significant_drop(self, product_id: str, threshold: float = 0.10) -> bool:
        history = await self.history_repo.get_by_product(product_id, days=30)
        if len(history) < 2:
            return False

        prices = [h["price"] for h in history]
        max_price = max(prices[:-1])  # Max price excluding the latest point
        current_price = prices[-1]

        drop = (max_price - current_price) / max_price
        result = drop >= threshold
        if result:
            logger.info(f"Significant price drop detected: {round(drop * 100, 1)}%")
        return result

    async def is_below_target(self, product_id: str, target_price: float) -> bool:
        latest = await self.history_repo.get_latest(product_id)
        if not latest:
            return False
        return latest["price"] <= target_price

    async def should_notify(self, product_id: str, target_price: float | None = None) -> bool:
        drop = await self.is_significant_drop(product_id)
        below = await self.is_below_target(product_id, target_price) if target_price else False
        return drop or below