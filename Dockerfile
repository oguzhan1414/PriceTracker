# python:3.11-slim-bookworm = Debian 12 (Bookworm) — Trixie'deki paket ismi değişikliklerini önler
FROM python:3.11-slim-bookworm

# Tüm Playwright Chromium bağımlılıklarını elle kuruyoruz (playwright install-deps yerine)
# Trixie'de paket isimleri değişti (libasound2 → libasound2t64 vb.), bu yüzden elle yönetiyoruz
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Sadece Chromium binary'sini indir (install-deps YOK — yukarıda manuel yaptık)
RUN playwright install chromium

# Tüm proje dosyalarını kopyala
COPY . .

# /app → 'backend.main' bulunabilsin
# /app/backend → 'scrapers', 'cache', 'auth', 'database' modülleri bulunabilsin
ENV PYTHONPATH="/app:/app/backend"

# Railway $PORT env'ini dinamik okur, fallback 8000
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}