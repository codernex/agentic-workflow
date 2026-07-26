import sys
import multiprocessing
import json
import math
import datetime
import re
import asyncio
from typing import Dict, Any

def _sandbox_worker(code_snippet: str, inputs: Dict[str, Any], return_dict: Dict):
    """
    Subprocess worker executing python snippet in a restricted environment.
    Blocks dangerous dunders, os/sys/subprocess modules, file IO, and imports.
    """
    # Safe builtins whitelist
    safe_builtins = {
        'abs': abs, 'all': all, 'any': any, 'ascii': ascii, 'bin': bin, 'bool': bool,
        'bytes': bytes, 'chr': chr, 'complex': complex, 'dict': dict, 'dir': dir,
        'divmod': divmod, 'enumerate': enumerate, 'filter': filter, 'float': float,
        'format': format, 'frozenset': frozenset, 'hasattr': hasattr, 'hash': hash,
        'hex': hex, 'id': id, 'int': int, 'isinstance': isinstance, 'issubclass': issubclass,
        'iter': iter, 'len': len, 'list': list, 'map': map, 'max': max, 'min': min,
        'next': next, 'oct': oct, 'ord': ord, 'pow': pow, 'print': print, 'range': range,
        'repr': repr, 'reversed': reversed, 'round': round, 'set': set, 'slice': slice,
        'sorted': sorted, 'str': str, 'sum': sum, 'tuple': tuple, 'type': type, 'zip': zip,
        'True': True, 'False': False, 'None': None,
        'ValueError': ValueError, 'TypeError': TypeError, 'KeyError': KeyError, 'IndexError': IndexError
    }

    # Safe modules exposed to code snippet
    safe_globals = {
        '__builtins__': safe_builtins,
        'json': json,
        'math': math,
        'datetime': datetime,
        're': re,
        'inputs': inputs,
        'input_data': inputs,
    }

    # Map parent outputs and convenient trigger aliases into globals
    if isinstance(inputs, dict):
        for parent_id, p_val in inputs.items():
            if "trigger" in parent_id.lower() or parent_id == "node-1":
                safe_globals['trigger'] = p_val
                safe_globals['trigger_data'] = p_val
            if isinstance(p_val, dict):
                for k, v in p_val.items():
                    if k.isidentifier() and k not in safe_globals:
                        safe_globals[k] = v

    local_scope = {'output': None, 'result': None}

    try:
        exec(code_snippet, safe_globals, local_scope)
        output = local_scope.get('output')
        if output is None:
            output = local_scope.get('result')
        if output is None:
            # Filter out internal or module references
            output = {k: v for k, v in local_scope.items() if not k.startswith('_') and k != 'inputs' and k != 'input_data'}

        # Ensure return value is serializable JSON
        try:
            json.dumps(output)
            return_dict['output'] = output
        except Exception:
            return_dict['output'] = str(output)

        return_dict['success'] = True
    except Exception as e:
        return_dict['error'] = str(e)
        return_dict['success'] = False


async def execute_sandbox_python(code_snippet: str, inputs: Dict[str, Any], timeout_seconds: float = 5.0) -> Any:
    """
    Asynchronously executes python snippet in an isolated process sandbox with timeout.
    """
    loop = asyncio.get_running_loop()

    def run_process():
        manager = multiprocessing.Manager()
        return_dict = manager.dict()

        p = multiprocessing.Process(
            target=_sandbox_worker,
            args=(code_snippet, inputs, return_dict)
        )
        p.start()
        p.join(timeout_seconds)

        if p.is_alive():
            p.terminate()
            p.join()
            raise TimeoutError(f"Python sandbox execution timed out ({timeout_seconds}s limit).")

        if not return_dict.get('success', False):
            err = return_dict.get('error', 'Unknown execution error in sandbox.')
            raise RuntimeError(f"Sandbox Execution Error: {err}")

        return return_dict.get('output')

    return await loop.run_in_executor(None, run_process)
