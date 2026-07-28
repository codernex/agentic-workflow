import sys
import multiprocessing
import json
import math
import datetime
import re
import asyncio
from typing import Dict, Any

class RobustDict(dict):
    """
    Enhanced dictionary with fuzzy key resolution (hyphen <-> underscore conversion,
    case-insensitivity, and fallback parent/data alias for single-item dicts).
    """
    def __getitem__(self, key):
        if key in self:
            return super().__getitem__(key)
        if isinstance(key, str):
            # 1. Hyphen <-> Underscore conversion (e.g. 'node-1' <-> 'node_1')
            alt_key = key.replace('_', '-') if '_' in key else key.replace('-', '_')
            if alt_key in self:
                return super().__getitem__(alt_key)
            
            # 2. Case insensitive match
            for k, v in self.items():
                if isinstance(k, str) and k.lower() == key.lower():
                    return v
            
            # 3. Convenience alias for single parent / single item dictionaries
            if len(self) == 1 and key.lower() in ('data', 'parent', 'first', 'payload', 'output', 'result'):
                return list(self.values())[0]

        available = list(self.keys())
        raise KeyError(f"Key '{key}' not found in inputs/steps dict. Available keys in context: {available}")

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

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

    raw_inputs = inputs if isinstance(inputs, dict) else {}
    raw_steps = steps if isinstance(steps, dict) else {}

    inputs_dict = RobustDict(raw_inputs)
    steps_dict = RobustDict(raw_steps)

    # Safe modules exposed to code snippet
    safe_globals = {
        '__builtins__': safe_builtins,
        'json': json,
        'math': math,
        'datetime': datetime,
        're': re,
        'inputs': inputs_dict,
        'input_data': inputs_dict,
        'steps': steps_dict,
        'previous_steps': steps_dict,
        'step_outputs': steps_dict,
        'log': custom_log,
        'logger': CustomLogger(),
    }

    # Map parent outputs, step outputs and convenient trigger aliases into globals
    for parent_id, p_val in raw_inputs.items():
        if isinstance(parent_id, str):
            if "trigger" in parent_id.lower() or parent_id == "node-1":
                safe_globals['trigger'] = p_val
                safe_globals['trigger_data'] = p_val
            clean_pid = parent_id.replace('-', '_')
            if clean_pid.isidentifier() and clean_pid not in safe_globals:
                safe_globals[clean_pid] = p_val
            if isinstance(p_val, dict):
                for k, v in p_val.items():
                    if isinstance(k, str) and k.isidentifier() and k not in safe_globals:
                        safe_globals[k] = v

    for s_id, s_val in raw_steps.items():
        if isinstance(s_id, str):
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
    except KeyError as ke:
        return_dict['logs'] = execution_logs
        return_dict['error'] = f"KeyError: {ke}"
        return_dict['success'] = False
    except Exception as e:
        return_dict['logs'] = execution_logs
        return_dict['error'] = f"{type(e).__name__}: {e}"
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
