import time
import traceback
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models.execution import WorkflowRun, StepLog, ExecutionStatus
from models.workflow import Workflow
from engine.graph import WorkflowGraph
from engine.broadcaster import broadcaster
from engine.agent import run_smolagent

from engine.sandbox import execute_sandbox_python

logger = logging.getLogger("engine.executor")

class WorkflowExecutor:
    """Executes a Workflow run graph asynchronously step-by-step."""
    
    def __init__(self, session: AsyncSession, run_id: str):
        self.session = session
        self.run_id = run_id
        self.node_outputs: Dict[str, Any] = {}

    async def execute(self):
        # 1. Fetch WorkflowRun and Workflow
        run_statement = select(WorkflowRun).where(WorkflowRun.id == self.run_id)
        run_result = await self.session.exec(run_statement)
        workflow_run = run_result.first()

        if not workflow_run:
            logger.error(f"WorkflowRun {self.run_id} not found!")
            return

        workflow_statement = select(Workflow).where(Workflow.id == workflow_run.workflow_id)
        workflow_result = await self.session.exec(workflow_statement)
        workflow = workflow_result.first()

        if not workflow:
            workflow_run.status = ExecutionStatus.FAILED
            workflow_run.error_message = "Associated workflow model not found"
            workflow_run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.session.commit()
            return

        # Update run status to RUNNING
        workflow_run.status = ExecutionStatus.RUNNING
        await self.session.commit()
        await broadcaster.publish_event(self.run_id, "run_start", {
            "run_id": self.run_id,
            "workflow_id": workflow.id,
            "status": "running"
        })

        # 2. Build Graph and topological execution order
        try:
            graph = WorkflowGraph(workflow.nodes, workflow.edges)
            execution_order = graph.get_topological_order()
        except Exception as e:
            workflow_run.status = ExecutionStatus.FAILED
            workflow_run.error_message = f"Graph validation error: {str(e)}"
            workflow_run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.session.commit()
            await broadcaster.publish_event(self.run_id, "run_failed", {
                "run_id": self.run_id,
                "workflow_id": workflow.id,
                "error": str(e)
            }, workflow_id=workflow.id)
            return

        # 3. Step execution loop
        final_output = {}
        for node_id in execution_order:
            node = graph.nodes.get(node_id, {})
            node_data = node.get("data", {})
            node_name = node_data.get("label", node_id)
            node_type = node_data.get("type") or node.get("type", "generic")

            # Collect inputs from parent nodes or initial trigger payload
            parent_ids = graph.get_parent_nodes(node_id)
            input_data = {}
            if parent_ids:
                for parent_id in parent_ids:
                    input_data[parent_id] = self.node_outputs.get(parent_id)
            else:
                input_data = workflow_run.input_data

            # Create StepLog
            step_log = StepLog(
                run_id=self.run_id,
                node_id=node_id,
                node_name=node_name,
                node_type=node_type,
                status=ExecutionStatus.RUNNING,
                input_data=input_data
            )
            self.session.add(step_log)
            await self.session.commit()
            await self.session.refresh(step_log)

            await broadcaster.publish_event(self.run_id, "step_start", {
                "run_id": self.run_id,
                "workflow_id": workflow.id,
                "step_id": step_log.id,
                "node_id": node_id,
                "node_name": node_name,
                "node_type": node_type
            }, workflow_id=workflow.id)

            start_time = time.time()
            try:
                output, thought_trace = await self._execute_node(node, input_data)
                output = self._filter_node_output(node, output)
                execution_time = round((time.time() - start_time) * 1000, 2)

                self.node_outputs[node_id] = output
                final_output = output

                step_log.status = ExecutionStatus.COMPLETED
                step_log.output_data = {"result": output} if not isinstance(output, dict) else output
                step_log.thought_trace = thought_trace
                step_log.execution_time_ms = execution_time
                await self.session.commit()

                await broadcaster.publish_event(self.run_id, "step_completed", {
                    "run_id": self.run_id,
                    "workflow_id": workflow.id,
                    "step_id": step_log.id,
                    "node_id": node_id,
                    "output": output,
                    "thought_trace": thought_trace,
                    "execution_time_ms": execution_time
                }, workflow_id=workflow.id)
            except Exception as e:
                execution_time = round((time.time() - start_time) * 1000, 2)
                err_msg = str(e)
                trace = traceback.format_exc()

                step_log.status = ExecutionStatus.FAILED
                step_log.error_message = err_msg
                step_log.thought_trace = trace
                step_log.execution_time_ms = execution_time
                await self.session.commit()

                workflow_run.status = ExecutionStatus.FAILED
                workflow_run.error_message = f"Node '{node_name}' ({node_id}) failed: {err_msg}"
                workflow_run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
                await self.session.commit()

                await broadcaster.publish_event(self.run_id, "step_failed", {
                    "run_id": self.run_id,
                    "workflow_id": workflow.id,
                    "step_id": step_log.id,
                    "node_id": node_id,
                    "error": err_msg,
                    "traceback": trace
                }, workflow_id=workflow.id)
                return

        # 4. Workflow completion
        workflow_run.status = ExecutionStatus.COMPLETED
        workflow_run.output_data = {"result": final_output} if not isinstance(final_output, dict) else final_output
        workflow_run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.session.commit()

        await broadcaster.publish_event(self.run_id, "run_completed", {
            "run_id": self.run_id,
            "workflow_id": workflow.id,
            "output": workflow_run.output_data
        }, workflow_id=workflow.id)

    async def _execute_node(self, node: Dict[str, Any], input_data: Dict[str, Any]):
        node_data = node.get("data", {})
        node_type = node_data.get("type") or node.get("type", "generic")

        if node_type == "trigger" or node_type == "webhook":
            default_payload = node_data.get("default_payload") or node_data.get("payload")
            if default_payload:
                if isinstance(default_payload, str):
                    try:
                        import json
                        default_payload = json.loads(default_payload)
                    except Exception:
                        default_payload = {"raw": default_payload}
                if isinstance(input_data, dict) and isinstance(default_payload, dict):
                    merged = {**default_payload, **input_data}
                    return merged, f"Trigger ingested payload ({node_data.get('trigger_type', 'manual')})."
                return default_payload, "Trigger ingested configured payload."
            return input_data, f"Trigger ingested payload ({node_data.get('trigger_type', 'manual')})."

        elif node_type == "agent":
            raw_prompt = node_data.get("prompt", "Analyze the input payload and execute the requested task.")
            interpolated_prompt = self._interpolate_template(raw_prompt, input_data)
            import json
            formatted_prompt = f"{interpolated_prompt}\n\nFull Upstream Trigger & Context Data:\n{json.dumps(input_data, indent=2, default=str)}"
            agent_result = await run_smolagent(prompt=formatted_prompt)
            return agent_result.output, agent_result.thought_trace

        elif node_type == "code":
            code_snippet = node_data.get("code", "output = inputs")
            output, logs = await execute_sandbox_python(
                code_snippet,
                inputs=input_data,
                steps=self.node_outputs,
                return_logs=True
            )
            thought = "Executed Python snippet in isolated process sandbox."
            if logs:
                thought += "\n\nExecution Logs:\n" + "\n".join(logs)
            return output, thought

        elif node_type == "condition":
            code_snippet = node_data.get("code") or node_data.get("condition") or "output = bool(inputs)"
            output, logs = await execute_sandbox_python(
                code_snippet,
                inputs=input_data,
                steps=self.node_outputs,
                return_logs=True
            )
            thought = f"Condition evaluated to {output} in process sandbox."
            if logs:
                thought += "\n\nExecution Logs:\n" + "\n".join(logs)
            return {"condition_met": bool(output), "output": output}, thought

        elif node_type == "filter":
            code_snippet = node_data.get("code", "output = inputs")
            output, logs = await execute_sandbox_python(
                code_snippet,
                inputs=input_data,
                steps=self.node_outputs,
                return_logs=True
            )
            thought = "Filtered and transformed payload in process sandbox."
            if logs:
                thought += "\n\nExecution Logs:\n" + "\n".join(logs)
            return output, thought

        elif node_type in ("logger", "logger_node", "log_inspector"):
            import json
            target_nodes = node_data.get("target_nodes", [])
            logged_results = {}
            log_messages = []

            for prev_id, prev_output in self.node_outputs.items():
                if not target_nodes or prev_id in target_nodes:
                    logged_results[prev_id] = prev_output
                    log_messages.append(f"• Step [{prev_id}]: {json.dumps(prev_output, default=str)}")

            summary_text = f"Logged results from {len(logged_results)} previous step(s):\n" + ("\n".join(log_messages) if log_messages else "No previous steps found.")
            output = {
                "logged_data": logged_results,
                "summary": summary_text,
                "count": len(logged_results)
            }
            return output, summary_text

        elif node_type == "http_request":
            url = self._interpolate_template(node_data.get("url", ""), input_data)
            method = node_data.get("method", "GET").upper()
            headers = node_data.get("headers", {})
            body = node_data.get("body", {})
            if isinstance(body, dict):
                body = {k: (self._interpolate_template(v, input_data) if isinstance(v, str) else v) for k, v in body.items()}

            async with httpx.AsyncClient(timeout=30.0) as client:
                if method == "GET":
                    resp = await client.get(url, headers=headers)
                elif method == "POST":
                    resp = await client.post(url, json=body, headers=headers)
                else:
                    resp = await client.request(method, url, json=body, headers=headers)
                
                try:
                    res_data = resp.json()
                except Exception:
                    res_data = resp.text
                return {"status_code": resp.status_code, "data": res_data}, f"HTTP {method} {url} returned {resp.status_code}"

        elif node_type in ("email", "email_node", "mail"):
            import datetime
            from services.email_service import send_workflow_notification_email

            to_addr = self._interpolate_template(node_data.get("to") or node_data.get("recipient") or "user@example.com", input_data)
            subject = self._interpolate_template(node_data.get("subject") or "Workflow Event Notification", input_data)
            body = self._interpolate_template(node_data.get("body") or "Workflow executed successfully.", input_data)
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

            delivered = send_workflow_notification_email(to_addr, subject, body)

            output = {
                "status": "delivered" if delivered else "logged_mock",
                "to": to_addr,
                "subject": subject,
                "body_preview": body[:120] + ("..." if len(body) > 120 else ""),
                "delivered_via": "Mailtrap SDK Inbox" if delivered else "Console Log Trace (Set MAILTRAP_API_TOKEN for live delivery)",
                "sent_at": now_iso
            }
            thought = f"Dispatched email notification to '{to_addr}' with subject '{subject}' (Status: {'Delivered via Mailtrap SDK' if delivered else 'Captured in execution log'})."
            return output, thought

        else:
            # Fallback generic node
            return {"input": input_data, "message": f"Processed by node type '{node_type}'"}, "Generic node executed."

    def _interpolate_template(self, text: str, input_data: Dict[str, Any]) -> str:
        if not text or not isinstance(text, str):
            return text
        combined_context = {**self.node_outputs, **input_data}
        for parent_id, parent_output in combined_context.items():
            if isinstance(parent_output, dict):
                for k, v in parent_output.items():
                    text = text.replace(f"{{{parent_id}.{k}}}", str(v))
                    text = text.replace(f"{{{{{parent_id}.{k}}}}}", str(v))
                    text = text.replace(f"{{{k}}}", str(v))
                    text = text.replace(f"{{{{{k}}}}}", str(v))
        return text

    def _filter_node_output(self, node: Dict[str, Any], raw_output: Any) -> Any:
        """Filters or projects the output data forwarded to downstream nodes based on node config."""
        node_data = node.get("data", {})
        filter_mode = node_data.get("output_filter_mode", "all")

        if filter_mode == "all" or not isinstance(raw_output, dict):
            return raw_output

        elif filter_mode == "selected_keys":
            keys_str = node_data.get("output_filter_keys", "")
            if not keys_str:
                return raw_output
            keys = [k.strip() for k in keys_str.split(",") if k.strip()]
            return {k: raw_output[k] for k in keys if k in raw_output}

        elif filter_mode == "custom_mapping":
            mapping = node_data.get("output_filter_mapping", {})
            if isinstance(mapping, str):
                try:
                    import json
                    mapping = json.loads(mapping)
                except Exception:
                    mapping = {}
            if not isinstance(mapping, dict):
                return raw_output

            filtered = {}
            for target_key, src_expr in mapping.items():
                if isinstance(src_expr, str):
                    filtered[target_key] = self._interpolate_template(src_expr, {node.get("id", "node"): raw_output, **raw_output})
                else:
                    filtered[target_key] = src_expr
            return filtered

        return raw_output
