# Office Lab API: FastAPI + the native converters (Gotenberg runs in its own container).
FROM debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH \
    QT_QPA_PLATFORM=offscreen \
    QTWEBENGINE_CHROMIUM_FLAGS=--no-sandbox \
    TMP_ROOT=/work \
    TMPDIR=/work/tmp

# calibre (ebooks), pandoc, OCRmyPDF + Tesseract (Arabic, English, page orientation),
# Ghostscript, qpdf, and fonts so Arabic renders in calibre's PDFs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv ca-certificates \
        calibre pandoc ghostscript qpdf \
        ocrmypdf tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng tesseract-ocr-osd \
        fonts-noto-core fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && pip install --no-cache-dir -r /tmp/requirements.txt

RUN useradd --system --uid 10001 --home-dir /work --shell /usr/sbin/nologin app \
    && mkdir -p /work/tmp && chown -R app /work
COPY app /srv/app
WORKDIR /srv
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"]
# One process: the work happens in child programs, and the concurrency limit is per process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
