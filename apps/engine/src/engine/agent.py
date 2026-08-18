import logging
import io
import sys
import httpx
from typing import Dict, Any, List, Optional, Type
from pydantic import BaseModel, Field

from langchain_core.tools import BaseTool
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langgraph.prebuilt import create_react_agent

from config import settings

logger = logging.getLogger("engine.agent")


# --- LangChain Input Schemas & Custom Tools ---

class HttpRequestInput(BaseModel):
    payload: Optional[str] = Field(default="", description="Input parameter or query payload for HTTP API call")


class HttpRequestTool(BaseTool):
    """LangChain Tool for HTTP REST API requests."""
    name: str = "http_request_tool"
    description: str = "Executes HTTP request and returns response"
    args_schema: Type[BaseModel] = HttpRequestInput
    url: str = "https://api.github.com/zen"
    method: str = "GET"

    def __init__(self, name: str, description: str, url: str = "https://api.github.com/zen", method: str = "GET", **kwargs):
        super().__init__(name=name, description=description, url=url, method=method, **kwargs)

    @property
    def inputs(self) -> Dict[str, Any]:
        return {"payload": {"type": "string", "description": "Input parameter or query payload for HTTP API call", "nullable": True}}

    def _run(self, payload: str = "") -> str:
        try:
            with httpx.Client(timeout=10.0) as client:
                if self.method.upper() == "GET":
                    resp = client.get(self.url)
                else:
                    resp = client.post(self.url, json={"data": payload})
                return f"HTTP {resp.status_code}: {resp.text[:500]}"
        except Exception as ex:
            return f"HTTP Error: {str(ex)}"

    def forward(self, payload: str = "") -> str:
        return self._run(payload=payload)


class StepLoggerInput(BaseModel):
    message: Optional[str] = Field(default="", description="Log message or data observation string")


class StepLoggerTool(BaseTool):
    """LangChain Tool for logging step observations."""
    name: str = "step_logger_tool"
    description: str = "Logs step observations"
    args_schema: Type[BaseModel] = StepLoggerInput

    def __init__(self, name: str, description: str, **kwargs):
        super().__init__(name=name, description=description, **kwargs)

    @property
    def inputs(self) -> Dict[str, Any]:
        return {"message": {"type": "string", "description": "Log message or data observation string", "nullable": True}}

    def _run(self, message: str = "") -> str:
        logger.info(f"[Agent Tool Logger ({self.name})] {message}")
        return f"Logged observation: {message}"

    def forward(self, message: str = "") -> str:
        return self._run(message=message)


class EmailAlertInput(BaseModel):
    recipient: Optional[str] = Field(default="", description="Verified target email address")
    subject: Optional[str] = Field(default="", description="Verified email subject line summarizing notification/order status")
    message: Optional[str] = Field(default="", description="Verified complete email body message content")


class EmailAlertTool(BaseTool):
    """LangChain Tool for dispatching email notifications with pre-verification."""
    name: str = "email_alert_tool"
    description: str = "Dispatches email alert notifications"
    args_schema: Type[BaseModel] = EmailAlertInput

    def __init__(self, name: str, description: str, **kwargs):
        super().__init__(name=name, description=description, **kwargs)

    @property
    def inputs(self) -> Dict[str, Any]:
        return {
            "recipient": {"type": "string", "description": "Verified target email address", "nullable": True},
            "subject": {"type": "string", "description": "Verified email subject line summarizing notification/order status", "nullable": True},
            "message": {"type": "string", "description": "Verified complete email body message content", "nullable": True}
        }

    def _run(self, recipient: str = "", subject: str = "", message: str = "") -> str:
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

    def forward(self, recipient: str = "", subject: str = "", message: str = "") -> str:
        return self._run(recipient=recipient, subject=subject, message=message)


class PythonSandboxInput(BaseModel):
    script_input: Optional[str] = Field(default="", description="Input argument or payload string passed into Python sandbox script execution")


class PythonSandboxTool(BaseTool):
    """LangChain Tool for executing custom Python code snippets in isolated sandbox."""
    name: str = "python_sandbox_tool"
    description: str = "Executes custom Python code in isolated sandbox and returns output result"
    args_schema: Type[BaseModel] = PythonSandboxInput
    code_snippet: str = "output = inputs"

    def __init__(self, name: str, description: str, code_snippet: str = "output = inputs", **kwargs):
        super().__init__(name=name, description=description, code_snippet=code_snippet, **kwargs)

    @property
    def inputs(self) -> Dict[str, Any]:
        return {"script_input": {"type": "string", "description": "Input payload string", "nullable": True}}

    def _run(self, script_input: str = "") -> str:
        import asyncio
        from engine.sandbox import execute_sandbox_python
        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    output, logs = pool.submit(lambda: asyncio.run(execute_sandbox_python(self.code_snippet, inputs=script_input, return_logs=True))).result(timeout=10.0)
            else:
                output, logs = asyncio.run(execute_sandbox_python(self.code_snippet, inputs=script_input, return_logs=True))

            res_str = f"Sandbox Output: {output}"
            if logs:
                res_str += "\nExecution Logs:\n" + "\n".join(logs)
            return res_str
        except Exception as ex:
            return f"Sandbox Execution Error: {str(ex)}"

    def forward(self, script_input: str = "") -> str:
        return self._run(script_input=script_input)



# --- Execution Result Data Class & Logging Utilities ---

class AgentExecutionResult:
    def __init__(self, output: Any, thought_trace: str):
        self.output = output
        self.thought_trace = thought_trace


class TeeStream:
    """Stream wrapper that writes output live to standard output while capturing trace into a buffer."""
    def __init__(self, original_stream):
        self.original_stream = original_stream
        self.buffer = io.StringIO()

    def write(self, text: str):
        if self.original_stream:
            self.original_stream.write(text)
            self.original_stream.flush()
        self.buffer.write(text)

    def flush(self):
        if self.original_stream:
            self.original_stream.flush()

    def getvalue(self) -> str:
        return self.buffer.getvalue()


# --- LangChain & LangGraph ReAct Agent Execution Loop ---

async def run_agent(
    prompt: str,
    tools: Optional[List[BaseTool]] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> AgentExecutionResult:
    """Execute a LangChain / LangGraph ReAct reasoning loop (Thought -> Action -> Observation)."""
    tools = tools or []
    used_key = api_key or getattr(settings, "OPENAI_API_KEY", None) or settings.OPENROUTER_API_KEY
    used_base_url = base_url or getattr(settings, "OPENAI_BASE_URL", None) or "https://integrate.api.nvidia.com/v1"
    
    if model_name:
        used_model = model_name
    elif getattr(settings, "OPENAI_MODEL", None):
        used_model = settings.OPENAI_MODEL
    elif "nvidia" in used_base_url.lower():
        used_model = "deepseek-ai/deepseek-r1"
    else:
        used_model = settings.OPENROUTER_MODEL or "deepseek-ai/deepseek-r1"

    if not used_key:
        err_msg = "API key is not configured. Please set OPENAI_API_KEY or OPENROUTER_API_KEY in your environment."
        logger.error(err_msg)
        return AgentExecutionResult(output=err_msg, thought_trace=f"Error: {err_msg}")

    try:
        logger.info(f"Initializing LangChain ChatNVIDIA with model '{used_model}'...")
        llm = ChatNVIDIA(
            model=used_model,
            api_key=used_key,
            max_completion_tokens=8192,
            temperature=0
        )

        logger.info("Building LangGraph ReAct agent...")
        agent_graph = create_react_agent(model=llm, tools=tools)

        thought_lines = [
            f"--- [LangGraph ReAct Agent Execution Started] ---",
            f"Model: {used_model}",
            f"Connected Tools: {[getattr(t, 'name', str(t)) for t in tools]}",
            f"User Prompt:\n{prompt[:300]}..."
        ]

        final_output = ""

        # Stream LangGraph state updates to record Thought -> Action -> Observation trace
        async for chunk in agent_graph.astream({"messages": [("user", prompt)]}, stream_mode="updates"):
            for node_name, state_update in chunk.items():
                messages = state_update.get("messages", [])
                for msg in messages:
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tool_call in msg.tool_calls:
                            t_name = tool_call.get("name")
                            t_args = tool_call.get("args")
                            thought_lines.append(f"\n[Thought & Action] Node '{node_name}' -> Executing Tool '{t_name}' with arguments:\n{t_args}")
                    elif getattr(msg, "type", "") == "tool":
                        thought_lines.append(f"\n[Observation] Tool '{getattr(msg, 'name', 'tool')}' output:\n{msg.content}")
                    elif getattr(msg, "type", "") == "ai":
                        if msg.content:
                            thought_lines.append(f"\n[Thought] Node '{node_name}' AI Response:\n{msg.content}")
                            final_output = msg.content

        thought_trace = "\n".join(thought_lines)
        logger.info("LangGraph agent execution finished successfully.")
        return AgentExecutionResult(output=final_output or "Agent finished execution.", thought_trace=thought_trace)

    except Exception as e:
        logger.error(f"LangChain / LangGraph agent execution failed: {e}")
        return AgentExecutionResult(output=str(e), thought_trace=f"Error during LangGraph agent execution: {e}")


# Backward compatibility aliases for existing engine imports
run_smolagent = run_agent
run_langchain_agent = run_agent

