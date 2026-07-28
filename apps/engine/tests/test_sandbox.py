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

@pytest.mark.asyncio
async def test_sandbox_steps_and_logging():
    inputs = {"node-2": {"value": 10}}
    steps = {
        "node-1": {"status_code": 200, "data": {"user": "Alice"}},
        "node-2": {"value": 10}
    }
    code = """
log("Processing step data for", steps['node-1']['data']['user'])
print("Calculated output value:", steps['node-2']['value'] * 5)
output = {
    "user": steps['node-1']['data']['user'],
    "result_val": steps['node-2']['value'] * 5
}
"""
    output, logs = await execute_sandbox_python(code, inputs, steps=steps, return_logs=True)
    assert output["user"] == "Alice"
    assert output["result_val"] == 50
    assert len(logs) == 2
    assert "Processing step data for Alice" in logs[0]
    assert "Calculated output value: 50" in logs[1]

@pytest.mark.asyncio
async def test_sandbox_robust_dict_fuzzy_keys():
    inputs = {"node-1": {"status": "success", "count": 42}}
    # Test hyphen to underscore matching: inputs['node_1'] matches 'node-1'
    code = """
val1 = inputs['node_1']['count']
val2 = inputs['data']['status']
output = {'val1': val1, 'val2': val2}
"""
    result = await execute_sandbox_python(code, inputs)
    assert result['val1'] == 42
    assert result['val2'] == "success"
