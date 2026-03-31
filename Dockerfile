FROM python:3.11-slim-bookworm

# Listeye loglarda hata veren 'libasound2' paketini ekledik!
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
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

# Playwright kurulumunu iki aşamaya böldük (En güvenli yol)
RUN playwright install chromium
RUN playwright install-deps chromium

COPY . .

# Python'un 'backend' klasörünü sorunsuz tanıması için yol haritası ekledik
ENV PYTHONPATH=/app

# SİNSİ entrypoint.sh DOSYASINI ÇÖPE ATTIK! 
# Sunucuyu Railway'in dinamik portuyla doğrudan ayağa kaldırıyoruz:
CMD ["sh", "-c", "cd price_tracker/backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]