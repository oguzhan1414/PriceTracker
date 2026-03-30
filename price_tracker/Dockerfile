FROM python:3.11-slim

# Playwright için sistem bağımlılıkları (Debian Bookworm uyumlu)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2-dev \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium'u indir
RUN playwright install chromium
RUN playwright install-deps chromium

# Tüm projeyi (backend dahil) içeri alıyoruz
COPY . .

# PYTHONPATH = /app altında hem backend hem scrapers bulunabilsin
ENV PYTHONPATH="/app"

# Railway dinamik PORT atar, fallback 8000
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}