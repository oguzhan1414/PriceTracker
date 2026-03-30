from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from loguru import logger
import hashlib

class ProductRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["products"]

    async def create(self, product_data: dict) -> str:
        result = await self.collection.insert_one(product_data)
        logger.info(f"Ürün eklendi: {result.inserted_id}")
        return str(result.inserted_id)

    async def get_all_active(self) -> list:
        cursor = self.collection.find({"active": True})
        products = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            products.append(doc)
        return products

    async def get_by_id(self, item_id: str) -> Optional[dict]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(item_id)})
        except Exception:
            return None
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def update_price(self, product_id: str, price: float):
        await self.collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": {
                "current_price": price,
                "last_scraped_at": datetime.utcnow()
            }}
        )
        logger.info(f"Fiyat güncellendi: {product_id} → {price}")

    async def update(self, product_id: str, data: dict):
        await self.collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": data}
        )

    async def soft_delete(self, product_id: str):
        await self.collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": {"active": False}}
        )
        logger.info(f"Ürün silindi: {product_id}")

    async def increment_error(self, product_id: str):
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(product_id)},
            {"$inc": {"error_count": 1}},
            return_document=True
        )
        if result and result["error_count"] >= 3:
            await self.update(product_id, {"active": False})
            logger.warning(f"Ürün devre dışı bırakıldı (çok fazla hata): {product_id}")


class PriceHistoryRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["price_history"]

    async def create(self, history_data: dict) -> str:
        result = await self.collection.insert_one(history_data)
        return str(result.inserted_id)

    async def get_by_product(self, product_id: str, days: int = 30) -> list:
        since = datetime.utcnow() - timedelta(days=days)
        cursor = self.collection.find(
            {
                "product_id": product_id,
                "timestamp": {"$gte": since}
            }
        ).sort("timestamp", 1)
        history = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            history.append(doc)
        return history

    async def get_latest(self, product_id: str) -> Optional[dict]:
        doc = await self.collection.find_one(
            {"product_id": product_id},
            sort=[("timestamp", -1)]
        )
        return doc
    

class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["users"]

    async def create(self, user_data: dict) -> str:
        result = await self.collection.insert_one(user_data)
        logger.info(f"Kullanıcı oluşturuldu: {result.inserted_id}")
        return str(result.inserted_id)

    async def get_by_email(self, email: str) -> Optional[dict]:
        doc = await self.collection.find_one({"email": email})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def get_by_id(self, item_id: str) -> Optional[dict]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(item_id)})
        except Exception:
            return None
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def update(self, user_id: str, data: dict):
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": data}
        )


class ProductPoolRepository:
    """Tekilleştirilmiş ürün havuzu — kullanıcıdan bağımsız"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["products_pool"]

    @staticmethod
    def canonical_url(url: str) -> str:
        """URL'i temizle ve hashle — aynı ürünün iki kere eklenmesini engelle"""
        import re
        # Query parametrelerini temizle (boutiqueId, ref vs.)
        clean = re.sub(r'\?.*$', '', url.strip().lower().rstrip('/'))
        return hashlib.sha256(clean.encode()).hexdigest()

    async def get_by_hash(self, url_hash: str) -> Optional[dict]:
        doc = await self.collection.find_one({"canonical_url_hash": url_hash})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def create(self, product_data: dict) -> str:
        result = await self.collection.insert_one(product_data)
        logger.info(f"Ürün havuzuna eklendi: {result.inserted_id}")
        return str(result.inserted_id)

    async def update_price(self, product_id: str, price: float, name: str = None, image_url: str | None = None):
        update_data = {
            "current_price": price,
            "last_checked_at": datetime.utcnow()
        }
        if name:
            update_data["name"] = name
        if image_url:
            update_data["image_url"] = image_url
        await self.collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": update_data}
        )

    async def get_by_id(self, item_id: str) -> Optional[dict]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(item_id)})
        except Exception:
            return None
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def get_all_active(self) -> list:
        cursor = self.collection.find({"active": True})
        products = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            products.append(doc)
        return products

    async def increment_error(self, product_id: str):
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(product_id)},
            {"$inc": {"error_count": 1}},
            return_document=True
        )
        if result and result.get("error_count", 0) >= 3:
            await self.collection.update_one(
                {"_id": ObjectId(product_id)},
                {"$set": {"active": False}}
            )
            logger.warning(f"Ürün havuzdan devre dışı bırakıldı: {product_id}")


class TrackedItemRepository:
    """Kullanıcı — Ürün abonelik tablosu"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["tracked_items"]

    async def create(self, item_data: dict) -> str:
        result = await self.collection.insert_one(item_data)
        logger.info(f"Takip eklendi: {result.inserted_id}")
        return str(result.inserted_id)

    async def get_by_user(self, user_id: str) -> list:
        cursor = self.collection.find({"user_id": user_id, "is_active": True})
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            items.append(doc)
        return items

    async def count_active_by_user(self, user_id: str) -> int:
        return await self.collection.count_documents({"user_id": user_id, "is_active": True})
    
    async def get_by_product(self, product_id: str) -> list:
        cursor = self.collection.find({"product_id": product_id, "is_active": True})
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            items.append(doc)
        return items

    async def get_by_user_and_product(self, user_id: str, product_id: str) -> Optional[dict]:
        doc = await self.collection.find_one({
            "user_id": user_id,
            "product_id": product_id,
            "is_active": True
        })
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def get_any_by_user_and_product(self, user_id: str, product_id: str) -> Optional[dict]:
        doc = await self.collection.find_one({
            "user_id": user_id,
            "product_id": product_id,
        })
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def get_by_id(self, item_id: str) -> Optional[dict]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(item_id)})
        except Exception:
            return None
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def delete(self, item_id: str):
        await self.collection.delete_one({"_id": ObjectId(item_id)})
        logger.info(f"Takip tamamen silindi: {item_id}")

    async def reactivate(self, item_id: str, target_price: Optional[float] = None):
        update_fields = {"is_active": True}
        if target_price is not None:
            update_fields["target_price"] = target_price
        await self.collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": update_fields}
        )
        logger.info(f"Takip yeniden aktifleştirildi: {item_id}")

    async def get_all_active_product_ids(self) -> list:
        """Scraper için — aktif takip edilen tüm unique product_id'leri döndür"""
        cursor = self.collection.find({"is_active": True})
        product_ids = set()
        async for doc in cursor:
            product_ids.add(doc["product_id"])
        return list(product_ids)


class RefreshTokenRepository:
    """Refresh token state takibi (revoke/rotation)"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["refresh_tokens"]

    async def create(self, token_data: dict) -> str:
        result = await self.collection.insert_one(token_data)
        return str(result.inserted_id)

    async def get_valid_by_hash(self, token_hash: str) -> Optional[dict]:
        now = datetime.utcnow()
        doc = await self.collection.find_one({
            "token_hash": token_hash,
            "revoked_at": None,
            "expires_at": {"$gt": now},
        })
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    async def revoke_by_hash(self, token_hash: str):
        await self.collection.update_one(
            {"token_hash": token_hash, "revoked_at": None},
            {"$set": {"revoked_at": datetime.utcnow()}},
        )