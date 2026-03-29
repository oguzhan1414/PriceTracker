import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("MONGO_DB_NAME", "price_tracker")

_client: AsyncIOMotorClient | None = None


async def get_database() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL)
        db = _client[DB_NAME]

        # Unique indexler — race condition ve duplicate kayıtları önler
        await db["users"].create_index("email", unique=True)
        await db["products_pool"].create_index("canonical_url_hash", unique=True)
        await db["tracked_items"].create_index(
            [("user_id", 1), ("product_id", 1)], unique=True
        )
        await db["tracked_items"].create_index([("product_id", 1), ("is_active", 1)])
        await db["tracked_items"].create_index([("user_id", 1), ("is_active", 1)])
        await db["refresh_tokens"].create_index("token_hash", unique=True)
        await db["refresh_tokens"].create_index("expires_at", expireAfterSeconds=0)
        await db["refresh_tokens"].create_index("user_id")
        await db["telegram_link_tokens"].create_index("code", unique=True)
        await db["telegram_link_tokens"].create_index("expires_at", expireAfterSeconds=0)
        await db["telegram_link_tokens"].create_index([("user_id", 1), ("created_at", -1)])
        await db["payment_sessions"].create_index("external_session_id")
        await db["payment_sessions"].create_index([("user_id", 1), ("created_at", -1)])
        await db["payment_events"].create_index([("provider", 1), ("event_id", 1)], unique=True)
        await db["payment_events"].create_index("received_at")

        logger.info("MongoDB Atlas bağlantısı ve indexler kuruldu")
    return _client[DB_NAME]


async def close_database():
    global _client
    if _client:
        _client.close()
        _client = None
        logger.info("MongoDB bağlantısı kapatıldı")