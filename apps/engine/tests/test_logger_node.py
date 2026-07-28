import pytest
from unittest.mock import AsyncMock, MagicMock
from engine.executor import WorkflowExecutor
from models.execution import WorkflowRun, ExecutionStatus, StepLog
from models.workflow import Workflow

class MockQueryResult:
    def __init__(self, item):
        self._item = item
    def first(self):
        return self._item

class MockSession:
    def __init__(self, workflow_run: WorkflowRun, workflow: Workflow):
        self.workflow_run = workflow_run
        self.workflow = workflow
        self.added_items = []

    async def exec(self, statement):
        stmt_str = str(statement)
        if "workflow_runs" in stmt_str or "workflowrun" in stmt_str.lower():
            return MockQueryResult(self.workflow_run)
        elif "workflows" in stmt_str or "workflow" in stmt_str.lower():
            return MockQueryResult(self.workflow)
        return MockQueryResult(None)

    def add(self, item):
        self.added_items.append(item)

    async def commit(self):
        pass

    async def refresh(self, item):
        pass

@pytest.mark.asyncio
async def test_logger_node_and_codeblock_chain():
    # Create workflow with Trigger -> Logger -> Code Block
    nodes = [
        {"id": "node-1", "type": "trigger", "data": {"default_payload": {"url": "https://api.github.com/zen"}}},
        {"id": "node-2", "type": "logger", "data": {"label": "Result Logger"}},
        {
            "id": "node-3",
            "type": "code",
            "data": {
                "label": "Python Processor",
                "code": """
log("Accessing previous step log data...")
logged_count = steps['node-2']['count']
print(f"Logged {logged_count} previous steps successfully!")
output = {
    'logged_count': logged_count,
    'first_trigger_data': steps['node-1']
}
"""
            }
        }
    ]
    edges = [
        {"id": "e1-2", "source": "node-1", "target": "node-2"},
        {"id": "e2-3", "source": "node-2", "target": "node-3"}
    ]

    workflow = Workflow(
        id="wf-test-123",
        name="Test Logger Chain Workflow",
        nodes=nodes,
        edges=edges,
        created_by="test-user"
    )

    run = WorkflowRun(
        id="run-test-123",
        workflow_id=workflow.id,
        trigger_type="manual",
        input_data={"test": True}
    )

    session = MockSession(workflow_run=run, workflow=workflow)
    executor = WorkflowExecutor(session, run.id)
    await executor.execute()

    assert run.status == ExecutionStatus.COMPLETED

    # Check node 2 output (Logger Node)
    assert "node-2" in executor.node_outputs
    logger_out = executor.node_outputs["node-2"]
    assert logger_out["count"] == 1
    assert "node-1" in logger_out["logged_data"]

    # Check node 3 output (Code Node accessing previous steps and returning value)
    assert "node-3" in executor.node_outputs
    code_out = executor.node_outputs["node-3"]
    assert code_out["logged_count"] == 1
    assert code_out["first_trigger_data"] == {"test": True, "url": "https://api.github.com/zen"}
