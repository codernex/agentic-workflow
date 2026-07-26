from typing import List, Dict, Any, Set
from collections import defaultdict, deque

class GraphError(Exception):
    pass

class WorkflowGraph:
    """Validates DAG structure and resolves execution dependency order."""
    def __init__(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
        self.nodes = {node["id"]: node for node in nodes}
        self.edges = edges
        self.adj_list = defaultdict(list)
        self.in_degree = defaultdict(int)
        
        # Initialize in-degree for all nodes
        for node_id in self.nodes:
            self.in_degree[node_id] = 0

        # Build graph adjacency list
        for edge in edges:
            src = edge.get("source")
            target = edge.get("target")
            if src in self.nodes and target in self.nodes:
                self.adj_list[src].append(target)
                self.in_degree[target] += 1

    def get_topological_order(self) -> List[str]:
        """Returns node IDs in topological execution order using Kahn's algorithm."""
        queue = deque([node_id for node_id, degree in self.in_degree.items() if degree == 0])
        topological_order = []

        while queue:
            curr = queue.popleft()
            topological_order.append(curr)

            for neighbor in self.adj_list[curr]:
                self.in_degree[neighbor] -= 1
                if self.in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(topological_order) != len(self.nodes):
            raise GraphError("Workflow graph contains cycles or disconnected invalid loops!")

        return topological_order

    def get_parent_nodes(self, node_id: str) -> List[str]:
        """Get all node IDs that directly lead into the specified node."""
        parents = []
        for edge in self.edges:
            if edge.get("target") == node_id:
                parents.append(edge.get("source"))
        return parents
