# 📦 Price Tracker & Analyzer

Trendyol, Hepsiburada ve Amazon TR ürünlerini otomatik takip eden fiyat izleme sistemi.

## Operations

Deployment and environment operations guide:

- See `OPS_RUNBOOK.md`

## 🚀 Özellikler

- **3 platform** desteği: Trendyol, Hepsiburada, Amazon TR
- **Otomatik scrape**: Günde 2 kez (09:00 & 21:00)
- **Telegram bildirimleri**: Fiyat düştüğünde veya hedef fiyata ulaşıldığında
- **Fiyat analizi**: 30 günlük ortalama, min/max, % değişim
- **Redis önbellek**: Gereksiz scrape'leri önler (6 saat TTL)
- **REST API**: FastAPI + Swagger UI

---

## ⚙️ Kurulum

### Ön Gereksinimler

- Python 3.11+
- MongoDB (Atlas veya yerel)
- Redis
- Playwright (Chromium)

### 1. Sanal ortam oluştur

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### 2. Bağımlılıkları kur

```bash
pip install -r requirements.txt
playwright install chromium
```

### 3. `.env` dosyasını yapılandır

```bash
cp .env.example .env  # ya da elle oluştur
```

`.env` içeriği:

```env
MONGO_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/?appName=price-tracker
MONGO_DB_NAME=price_tracker
REDIS_URL=redis://localhost:6379
TELEGRAM_TOKEN=<bot_token>
TELEGRAM_CHAT_ID=<chat_id>
API_KEY=<gizli_anahtar>
```

> **API_KEY** üretmek için: `python -c "import secrets; print(secrets.token_hex(32))"`

Yeni profile uyumlu örnek ayarlar dosyası:

- `.env.example` dosyasını temel alıp `.env` oluştur.

### 4. Redis'i başlat (WSL veya yerel)

```bash
sudo service redis-server start
redis-cli ping  # → PONG
```

### 5. Uygulamayı başlat

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

### 6. Health smoke kontrolü

```bash
python scripts/health_smoke.py
```

Farklı bir base URL için:

```bash
python scripts/health_smoke.py http://localhost:8000
```

---

## 🔑 API Kullanımı

Tüm isteklere `X-API-Key` header'ı ekle:

```bash
curl -H "X-API-Key: senin_api_keyin" http://localhost:8000/products
```

### Endpoint'ler

| Method   | Endpoint                 | Açıklama             |
| -------- | ------------------------ | -------------------- |
| `GET`    | `/`                      | API durum kontrolü   |
| `POST`   | `/products`              | Yeni ürün ekle       |
| `GET`    | `/products`              | Tüm ürünleri listele |
| `GET`    | `/products/{id}`         | Ürün detayı          |
| `PATCH`  | `/products/{id}`         | Ürün güncelle        |
| `DELETE` | `/products/{id}`         | Ürünü kaldır         |
| `GET`    | `/products/{id}/history` | Fiyat geçmişi        |
| `GET`    | `/products/{id}/stats`   | Fiyat istatistikleri |
| `POST`   | `/scrape/{id}`           | Manuel fiyat çek     |

---

## 🧪 Testler

```bash
# Testleri çalıştır
pytest

# Coverage raporu ile
pytest --cov=backend --cov-report=html

# HTML raporu aç
start htmlcov/index.html   # Windows
open htmlcov/index.html    # Mac/Linux
```

---

## 📁 Proje Yapısı

```
price_tracker/
├── backend/
│   ├── main.py              # FastAPI uygulaması
│   ├── analysis/
│   │   └── price_analyzer.py
│   ├── cache/
│   │   └── redis_client.py
│   ├── database/
│   │   ├── connection.py
│   │   ├── models.py
│   │   └── repository.py
│   ├── notifications/
│   │   └── telegram.py
│   ├── scheduler/
│   │   └── tasks.py
│   └── scrapers/
│       ├── base.py
│       ├── trendyol.py
│       ├── hepsiburada.py
│       ├── amazon.py
│       ├── engine.py
│       └── factory.py
├── tests/
│   ├── conftest.py
│   ├── test_price_analyzer.py
│   ├── test_clean_price.py
│   ├── test_repository.py
│   └── test_api.py
├── frontend/               # (Gün 15+ — React)
├── requirements.txt
├── pytest.ini
└── .env
```
