import pytest
from engine.agent import HttpRequestTool, StepLoggerTool, EmailAlertTool, run_agent, run_smolagent

def test_langchain_tools_signature_validation():
    # 1. Test HttpRequestTool argument validation
    http_tool = HttpRequestTool(name="http_request_tool", description="HTTP API tool")
    assert http_tool.name == "http_request_tool"
    assert "payload" in http_tool.inputs

    # 2. Test StepLoggerTool argument validation
    log_tool = StepLoggerTool(name="step_logger_tool", description="Logger tool")
    assert log_tool.name == "step_logger_tool"
    assert "message" in log_tool.inputs
    log_res = log_tool.forward(message="Test log entry")
    assert "Logged observation" in log_res

    # 3. Test EmailAlertTool validation check
    email_tool = EmailAlertTool(name="email_alert_tool", description="Email tool")
    assert "recipient" in email_tool.inputs
    
    # Test validation failure
    fail_res = email_tool.forward(recipient="invalid-email", subject="hi", message="short")
    assert "Verification Failed" in fail_res

    # Test validation pass
    pass_res = email_tool.forward(recipient="test@example.com", subject="Order Confirmation", message="Your order #1042 is confirmed.")
    assert "Verification Passed" in pass_res


@pytest.mark.asyncio
async def test_langchain_agent_openai_nvidia_initialization(mocker=None):
    # Test initialization with explicit API key and base_url
    res = await run_agent(
        prompt="Hello",
        api_key="test-nvapi-key",
        model_name="deepseek-ai/deepseek-r1",
        base_url="https://integrate.api.nvidia.com/v1"
    )
    # The call will attempt agent execution with test key and return an error trace or result without crashing during model instantiation
    assert res is not None
    assert hasattr(res, "output")
    assert hasattr(res, "thought_trace")


def test_ssrf_security_guardrail():
    # Test private/loopback IP and localhost URLs are blocked
    loopback_tool = HttpRequestTool(name="http_request_tool", description="HTTP tool", url="http://127.0.0.1/admin")
    res = loopback_tool.forward()
    assert "Security Violation" in res
    assert "SSRF" in res

    metadata_tool = HttpRequestTool(name="http_request_tool", description="HTTP tool", url="http://169.254.169.254/latest/meta-data/")
    res_meta = metadata_tool.forward()
    assert "Security Violation" in res_meta


def test_email_anti_fraud_guardrail():
    email_tool = EmailAlertTool(name="email_alert_tool", description="Email tool")
    
    # Test secret exfiltration attempt
    secret_res = email_tool.forward(recipient="user@example.com", subject="System Keys", message="Here is the OPENAI_API_KEY=sk-abcdef12345678901234567890")
    assert "Security Violation" in secret_res
    assert "Exfiltration Guardrail" in secret_res

    # Test phishing attempt
    phishing_res = email_tool.forward(recipient="user@example.com", subject="Urgent Account Verification", message="Click bit.ly/scam and confirm your password immediately.")
    assert "Security Violation" in phishing_res
    assert "Anti-Fraud Guardrail" in phishing_res


@pytest.mark.asyncio
async def test_sandbox_ast_security_guardrail():
    from engine.sandbox import execute_sandbox_python

    # Test import statements blocked
    with pytest.raises(RuntimeError) as exc_info:
        await execute_sandbox_python("import os\nos.system('whoami')", inputs={})
    assert "Import statements" in str(exc_info.value)

    # Test dunder attribute access blocked
    with pytest.raises(RuntimeError) as exc_info2:
        await execute_sandbox_python("x = ''.__class__", inputs={})
    assert "dunder attribute" in str(exc_info2.value)



