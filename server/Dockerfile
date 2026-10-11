# Office Lab API: FastAPI + the native converters (Gotenberg runs in its own container).
FROM debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS base

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH \
    QT_QPA_PLATFORM=offscreen \
    QTWEBENGINE_CHROMIUM_FLAGS=--no-sandbox

# calibre (ebooks), OCRmyPDF + Tesseract (Arabic, English, page orientation),
# Ghostscript, qpdf, and fonts so Arabic renders in calibre's PDFs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv ca-certificates \
        calibre ghostscript qpdf curl \
        ocrmypdf tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng tesseract-ocr-osd \
        fonts-noto-core fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# pandoc from upstream: Debian's build keeps its data files outside the binary, and --sandbox
# (which stops documents from reading server files) then can't reach them.
ARG PANDOC_VERSION=3.12.1
ARG PANDOC_SHA256=b4217ac7c54067c442f9d4cd38bcd0c184a43f3e7053431a12263a6f92a33ba2
RUN curl -fsSL -o /tmp/pandoc.deb "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-amd64.deb" \
    && echo "${PANDOC_SHA256}  /tmp/pandoc.deb" | sha256sum -c - \
    && dpkg -i /tmp/pandoc.deb && rm /tmp/pandoc.deb

COPY requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && pip install --no-cache-dir -r /tmp/requirements.txt

RUN useradd --system --uid 10001 --home-dir /work --shell /usr/sbin/nologin app \
    && mkdir -p /work/tmp && chown -R app /work
# Jobs and upload spool files live on the /work volume (the root filesystem is read-only).
ENV TMP_ROOT=/work TMPDIR=/work/tmp
COPY app /srv/app
WORKDIR /srv

# Tool tests against real converters: docker build --target test (see tests/test_tools.py).
FROM base AS test
COPY requirements-dev.txt requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements-dev.txt
COPY pytest.ini /srv/
COPY tests /srv/tests
USER app
ENV GOTENBERG_URL=http://gotenberg:3000
CMD ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider"]

FROM base
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"]
# One process: the work happens in child programs, and the concurrency limit is per process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
