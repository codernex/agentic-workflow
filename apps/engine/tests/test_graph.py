import pytest
from engine.graph import WorkflowGraph, GraphError



def test_topological_sort_valid_dag():
    nodes = [
        {"id": "node_1", "type": "trigger"},
        {"id": "node_2", "type": "agent"},
        {"id": "node_3", "type": "http_request"}
    ]
    edges = [
        {"source": "node_1", "target": "node_2"},
        {"source": "node_2", "target": "node_3"}
    ]
    graph = WorkflowGraph(nodes, edges)
    order = graph.get_topological_order()
    assert order == ["node_1", "node_2", "node_3"]

def test_graph_cycle_detection():
    nodes = [
        {"id": "a", "type": "generic"},
        {"id": "b", "type": "generic"}
    ]
    edges = [
        {"source": "a", "target": "b"},
        {"source": "b", "target": "a"}
    ]
    graph = WorkflowGraph(nodes, edges)
    with pytest.raises(GraphError):
        graph.get_topological_order()

def test_tool_edges_excluded_from_dag_dependencies():
    nodes = [
        {"id": "trigger_1", "data": {"type": "trigger"}},
        {"id": "agent_1", "data": {"type": "agent_custom"}},
        {"id": "http_tool", "data": {"type": "http_request", "isTool": True}},
        {"id": "email_tool", "data": {"type": "email", "isTool": True}}
    ]
    edges = [
        {"source": "trigger_1", "target": "agent_1", "targetHandle": "target-top"},
        {"source": "http_tool", "target": "agent_1", "targetHandle": "target-left"},
        {"source": "email_tool", "target": "agent_1", "targetHandle": "target-left"}
    ]
    graph = WorkflowGraph(nodes, edges)
    # Parents of agent_1 via main flow should only be trigger_1
    assert graph.get_parent_nodes("agent_1") == ["trigger_1"]

    # Tool nodes should be detected as tool nodes
    assert graph.is_tool_node("http_tool") is True
    assert graph.is_tool_node("email_tool") is True
    assert graph.is_tool_node("agent_1") is False
    assert graph.is_tool_node("trigger_1") is False

