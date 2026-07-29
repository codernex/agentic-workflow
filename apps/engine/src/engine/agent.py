import logging
import io
import sys
from typing import Dict, Any, List, Optional
from smolagents import CodeAgent, OpenAIServerModel, Tool

from config import settings

logger = logging.getLogger("engine.agent")

class HttpRequestTool(Tool):
    """smolagents Tool for HTTP REST API requests."""

    def __init__(self, name: str, description: str, url: str = "https://api.github.com/zen", method: str = "GET"):
        self.name = name
        self.description = description
        self.url = url
        self.method = method
        self.inputs = {"payload": {"type": "string", "description": "Input parameter or query payload for HTTP API call", "nullable": True}}
        self.output_type = "string"
        super().__init__()

    def forward(self, payload: str = "") -> str:
        import httpx
        try:
            with httpx.Client(timeout=10.0) as client:
                if self.method.upper() == "GET":
                    resp = client.get(self.url)
                else:
                    resp = client.post(self.url, json={"data": payload})
                return f"HTTP {resp.status_code}: {resp.text[:500]}"
        except Exception as ex:
            return f"HTTP Error: {str(ex)}"


class StepLoggerTool(Tool):
    """smolagents Tool for logging step observations."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.inputs = {"message": {"type": "string", "description": "Log message or data observation string", "nullable": True}}
        self.output_type = "string"
        super().__init__()

    def forward(self, message: str = "") -> str:
        logger.info(f"[Agent Tool Logger ({self.name})] {message}")
        return f"Logged observation: {message}"


class EmailAlertTool(Tool):
    """smolagents Tool for dispatching email notifications with pre-verification."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.inputs = {
            "recipient": {"type": "string", "description": "Verified target email address", "nullable": True},
            "subject": {"type": "string", "description": "Verified email subject line summarizing notification/order status", "nullable": True},
            "message": {"type": "string", "description": "Verified complete email body message content", "nullable": True}
        }
        self.output_type = "string"
        super().__init__()

    def forward(self, recipient: str = "", subject: str = "", message: str = "") -> str:
        from services.email_service import send_workflow_notification_email

        # Pre-dispatch Verification & Payload Validation
        errors = []
        if not recipient or "@" not in str(recipient) or "." not in str(recipient):
            errors.append("Invalid or missing recipient email address (must contain @ and domain)")
        if not subject or len(str(subject).strip()) < 3:
            errors.append("Missing or invalid subject line (minimum 3 characters required)")
        if not message or len(str(message).strip()) < 5:
            errors.append("Missing or incomplete message body (minimum 5 characters required)")

        if errors:
            error_msg = "; ".join(errors)
            logger.warning(f"[Agent Tool Email ({self.name})] Verification Failed: {error_msg}")
            return f"Verification Failed for Email Tool: {error_msg}. Please review input details, correct recipient, subject, or message, and retry."

        logger.info(f"[Agent Tool Email ({self.name})] Verification Passed! Dispatching email to {recipient}...")
        delivered = send_workflow_notification_email(recipient, subject, message)
        delivery_status = "Delivered via Mailtrap Inbox" if delivered else "Logged to Console Trace"
        return f"Verification Passed. Email successfully dispatched to '{recipient}' with subject '{subject}'. ({delivery_status})"

class AgentExecutionResult:
    def __init__(self, output: Any, thought_trace: str):
        self.output = output
        self.thought_trace = thought_trace

async def run_smolagent(
    prompt: str,
    tools: Optional[List[Tool]] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
) -> AgentExecutionResult:
    """Execute a smolagent reasoning loop (Thought -> Action -> Observation)."""
    tools = tools or []
    used_key = api_key or settings.OPENROUTER_API_KEY
    used_model = model_name or settings.OPENROUTER_MODEL or "nvidia/nemotron-3-embed-1b:free"

    if not used_key:
        err_msg = "OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your environment."
        logger.error(err_msg)
        return AgentExecutionResult(output=err_msg, thought_trace=f"Error: {err_msg}")

    try:
        # Configure Model instance via OpenAIServerModel (works with OpenRouter or OpenAI)
        model = OpenAIServerModel(
            model_id=used_model,
            api_base="https://openrouter.ai/api/v1",
            api_key=used_key,
            max_tokens=2000
        )

        agent = CodeAgent(
            tools=tools,
            model=model,
            max_steps=6,
            verbosity_level=1
        )

        # Capture logs/thoughts during run
        log_capture = io.StringIO()
        old_stdout = sys.stdout
        sys.stdout = log_capture

        try:
            result = agent.run(prompt)
            sys.stdout = old_stdout
            thought_trace = log_capture.getvalue()
            return AgentExecutionResult(output=result, thought_trace=thought_trace)
        except Exception as e:
            sys.stdout = old_stdout
            thought_trace = log_capture.getvalue()
            logger.error(f"Smolagent execution failed: {e}")
            return AgentExecutionResult(output=str(e), thought_trace=f"{thought_trace}\nError: {e}")

    except Exception as e:
        logger.error(f"Smolagent model initialization failed: {e}")
        return AgentExecutionResult(output=str(e), thought_trace=f"Error initializing AI model: {e}")
