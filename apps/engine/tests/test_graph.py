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
