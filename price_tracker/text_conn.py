import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def test():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("MONGO_DB_NAME")]
    
    # Test verisi ekle
    result = await db.test.insert_one({"test": "merhaba", "durum": "çalışıyor"})
    print(f"Eklendi! ID: {result.inserted_id}")
    
    # Geri oku
    doc = await db.test.find_one({"test": "merhaba"})
    print(f"Okundu: {doc}")
    
    # Temizle
    await db.test.delete_one({"test": "merhaba"})
    print("Bağlantı başarılı, Atlas çalışıyor!")
    
    client.close()

asyncio.run(test())