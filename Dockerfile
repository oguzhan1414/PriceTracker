FROM python:3.11-slim

# Playwright için sistem bağımlılıkları (Harika eklemişsin!)
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

# Dosyalar aynı hizada olduğu için direkt kopyalayabiliriz
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium'u indir
RUN playwright install chromium


# Tüm projeyi (backend dahil) içeri alıyoruz
COPY . .

# Python'a çalışma ortamını net bir şekilde söylüyoruz
ENV PYTHONPATH="/app:/app/price_tracker"
# Ve Fişi Takıyoruz! (backend klasörü /app içinde olduğu için şıp diye bulacak)
CMD sh -c "uvicorn backend.main:app --host 0.0.0.0 --port 8000 --loop asyncio || (cd price_tracker && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --loop asyncio)"