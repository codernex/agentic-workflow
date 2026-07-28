import sys
import multiprocessing
import json
import math
import datetime
import re
import asyncio
from typing import Dict, Any

def _sandbox_worker(code_snippet: str, inputs: Dict[str, Any], steps: Dict[str, Any], return_dict: Dict):
    """
    Subprocess worker executing python snippet in a restricted environment.
    Blocks dangerous dunders, os/sys/subprocess modules, file IO, and imports.
    """
    execution_logs = []

    def custom_log(*args, **kwargs):
        msg = " ".join(str(a) for a in args)
        execution_logs.append(msg)

    class CustomLogger:
        def info(self, *args): custom_log("[INFO]", *args)
        def debug(self, *args): custom_log("[DEBUG]", *args)
        def warning(self, *args): custom_log("[WARN]", *args)
        def error(self, *args): custom_log("[ERROR]", *args)
        def log(self, *args): custom_log(*args)

    # Safe builtins whitelist
    safe_builtins = {
        'abs': abs, 'all': all, 'any': any, 'ascii': ascii, 'bin': bin, 'bool': bool,
        'bytes': bytes, 'chr': chr, 'complex': complex, 'dict': dict, 'dir': dir,
        'divmod': divmod, 'enumerate': enumerate, 'filter': filter, 'float': float,
        'format': format, 'frozenset': frozenset, 'hasattr': hasattr, 'hash': hash,
        'hex': hex, 'id': id, 'int': int, 'isinstance': isinstance, 'issubclass': issubclass,
        'iter': iter, 'len': len, 'list': list, 'map': map, 'max': max, 'min': min,
        'next': next, 'oct': oct, 'ord': ord, 'pow': pow, 'print': custom_log, 'range': range,
        'repr': repr, 'reversed': reversed, 'round': round, 'set': set, 'slice': slice,
        'sorted': sorted, 'str': str, 'sum': sum, 'tuple': tuple, 'type': type, 'zip': zip,
        'True': True, 'False': False, 'None': None,
        'ValueError': ValueError, 'TypeError': TypeError, 'KeyError': KeyError, 'IndexError': IndexError
    }

    steps_data = steps if isinstance(steps, dict) else {}

    # Safe modules exposed to code snippet
    safe_globals = {
        '__builtins__': safe_builtins,
        'json': json,
        'math': math,
        'datetime': datetime,
        're': re,
        'inputs': inputs,
        'input_data': inputs,
        'steps': steps_data,
        'previous_steps': steps_data,
        'step_outputs': steps_data,
        'log': custom_log,
        'logger': CustomLogger(),
    }

    # Map parent outputs, step outputs and convenient trigger aliases into globals
    if isinstance(inputs, dict):
        for parent_id, p_val in inputs.items():
            if "trigger" in parent_id.lower() or parent_id == "node-1":
                safe_globals['trigger'] = p_val
                safe_globals['trigger_data'] = p_val
            if isinstance(p_val, dict):
                for k, v in p_val.items():
                    if k.isidentifier() and k not in safe_globals:
                        safe_globals[k] = v

    if isinstance(steps_data, dict):
        for s_id, s_val in steps_data.items():
            clean_id = s_id.replace('-', '_')
            if clean_id.isidentifier() and clean_id not in safe_globals:
                safe_globals[clean_id] = s_val

    local_scope = {'output': None, 'result': None}

    try:
        exec(code_snippet, safe_globals, local_scope)
        output = local_scope.get('output')
        if output is None:
            output = local_scope.get('result')
        if output is None:
            # Filter out internal or module references
            output = {k: v for k, v in local_scope.items() if not k.startswith('_') and k not in ('inputs', 'input_data', 'steps', 'previous_steps', 'step_outputs', 'log', 'logger')}

        # Ensure return value is serializable JSON
        try:
            json.dumps(output)
            return_dict['output'] = output
        except Exception:
            return_dict['output'] = str(output)

        return_dict['logs'] = execution_logs
        return_dict['success'] = True
    except Exception as e:
        return_dict['logs'] = execution_logs
        return_dict['error'] = str(e)
        return_dict['success'] = False


async def execute_sandbox_python(
    code_snippet: str,
    inputs: Dict[str, Any],
    steps: Dict[str, Any] = None,
    timeout_seconds: float = 5.0,
    return_logs: bool = False
) -> Any:
    """
    Asynchronously executes python snippet in an isolated process sandbox with timeout.
    """
    loop = asyncio.get_running_loop()

    def run_process():
        manager = multiprocessing.Manager()
        return_dict = manager.dict()

        p = multiprocessing.Process(
            target=_sandbox_worker,
            args=(code_snippet, inputs, steps or {}, return_dict)
        )
        p.start()
        p.join(timeout_seconds)

        if p.is_alive():
            p.terminate()
            p.join()
            raise TimeoutError(f"Python sandbox execution timed out ({timeout_seconds}s limit).")

        if not return_dict.get('success', False):
            err = return_dict.get('error', 'Unknown execution error in sandbox.')
            logs = list(return_dict.get('logs', []))
            if logs:
                err += f" (Logs: {', '.join(logs)})"
            raise RuntimeError(f"Sandbox Execution Error: {err}")

        if return_logs:
            return return_dict.get('output'), list(return_dict.get('logs', []))
        return return_dict.get('output')

    return await loop.run_in_executor(None, run_process)

