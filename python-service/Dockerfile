# ============================================
# Python Analytics Service Dockerfile
# ============================================

FROM python:3.11-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /build/wheels -r requirements.txt

FROM python:3.11-slim AS production
WORKDIR /app

RUN groupadd -g 1001 worksphere && \
    useradd -u 1001 -g worksphere -s /bin/sh -m worksphere

COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache /wheels/* && rm -rf /wheels

COPY app ./app
RUN chown -R worksphere:worksphere /app

USER worksphere
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
