FROM python:3.11-slim

# Playwright için sistem bağımlılıkları
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
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium'u indir
RUN playwright install chromium

COPY . .

# DEDEKTİF KOMUTU: Sunucuya nelerin kopyalandığını build loglarına yazdırır
RUN ls -la

ENV PYTHONPATH="/app"

# DÜZELTİLMİŞ BAŞLATMA KOMUTU: uvicorn yerine python -m uvicorn kullanıyoruz
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]