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

        # Build graph adjacency list for main workflow flow edges only (excluding tool edges)
        for edge in edges:
            src = edge.get("source")
            target = edge.get("target")
            if src in self.nodes and target in self.nodes:
                if not self._is_tool_edge(edge):
                    self.adj_list[src].append(target)
                    self.in_degree[target] += 1

    def _is_tool_edge(self, edge: Dict[str, Any]) -> bool:
        """Determines if an edge represents a tool connection to an agent rather than a sequential flow step."""
        target_handle = edge.get("targetHandle")
        source_handle = edge.get("sourceHandle")

        if target_handle == "target-left" or source_handle == "source-right":
            return True

        src_id = edge.get("source")
        target_id = edge.get("target")
        src_node = self.nodes.get(src_id, {})
        target_node = self.nodes.get(target_id, {})

        src_data = src_node.get("data", {})
        target_data = target_node.get("data", {})

        if src_data.get("isTool") is True:
            return True

        target_type = target_data.get("type") or target_node.get("type", "")
        src_type = src_data.get("type") or src_node.get("type", "")

        if target_type in ("agent", "agent_custom") and src_type not in ("trigger", "webhook"):
            if target_handle and target_handle != "target-top":
                return True

        return False

    def is_tool_node(self, node_id: str) -> bool:
        """Checks if a node is dedicated as a tool node (should not run as a standalone workflow step)."""
        node = self.nodes.get(node_id, {})
        if not node:
            return False
        node_data = node.get("data", {})
        if node_data.get("isTool") is True:
            return True

        # If all outgoing edges from this node are tool edges, treat as tool node
        outgoing = [e for e in self.edges if e.get("source") == node_id]
        if outgoing and all(self._is_tool_edge(e) for e in outgoing):
            return True

        return False

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
        """Get all node IDs that directly lead into the specified node via main flow edges."""
        parents = []
        for edge in self.edges:
            if edge.get("target") == node_id and not self._is_tool_edge(edge):
                parents.append(edge.get("source"))
        return parents

