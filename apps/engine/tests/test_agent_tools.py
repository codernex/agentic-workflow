import pytest
from engine.agent import HttpRequestTool, StepLoggerTool, EmailAlertTool
from engine.executor import WorkflowExecutor

def test_smolagents_tools_signature_validation():
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
