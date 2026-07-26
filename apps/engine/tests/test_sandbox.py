import pytest
import asyncio
from engine.sandbox import execute_sandbox_python

@pytest.mark.asyncio
async def test_sandbox_passes_upstream_data():
    inputs = {
        "node-1": {"user_id": 42, "email": "alice@example.com"},
        "node-2": {"score": 98.5}
    }
    code = """
output = {
    'greeting': f"Hello {inputs['node-1']['email']}",
    'final_score': inputs['node-2']['score'] + 1.5,
    'direct_user': email
}
"""
    result = await execute_sandbox_python(code, inputs)
    assert result['greeting'] == "Hello alice@example.com"
    assert result['final_score'] == 100.0
    assert result['direct_user'] == "alice@example.com"

@pytest.mark.asyncio
async def test_sandbox_blocks_malicious_os_import():
    inputs = {"node-1": "test"}
    code = "import os; os.system('echo hacked')"
    with pytest.raises(RuntimeError) as exc_info:
        await execute_sandbox_python(code, inputs)
    assert "Sandbox Execution Error" in str(exc_info.value)

@pytest.mark.asyncio
async def test_sandbox_blocks_file_access():
    inputs = {}
    code = "f = open('/etc/passwd', 'r')"
    with pytest.raises(RuntimeError) as exc_info:
        await execute_sandbox_python(code, inputs)
    assert "Sandbox Execution Error" in str(exc_info.value)

@pytest.mark.asyncio
async def test_sandbox_timeout():
    inputs = {}
    code = "while True:\n    pass"
    with pytest.raises(TimeoutError) as exc_info:
        await execute_sandbox_python(code, inputs, timeout_seconds=1.0)
    assert "timed out" in str(exc_info.value)
