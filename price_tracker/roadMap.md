# Akıllı Fiyat Takip Sistemi

## Price Tracker & Analyzer — Geliştirme Yol Haritası

**28 Günlük Detaylı Plan · Günde 4-5 Saat**

---

### Proje Özeti

| **Süre**           | 28 gün (4 hafta)                             |
| ------------------ | -------------------------------------------- |
| **Günlük çalışma** | 4-5 saat                                     |
| **Dil & Runtime**  | Python 3.11 + Node.js (React)                |
| **Veritabanı**     | MongoDB (local → Atlas), Redis (cache)       |
| **Scraping**       | Playwright + playwright-stealth              |
| **Backend**        | FastAPI + APScheduler                        |
| **Frontend**       | React 18 + TypeScript + Tailwind + shadcn/ui |
| **Bildirim**       | Telegram Bot API                             |
| **Deploy**         | Railway + MongoDB Atlas + Redis Cloud        |
| **Docker**         | Gün 26'da öğrenilir (proje bittikten sonra)  |

---

### FAZ 1 — Local Ortam & Altyapı (Gün 1–3)

#### Gün 1 — Local ortam kurulumu + proje iskeleti

**Teknolojiler:** Python 3.11, MongoDB Community Server 7.x, MongoDB Compass, Redis (WSL/Homebrew), venv, Git

**Görevler:**

- Python 3.11'i python.org'dan indir ve kur, PATH'e eklendiğini doğrula
- MongoDB Community Server'ı mongodb.com/try/download'dan indir ve kur
- MongoDB Compass (ücretsiz GUI) ile local bağlantıyı test et: `mongodb://localhost:27017`
- Redis kur: Windows'ta WSL2 üzerinden `sudo apt install redis`, Mac'te `brew install redis`
- GitHub'da repo oluştur, klasör yapısını kur: `backend/`, `frontend/`, `tests/`
- Python venv oluştur: `python -m venv venv` → aktif et → `requirements.txt` hazırla
- `.env` dosyasını oluştur: `MONGO_URL`, `REDIS_URL`, `TELEGRAM_TOKEN` değişkenlerini ekle

**Günün Hedefi:**

> Tüm servisler local'de çalışıyor, venv aktif, ilk commit atıldı.

---

#### Gün 2 — MongoDB şema tasarımı + bağlantı katmanı

**Teknolojiler:** motor 3.x (async MongoDB driver), Pydantic v2, python-dotenv

**Görevler:**

- `pip install motor pydantic python-dotenv loguru`
- `database/models.py`: Product ve PriceHistory Pydantic modellerini yaz
  - Product alanları: url, site, name, target_price, current_price, active, currency, last_scraped_at, error_count
  - PriceHistory alanları: product_id, price, timestamp, currency, scrape_ms
- `database/repository.py`: async CRUD fonksiyonlarını yaz (insert, find, update, delete)
- MongoDB Compass'ta `price_tracker` veritabanını oluştur, index'leri ekle
- `test_db.py` scripti yaz: ürün ekle → bul → sil, sonucu Compass'ta doğrula

**Günün Hedefi:**

> Compass'ta veriyi görsel olarak görebiliyorsun, async CRUD çalışıyor.

---

#### Gün 3 — FastAPI iskelet + ilk 3 endpoint

**Teknolojiler:** fastapi, uvicorn, pytest, httpx

**Görevler:**

- `pip install fastapi uvicorn pytest httpx pytest-asyncio`
- `backend/main.py`: FastAPI uygulamasını oluştur, lifespan ile MongoDB bağlantısını yönet
- `POST /products`: URL al, site adını tespit et (trendyol.com → 'trendyol'), DB'ye kaydet
- `GET /products`: tüm `active=True` ürünleri listele
- `DELETE /products/{id}`: ürünü `active=False` yap (soft delete)
- `uvicorn main:app --reload` ile çalıştır, Swagger UI'ı aç: http://localhost:8000/docs
- pytest ile 3 endpoint için basit test yaz, hepsini geçir

**Günün Hedefi:**

> Swagger'da görünen, test edilmiş 3 endpoint. Uvicorn ile local'de çalışıyor.

---

### FAZ 2 — Scraper Motoru (Gün 4–9)

#### Gün 4 — Playwright kurulumu + BaseScraper sınıfı

**Teknolojiler:** playwright, playwright-stealth, asyncio

**Görevler:**

- `pip install playwright playwright-stealth`
- `playwright install chromium` — tarayıcıyı indir (~150MB)
- `scrapers/base.py`: soyut BaseScraper abstract class'ı yaz
- Ortak metodlar: `launch_browser()`, `close()`, `clean_price(text: str) → float`
- "1.299,90 TL" → 1299.90 ve "₺ 849" → 849.0 formatlarını işleyen regex yaz
- 10+ farklı User-Agent içeren liste oluştur, random seç
- Random bekleme utility: `asyncio.sleep(random.uniform(0.8, 3.0))`
- Basit test: Playwright ile herhangi bir URL aç, sayfa title'ını yazdır

**Günün Hedefi:**

> Browser açılıyor, price parser Türkçe formatları doğru çeviriyor.

---

#### Gün 5 — Trendyol scraper

**Teknolojiler:** playwright, json, re

**Görevler:**

- Trendyol ürün sayfasını Playwright ile aç, DevTools'da `__NEXT_DATA__` script tag'ini bul
- `page.evaluate()` ile JSON'ı çıkar: `document.getElementById('__NEXT_DATA__').textContent`
- JSON içinde fiyat path'ini bul: `product.price.discountedPrice` veya `sellingPrice`
- Ürün adını, güncel fiyatı ve orijinal fiyatı çıkar
- Tükendi / stok yok durumunu tespit et ve None döndür
- 5 farklı Trendyol URL'si ile manuel test yap, Compass'ta kayıtları gör
- `scrapers/trendyol.py` dosyasını bitir

**Günün Hedefi:**

> 5 farklı Trendyol ürününden doğru fiyat çekiyor.

---

#### Gün 6 — Hepsiburada scraper

**Teknolojiler:** playwright, asyncio

**Görevler:**

- Hepsiburada ürün sayfasını incele: DevTools ile fiyat elementini bul
- `data-testid` attribute'larını hedefle (CSS class'tan daha stabil)
- `page.wait_for_load_state("networkidle")` ile JS render'ı bekle
- Kampanyalı fiyat (kırmızı) vs liste fiyatı ayrımını yönet
- 5 farklı Hepsiburada URL'si ile test et
- `scrapers/hepsiburada.py` dosyasını bitir
- Her iki scraper için pytest integration testleri: mock HTML fixture kullan

**Günün Hedefi:**

> İki site için çalışan, test edilmiş scraperlar.

---

#### Gün 7 — Amazon TR scraper + scraper factory

**Teknolojiler:** playwright-stealth, random, asyncio

**Görevler:**

- playwright-stealth entegrasyonu: `await stealth_async(page)`
- Amazon'da fiyat elementini bul: `.a-price-whole` + `.a-price-fraction`
- "robot" kelimesi varsa None döndür ve logla (CAPTCHA tespiti)
- Amazon için çok yavaş rate: minimum 15 dakika bekleme arası uygula
- `scrapers/amazon.py` yaz
- `scrapers/factory.py`: URL'den doğru scraper'ı seçen ScraperFactory yaz
- Factory test: `trendyol.com/...` → TrendyolScraper, `hepsiburada.com/...` → HepsiburadaScraper

**Günün Hedefi:**

> URL ver, hangi scraper kullanacağını kendisi seçsin.

---

#### Gün 8 — Redis cache katmanı

**Teknolojiler:** redis[asyncio], json

**Görevler:**

- `pip install "redis[asyncio]"`
- Local Redis bağlantısını test et: `redis-cli ping` → PONG
- `cache/redis_client.py`: async Redis bağlantısını oluştur
- `get_cached(url) → dict | None` fonksiyonu yaz
- `set_cached(url, data, ttl=21600)` fonksiyonu yaz (TTL: 6 saat)
- Scraper engine'e cache kontrolü ekle: önce cache bak, yoksa scrape et
- Cache hit/miss'i logla, Redis GUI (RedisInsight) ile gözlemle

**Günün Hedefi:**

> Aynı URL 6 saat içinde tekrar scrape edilmiyor, cacheden geliyor.

---

#### Gün 9 — Scraper + DB entegrasyonu + retry mekanizması

**Teknolojiler:** motor, asyncio, loguru

**Görevler:**

- Scrape sonucunu `price_history` koleksiyonuna kaydet
- `products.current_price` ve `last_scraped_at`'ı güncelle
- 1. hata → 15dk bekle, 2. hata → 1sa bekle, 3. hata → `error_count++` (retry decorator)
- `error_count > 3` ise ürünü `active=False` yap
- loguru ile scrape loglarını hem konsola hem `logs/scraper.log` dosyasına yaz
- End-to-end test: URL ekle → manuel scrape → Compass'ta kayıtları gör
- Birden fazla ürünü sırayla scrape eden döngüyü test et

**Günün Hedefi:**

> Hata toleranslı, loglanan, veritabanına yazan tam scrape döngüsü.

---

### FAZ 3 — Otomasyon & Analiz & Bildirim (Gün 10–14)

#### Gün 10 — APScheduler ile otomatik tarama rutini

**Teknolojiler:** APScheduler 3.x, asyncio

**Görevler:**

- `pip install apscheduler`
- `scheduler/tasks.py`: AsyncIOScheduler oluştur
- `scrape_all_active_products()` job'unu yaz: DB'den tüm active ürünleri al, sırayla scrape et
- 09:00 ve 21:00 için CronTrigger ekle
- Aynı anda max 3 paralel scrape: `asyncio.Semaphore(3)`
- FastAPI lifespan'a scheduler'ı entegre et: startup'ta başlat, shutdown'da durdur
- Manuel tetikleme endpoint'i: `POST /scrape/{product_id}`
- Test: `POST /scrape/{id}` ile manuel tetikle, log'da gör

**Günün Hedefi:**

> Uygulama çalışırken sabah/akşam otomatik scrape yapıyor.

---

#### Gün 11 — Fiyat analiz motoru

**Teknolojiler:** statistics (stdlib), motor, datetime

**Görevler:**

- `analysis/price_analyzer.py` dosyasını oluştur
- `get_30day_average(product_id) → float`: son 30 günün ortalama fiyatı
- `get_price_stats(product_id) → dict`: min, max, avg, change_pct
- `is_significant_drop(product_id, threshold=0.10) → bool`: %10 düşüş var mı?
- `is_below_target(product_id) → bool`: hedef fiyatın altında mı?
- `should_notify(product_id) → bool`: ikisinden biri true ise bildirim gönder
- pytest ile edge case testleri: boş geçmiş, tek kayıt, çok eski kayıtlar

**Günün Hedefi:**

> Fiyat düşüşünü matematiksel olarak tespit eden analiz motoru.

---

#### Gün 12 — Telegram bot entegrasyonu

**Teknolojiler:** python-telegram-bot 20.x, httpx

**Görevler:**

- Telegram'da @BotFather'a `/newbot` yaz, token al
- `/start` mesajı at, `chat_id`'ni öğren: `api.telegram.org/bot{TOKEN}/getUpdates`
- `TELEGRAM_TOKEN` ve `TELEGRAM_CHAT_ID`'yi `.env`'e ekle
- `pip install python-telegram-bot`
- `notifications/telegram.py`: async `send_alert(text)` fonksiyonu yaz
- Bildirim şablonu: ürün adı, eski fiyat → yeni fiyat, tasarruf %, direkt link
- Scheduler job'una bildirim kontrolü ekle: scrape sonrası `should_notify()` çağır
- Test: fiyatı manuel olarak düşür, Telegram'da bildirimi gör

**Günün Hedefi:**

> Fiyat düştüğünde Telegram'a otomatik mesaj geliyor.

---

#### Gün 13 — Kalan API endpointleri + auth

**Teknolojiler:** FastAPI, python-jose, passlib

**Görevler:**

- `GET /products/{id}/history`: son 30 günlük fiyat listesini döndür
- `GET /products/{id}/stats`: min, max, avg, change_pct döndür
- `PATCH /products/{id}`: target_price ve active alanlarını güncelle
- `POST /scrape/{id}`: manuel scrape tetikle
- Basit API Key middleware yaz: Header'dan X-API-Key oku, .env ile karşılaştır
- Tüm endpoint'lere doğru HTTP status code'lar ekle (404, 422, 500)
- OpenAPI descriptionlarını doldur — Swagger UI güzel görünsün

**Günün Hedefi:**

> Tam dokümanlı, auth korumalı 7 endpoint.

---

#### Gün 14 — Test suite + backend temizliği

**Teknolojiler:** pytest, pytest-asyncio, pytest-cov, httpx

**Görevler:**

- pytest-asyncio ile async testleri çalıştır
- `conftest.py`: test DB bağlantısı ve fixturları hazırla
- Scraper'lar için mock HTML fixture'ları oluştur (gerçek sayfa HTML'i kaydet)
- price_analyzer fonksiyonları için unit testler: bilinen verilerle sonuçları doğrula
- pytest-cov ile coverage raporu: `pytest --cov=backend --cov-report=html`
- Tüm TODO ve print() ifadelerini temizle, loguru'ya çevir
- README.md'e backend kurulum adımlarını yaz

**Günün Hedefi:**

> %60+ test coverage, temiz ve belgelenmiş backend.

---

### FAZ 4 — React Dashboard (Gün 15–24)

#### Gün 15 — React projesi + tasarım sistemi kurulumu

**Teknolojiler:** Vite, React 18, TypeScript, Tailwind CSS 3.x, shadcn/ui

**Görevler:**

- `npm create vite@latest frontend -- --template react-ts`
- `cd frontend && npm install`
- Tailwind CSS kurulumu: `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init`
- shadcn/ui kurulumu: `npx shadcn-ui@latest init`
- React Router v6: `npm install react-router-dom`
- Temel route yapısı: `/` (dashboard), `/products` (liste), `/products/:id` (detay), `/settings`
- Layout bileşenleri: Sidebar, Header, PageWrapper
- `npm run dev` ile çalıştır, tarayıcıda gör

**Günün Hedefi:**

> Routing'li, shadcn bileşenleri hazır React uygulaması çalışıyor.

---

#### Gün 16 — API servis katmanı + TypeScript tipleri

**Teknolojiler:** TanStack Query v5, Axios

**Görevler:**

- `npm install @tanstack/react-query axios`
- `src/types/index.ts`: Product, PriceHistory, PriceStats tip tanımlarını yaz
- `src/lib/axios.ts`: Axios instance, X-API-Key interceptor, base URL env değişkeni
- `src/services/products.ts`: getProducts, addProduct, deleteProduct, updateProduct
- `src/services/history.ts`: getHistory, getStats
- `src/hooks/useProducts.ts`: TanStack Query hookları
- `src/hooks/useProductHistory.ts` ve `useProductStats.ts` hookları
- `QueryClientProvider`'ı `main.tsx`'e ekle

**Günün Hedefi:**

> Backend'e bağlanan, type-safe, cacheli API katmanı.

---

#### Gün 17 — Ürün listesi sayfası

**Teknolojiler:** shadcn/ui Table, Badge, Dialog, Button, React

**Görevler:**

- `npx shadcn-ui@latest add table badge dialog button input`
- ProductsTable bileşeni: ürün adı, site badge, güncel fiyat, hedef fiyat, son güncelleme
- Fiyat durumuna göre badge rengi: yeşil (hedef altı), sarı (%10 yakın), gri (normal)
- AddProductDialog: URL input, hedef fiyat alanı, site otomatik göster
- DeleteProduct: shadcn AlertDialog ile onay iste
- Boş durum: henüz ürün eklenmemişse yönlendirici mesaj
- useProducts hookuyla gerçek veriyi bağla, loading skeleton ekle

**Günün Hedefi:**

> Ürün ekleme, listeleme, silme çalışıyor, gerçek API verisi geliyor.

---

#### Gün 18 — Fiyat geçmişi + grafik sayfası

**Teknolojiler:** Recharts, date-fns, shadcn/ui Card

**Görevler:**

- `npm install recharts date-fns`
- ProductDetailPage bileşenini oluştur, `/products/:id` route'una bağla
- PriceChart: Recharts LineChart, X ekseni tarih, Y ekseni fiyat (TL)
- Tooltip: tarih, fiyat, bir önceki güne göre değişim yüzdesi
- Hedef fiyatı ReferenceLine ile yatay çizgi olarak göster
- StatsCards: min fiyat, max fiyat, 30 günlük ortalama, toplam değişim %
- Zaman filtresi: 7 gün / 30 gün / tümü — state ile yönet
- Geri butonu ile products listesine dön

**Günün Hedefi:**

> Fiyat grafiği ve istatistik kartları gerçek veriyle çalışıyor.

---

#### Gün 19 — Dashboard ana sayfası

**Teknolojiler:** Recharts, shadcn/ui Card, Badge, date-fns

**Görevler:**

- DashboardPage bileşenini oluştur
- Özet kartları: toplam ürün, aktif ürün, bugün taranacak, hedef altı ürün
- Son fiyat düşüşleri listesi: en son 5 bildirim tetikleyecek durum
- Sonraki otomatik tarama için geri sayım timer (setInterval)
- En ucuz ürünler özet tablosu
- Responsive grid layout: 2 sütun tablet, 4 sütun masaüstü
- Tüm sayfalarda Suspense + loading skeleton ekle

**Günün Hedefi:**

> Tek bakışta tüm durumu anlatan dashboard.

---

#### Gün 20 — Ayarlar sayfası + bildirim yönetimi

**Teknolojiler:** React Hook Form, Zod, shadcn/ui Switch, Input, Select

**Görevler:**

- `npm install react-hook-form zod @hookform/resolvers`
- `npx shadcn-ui@latest add switch select`
- SettingsPage: Telegram Chat ID girişi ve test bildirimi gönder butonu
- Bildirim tercihleri: %10 düşüşte bildir / hedef fiyatta bildir / her ikisi
- Her ürün için hedef fiyatı inline düzenle
- Zod şeması ile form validasyonu: Chat ID sayı olmalı, hedef fiyat pozitif olmalı
- `PATCH /products/{id}` endpointiyle backende kaydet

**Günün Hedefi:**

> Kullanıcı bildirim tercihlerini ve hedef fiyatları yönetebiliyor.

---

#### Gün 21 — Dark mode + UX iyileştirmeleri

**Teknolojiler:** Tailwind dark mode (class strategy), sonner (toast)

**Görevler:**

- `npm install sonner`
- Tailwind dark mode'u class strategy ile kur: `darkMode: "class"`
- Tema toggle butonu: localStorage'da tercih sakla, html'e dark class ekle/çıkar
- Toaster bileşenini layouta ekle: ürün eklendi, silindi, hata bildirimleri
- Tablo ve listede arama: client-side filter ile
- Tüm butonlarda disabled + loading state (çift tıklama önleme)
- Error boundary ekle: component crashlerde güzel hata ekranı göster

**Günün Hedefi:**

> Dark mode çalışıyor, tüm aksiyonlarda toast bildirimi var.

---

#### Gün 22 — FastAPI CORS + tam entegrasyon testi

**Teknolojiler:** FastAPI CORSMiddleware, Vite proxy

**Görevler:**

- FastAPI'ya CORSMiddleware ekle: `allow_origins=["http://localhost:5173"]`
- Alternatif: `vite.config.ts`'e proxy ayarı ekle (CORS sorunlarını dev'de bypass eder)
- Frontend ve backend'i aynı anda çalıştır, tam akışı test et
- Ürün ekle → otomatik scrape tetikle → grafik sayfasında gör
- Network tab'da gereksiz API çağrılarını bul, TanStack Query cache süresini ayarla
- Console hataları, TypeScript hataları ve ESLint uyarılarını temizle
- Mobil görünümde kritik akışları kontrol et (Chrome DevTools)

**Günün Hedefi:**

> Frontend ve backend eksiksiz birlikte çalışıyor, hata yok.

---

#### Gün 23 — Frontend build + statik dosya servisi

**Teknolojiler:** Vite build, FastAPI StaticFiles

**Görevler:**

- `npm run build` ile frontend'i derle → `dist/` klasörü oluşur
- FastAPI'ya StaticFiles ekle: `app.mount("/", StaticFiles(directory="frontend/dist", html=True))`
- Artık tek bir uvicorn komutu hem API'yi hem frontend'i serve ediyor
- http://localhost:8000 adresinde React uygulamanın açıldığını doğrula
- React Router pathleri için catch-all route ekle (404 önlemi)
- Production .env ayarlarını hazırla (debug=False, log level=WARNING)
- Tüm akışı single server modunda test et

**Günün Hedefi:**

> Tek uvicorn komutu ile hem API hem frontend çalışıyor.

---

#### Gün 24 — Frontend testleri + genel polish

**Teknolojiler:** Vitest, @testing-library/react, @testing-library/user-event

**Görevler:**

- `npm install -D vitest @testing-library/react @testing-library/user-event jsdom`
- `vite.config.ts`'e test konfigürasyonu ekle
- ProductsTable render testi: mock data ile bileşenin doğru göründüğünü doğrula
- AddProductDialog form testi: geçersiz URL'de hata gösteriyor mu?
- Lighthouse ile performance ve accessibility skoru al (hedef: 80+)
- Tüm TODO, console.log ve dead code'u temizle
- Son bir kez tüm sayfaları gezip UX sorunlarını not al ve düzelt

**Günün Hedefi:**

> Test edilmiş, temiz, production-ready frontend.

---

### FAZ 5 — Deploy & CV Hazırlığı (Gün 25–28)

#### Gün 25 — Railway deploy + cloud veritabanları

**Teknolojiler:** Railway, MongoDB Atlas (free 512MB), Redis Cloud (free 30MB)

**Görevler:**

- MongoDB Atlas'ta ücretsiz M0 cluster oluştur, IP whitelist'e 0.0.0.0/0 ekle
- Atlas'dan connection string al: `mongodb+srv://...` formatında
- Redis Cloud'da ücretsiz instance oluştur, endpoint ve şifreyi al
- Railway'de New Project → Deploy from GitHub Repo
- Railway'e environment variable'ları ekle: MONGO_URL, REDIS_URL, TELEGRAM_TOKEN, API_KEY
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Deploy loglarını takip et, health check endpointini canlıda test et

**Günün Hedefi:**

> Canlı URL'den erişilebilen çalışan sistem.

---

#### Gün 26 — Docker'a giriş + Dockerfile yazımı

**Teknolojiler:** Docker Desktop, Dockerfile, docker-compose.yml

**Görevler:**

- Docker Desktop'ı docker.com'dan indir ve kur
- Temel kavramları öğren: image, container, volume, port mapping (30dk okuma)
- Backend için Dockerfile yaz: python:3.11-slim base, requirements kopyala, app çalıştır
- Frontend için Dockerfile yaz: node build aşaması (dist üret), nginx serve aşaması
- `docker-compose.yml` yaz: backend + frontend + mongodb + redis servisleri
- `docker compose up --build` ile tüm stack'i ayağa kaldır
- http://localhost'ta uygulamayı gör — artık Docker'la da çalışıyor

**Günün Hedefi:**

> Çalışan proje şimdi Docker'la da ayağa kalkabiliyor.

---

#### Gün 27 — README + mimari dokümantasyon + demo

**Teknolojiler:** Markdown, OBS Studio veya Kap (GIF kayıt), Excalidraw (diyagram)

**Görevler:**

- README.md: proje açıklaması, özellikler listesi, ekran görüntüleri
- Canlı demo linki ve lokal kurulum adımları (hem venv hem Docker seçenekleri)
- Mimari diyagramı ekle (Excalidraw ile çiz veya bu konuşmadaki diyagramı kullan)
- Kullanılan teknolojiler tablosu ve kısa neden-seçildi açıklamaları
- Demo GIF kaydı: ürün ekle → fiyat takip → grafik → Telegram bildirimi akışı
- GIF'i optimize et (max 5MB), README'ye ekle
- GitHub'da projeyi pinle, LinkedIn'de paylaş

**Günün Hedefi:**

> İşe alım uzmanının 2 dakikada anlayacağı, demo GIF'li README.

---

#### Gün 28 — CV yazımı + son kontrol + kutlama

**Teknolojiler:** Sentry (ücretsiz tier — opsiyonel), Postman

**Görevler:**

- CV'ye proje bölümü ekle: "Trendyol, Hepsiburada ve Amazon TR'yi izleyen fiyat takip sistemi. FastAPI, React, MongoDB, Redis. Günde 2x otomatik scraping, Telegram bildirimleri."
- Sentry ücretsiz tier ile backend exception tracking ekle (opsiyonel ama etkileyici)
- Tüm kritik akışları production'da son kez test et
- Güvenlik kontrolü: API key ve token'ların .env'de olduğunu, GitHub'da olmadığını doğrula
- Bir arkadaşına veya mentora göster, kullanıcı gözüyle feedback al
- Sonraki adım fikirlerini README'ye 'Roadmap' bölümü olarak ekle

**Günün Hedefi:**

> CV'de ve GitHub'da paylaşıma hazır, production'da çalışan tam stack proje.

---

### Notlar

- Her gün için "günün hedefi" kutusunu tamamlamadan bir sonraki güne geçme.
- Takılırsan bu konuşmaya dön — her etap için kodlama yardımı almaya hazırım.
