FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Copy engine pyproject.toml and uv.lock if available
COPY apps/engine/pyproject.toml apps/engine/uv.lock* /app/

# Force uv to use the container system Python (/usr/local/bin/python)
RUN uv sync --frozen --no-install-project --no-dev --python /usr/local/bin/python || uv sync --no-install-project --no-dev --python /usr/local/bin/python

FROM python:3.12-slim AS runner

WORKDIR /app/apps/engine

# Copy virtual environment
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/engine/src"

# Copy engine codebase
COPY apps/engine/alembic /app/apps/engine/alembic
COPY apps/engine/alembic.ini /app/apps/engine/alembic.ini
COPY apps/engine/pyproject.toml /app/apps/engine/pyproject.toml
COPY apps/engine/src /app/apps/engine/src

EXPOSE 9000

# Execute database migrations and launch Uvicorn on port 9000
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 9000"]
