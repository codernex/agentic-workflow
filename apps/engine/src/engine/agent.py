import logging
import io
import sys
from typing import Dict, Any, List, Optional
from smolagents import CodeAgent, OpenAIServerModel, Tool

from config import settings

logger = logging.getLogger("engine.agent")

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
    used_model = model_name or settings.OPENROUTER_MODEL or "nvidia/nemotron-3-ultra-550b-a55b:free"

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
            max_tokens=1000
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
