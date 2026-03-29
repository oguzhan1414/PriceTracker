import pytest
from datetime import datetime

# FakeDB classları buraya taşıdık çünkü conftest içindeki gerçek DB ile karışıyor
# Mock testleri için kendi fake yapımızı kullanalım

class FakeCollection:
    def __init__(self):
        self._docs = {}

    def _next_id(self):
        from bson import ObjectId
        return ObjectId()

    async def insert_one(self, doc):
        oid = self._next_id()
        doc = dict(doc)
        doc["_id"] = oid
        self._docs[str(oid)] = doc
        # Mock result object
        class Result: pass
        result = Result()
        result.inserted_id = oid
        return result

    async def find_one(self, query, sort=None):
        for doc in self._docs.values():
            if self._matches(doc, query):
                return dict(doc)
        return None

    def find(self, query=None):
        matched = [dict(d) for d in self._docs.values() if self._matches(d, query or {})]
        return FakeCursor(matched)

    async def update_one(self, query, update):
        for key, doc in self._docs.items():
            if self._matches(doc, query):
                if "$set" in update:
                    self._docs[key].update(update["$set"])
                if "$inc" in update:
                    for field, val in update["$inc"].items():
                        self._docs[key][field] = self._docs[key].get(field, 0) + val
                return

    async def find_one_and_update(self, query, update, return_document=False):
        await self.update_one(query, update)
        return await self.find_one(query)
    
    async def delete_one(self, query):
        to_delete = None
        for key, doc in self._docs.items():
             if self._matches(doc, query):
                 to_delete = key
                 break
        if to_delete:
            del self._docs[to_delete]
            class Result: pass
            res = Result()
            res.deleted_count = 1
            return res
        return None

    def _matches(self, doc, query):
        from bson import ObjectId
        for k, v in query.items():
            if k == "_id":
                if str(doc.get("_id")) != str(v):
                    return False
            elif isinstance(v, dict):
               # Basit operator destegi
               pass
            else:
                if doc.get(k) != v:
                    return False
        return True

class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, *args, **kwargs):
        if not args:
            return self
        
        # Basit siralama
        key = args[0]
        reverse = False
        if isinstance(key, tuple):
             key, order = key
             if order < 0: reverse = True
        
        self._docs.sort(key=lambda x: x.get(key, 0), reverse=reverse)
        return self

    def __aiter__(self):
        return self._iter()

    async def _iter(self):
        for doc in self._docs:
            yield doc
            
class FakeDB:
    def __init__(self):
        self._collections = {}

    def __getitem__(self, name):
        if name not in self._collections:
            self._collections[name] = FakeCollection()
        return self._collections[name]


@pytest.fixture
def mock_db():
    return FakeDB()

@pytest.fixture
def mock_product_repo(mock_db):
    from backend.database.repository import ProductRepository
    return ProductRepository(mock_db)

@pytest.fixture
def mock_history_repo(mock_db):
    from backend.database.repository import PriceHistoryRepository
    return PriceHistoryRepository(mock_db)


class TestProductRepository:

    @pytest.mark.asyncio
    async def test_create_product(self, mock_product_repo, sample_product):
        product_id = await mock_product_repo.create(sample_product)
        assert product_id is not None
        assert isinstance(product_id, str)

    @pytest.mark.asyncio
    async def test_get_by_id(self, mock_product_repo, sample_product):
        product_id = await mock_product_repo.create(sample_product)
        found = await mock_product_repo.get_by_id(product_id)
        assert found is not None
        assert found["url"] == sample_product["url"]
        assert found["id"] == product_id

    @pytest.mark.asyncio
    async def test_get_all_active(self, mock_product_repo, sample_product):
        await mock_product_repo.create(sample_product)
        products = await mock_product_repo.get_all_active()
        assert len(products) >= 1

    @pytest.mark.asyncio
    async def test_soft_delete(self, mock_product_repo, sample_product):
        product_id = await mock_product_repo.create(sample_product)
        await mock_product_repo.soft_delete(product_id)
        found = await mock_product_repo.get_by_id(product_id)
        assert found["active"] is False

    @pytest.mark.asyncio
    async def test_update_price(self, mock_product_repo, sample_product):
        product_id = await mock_product_repo.create(sample_product)
        await mock_product_repo.update_price(product_id, 199.99)
        updated = await mock_product_repo.get_by_id(product_id)
        assert updated["current_price"] == 199.99
    
    @pytest.mark.asyncio
    async def test_update_fields(self, mock_product_repo, sample_product):
         product_id = await mock_product_repo.create(sample_product)
         await mock_product_repo.update(product_id, {"target_price": 500.0})
         updated = await mock_product_repo.get_by_id(product_id)
         assert updated["target_price"] == 500.0
         
    @pytest.mark.asyncio
    async def test_get_nonexistent_product(self, mock_product_repo):
        from bson import ObjectId
        fake_id = str(ObjectId())
        found = await mock_product_repo.get_by_id(fake_id)
        assert found is None


class TestPriceHistoryRepository:
    
    @pytest.mark.asyncio
    async def test_create_history(self, mock_history_repo):
        data = {
            "product_id": "test_id",
            "price": 100.0,
            "currency": "TRY",
            "timestamp": datetime.utcnow()
        }
        hid = await mock_history_repo.create(data)
        assert hid is not None

    @pytest.mark.asyncio
    async def test_get_by_product(self, mock_history_repo):
        data = {
            "product_id": "pid_1",
            "price": 100.0,
            "currency": "TRY",
            "timestamp": datetime.utcnow()
        }
        await mock_history_repo.create(data)
        
        history = await mock_history_repo.get_by_product("pid_1")
        assert len(history) == 1
        assert history[0]["price"] == 100.0

    @pytest.mark.asyncio
    async def test_get_latest(self, mock_history_repo):
        data1 = {
             "product_id": "pid_2",
             "price": 100.0,
             "currency": "TRY",
             "timestamp": datetime.utcnow()
        }
        await mock_history_repo.create(data1)
        
        latest = await mock_history_repo.get_latest("pid_2")
        assert latest is not None
        assert latest["price"] == 100.0
