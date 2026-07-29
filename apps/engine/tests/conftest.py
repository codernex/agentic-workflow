import pytest
from db.session import engine

@pytest.fixture(autouse=True)
async def cleanup_db_engine():
    yield
    await engine.dispose()
