from fastapi.testclient import TestClient
from main import app



client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "engine"}

def test_builtin_tools():
    response = client.get("/api/v1/tools/builtin")
    assert response.status_code == 200
    tools = response.json()
    assert len(tools) >= 5
    assert any(t["id"] == "agent_smolagents" for t in tools)
