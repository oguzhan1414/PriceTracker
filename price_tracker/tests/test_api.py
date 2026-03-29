import pytest
from uuid import uuid4
from httpx import AsyncClient


async def _register_and_login(client: AsyncClient) -> dict:
    """Create an isolated user per test and establish auth cookies."""
    email = f"test_{uuid4().hex[:12]}@example.com"
    password = "Test1234!"

    register_resp = await client.post("/api/auth/register", json={"email": email, "password": password})
    assert register_resp.status_code == 201
    assert "id" in register_resp.json()

    login_resp = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200
    assert login_resp.json().get("message") == "Login successful"

    return {"email": email}


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Price Tracker API is running!"
    assert data["version"] == "2.0.0"

@pytest.mark.asyncio
async def test_add_tracked_item(client: AsyncClient):
    await _register_and_login(client)

    response = await client.post("/api/track/add", json={
        "url": "https://www.trendyol.com/test-urun-p-123456",
        "target_price": 100.0
    })

    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Product added to watchlist"
    assert "product_id" in data

@pytest.mark.asyncio
async def test_add_duplicate_product(client: AsyncClient):
    await _register_and_login(client)
    url = "https://www.trendyol.com/duplicate-test-p-999999"

    resp1 = await client.post("/api/track/add", json={
        "url": url,
        "target_price": 100.0
    })
    assert resp1.status_code == 201

    resp2 = await client.post("/api/track/add", json={
        "url": url,
        "target_price": 100.0
    })
    assert resp2.status_code == 400
    assert "already tracking" in resp2.json()["detail"]

@pytest.mark.asyncio
async def test_get_my_list(client: AsyncClient):
    await _register_and_login(client)
    add_resp = await client.post("/api/track/add", json={
        "url": "https://www.trendyol.com/list-test-p-101010",
        "target_price": 95.0
    })
    assert add_resp.status_code == 201

    response = await client.get("/api/track/my-list")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert data["toplam"] >= 1

@pytest.mark.asyncio
async def test_add_requires_auth(client: AsyncClient):
    response = await client.post("/api/auth/logout")
    assert response.status_code == 200

    unauth_resp = await client.post("/api/track/add", json={
        "url": "https://www.trendyol.com/auth-required-p-000001",
        "target_price": 42.0
    })
    assert unauth_resp.status_code == 401
    assert unauth_resp.json()["detail"] == "You need to login"

@pytest.mark.asyncio
async def test_delete_tracked_item(client: AsyncClient):
    await _register_and_login(client)

    add_resp = await client.post("/api/track/add", json={
        "url": "https://www.trendyol.com/silinecek-urun-p-777777-v2",
        "target_price": 50.0
    })
    assert add_resp.status_code == 201
    product_id = add_resp.json()["product_id"]

    list_resp = await client.get("/api/track/my-list")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    tracked_item_id = None
    for item in items:
        if item.get("product", {}).get("id") == product_id:
            tracked_item_id = item["tracked_item_id"]
            break
    assert tracked_item_id is not None

    del_resp = await client.delete(f"/api/track/remove/{tracked_item_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Tracking stopped"

    final_list_resp = await client.get("/api/track/my-list")
    assert final_list_resp.status_code == 200
    final_items = final_list_resp.json()["items"]
    assert not any(item["tracked_item_id"] == tracked_item_id for item in final_items)

@pytest.mark.asyncio
async def test_delete_tracked_item_not_found(client: AsyncClient):
    await _register_and_login(client)

    response = await client.delete("/api/track/remove/000000000000000000000000")
    assert response.status_code == 404
    assert response.json()["detail"] == "Tracking record not found"
