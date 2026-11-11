FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# .dockerignore excludes frontend/dist, so the `COPY . .` above can't clobber
# the build produced in the first stage.
COPY --from=frontend-build /frontend/dist ./frontend/dist

RUN python -m rag.build_index && mkdir -p /app/data

# Render (and most PaaS hosts) inject the port to listen on via $PORT; the
# default keeps `docker run -p 8000:8000` working locally. Shell form so the
# variable is actually expanded at runtime.
ENV PORT=8000
EXPOSE 8000

RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/health', timeout=4)"

# --proxy-headers so request logs and URLs reflect the real scheme behind Render.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
