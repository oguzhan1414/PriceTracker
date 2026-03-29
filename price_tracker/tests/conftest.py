import pytest
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import sys
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

load_dotenv()
os.environ.setdefault("PYTEST_RUNNING", "1")


@pytest.fixture
async def db():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    # Her test session icin benzersiz bir veritabani ismi olusturalim
    unique_test_db_name = os.getenv("MONGO_DB_NAME") + "_test_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")
    database = client[unique_test_db_name]
    yield database
    # Test sonrasi veritabanini temizle
    await client.drop_database(unique_test_db_name)
    client.close()


@pytest.fixture
async def client(db):
    from backend.main import app
    app.state.db = db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        ac.headers["X-API-Key"] = os.getenv("API_KEY", "")
        yield ac


@pytest.fixture
def product_repo(db):
    from backend.database.repository import ProductRepository
    return ProductRepository(db)


@pytest.fixture
def history_repo(db):
    from backend.database.repository import PriceHistoryRepository
    return PriceHistoryRepository(db)


@pytest.fixture
def fake_db(db):
    # Eski testlerle uyumluluk icin alias
    return db


@pytest.fixture
def sample_product():
    return {
        "name": "Test Urunu",
        "url": "https://www.trendyol.com/test-urun",
        "site": "trendyol",
        "target_price": 300.0,
        "current_price": None,
        "active": True,
        "currency": "TRY",
        "error_count": 0,
        "last_scraped_at": None,
        "created_at": datetime.utcnow()
    }


@pytest.fixture
def sample_prices():
    # Bilinen test fiyat listesi: 400 den 240 a inen fiyatlar
    return [400.0, 390.0, 380.0, 370.0, 300.0, 280.0, 240.0]


@pytest.fixture
def analyzer(history_repo):
    from analysis.price_analyzer import PriceAnalyzer
    return PriceAnalyzer(history_repo)
