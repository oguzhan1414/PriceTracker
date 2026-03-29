import json
import os
from redis.asyncio import Redis
from loguru import logger

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_client: Redis | None = None


async def get_client() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(REDIS_URL, decode_responses=True)
    return _client


async def get_cached(url: str) -> dict | None:
    try:
        client = await get_client()
        data = await client.get(f"price:{url}")
        if data:
            logger.info(f"Cache HIT: {url}")
            return json.loads(data)
        logger.info(f"Cache MISS: {url}")
        return None
    except Exception as e:
        logger.error(f"Cache get error: {e}")
        return None


async def set_cached(url: str, data: dict, ttl: int = 21600) -> None:
    try:
        client = await get_client()
        await client.setex(f"price:{url}", ttl, json.dumps(data))
        logger.info(f"Cache SET: {url} (TTL: {ttl}s)")
    except Exception as e:
        logger.error(f"Cache set error: {e}")