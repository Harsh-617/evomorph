from __future__ import annotations


class InnovationTracker:
    """
    Tracks all structural mutations that have ever occurred.
    If the same structural mutation happens independently in two genomes
    within the same generation, they get the same innovation number.
    History is cleared each generation so identical mutations across
    generations receive distinct IDs.
    """

    def __init__(self) -> None:
        self.counter: int = 0
        # (in_node, out_node, conn_type) | ("NODE_SPLIT", in_node, out_node) → id
        self.history: dict = {}

    def get_innovation(self, in_node: int, out_node: int, conn_type: str) -> int:
        key = (in_node, out_node, conn_type)
        if key not in self.history:
            self.history[key] = self.counter
            self.counter += 1
        return self.history[key]

    def get_node_id(self, original_in_node: int, original_out_node: int) -> int:
        """Consistent gene_id for a hidden node inserted by splitting a connection."""
        key = ("NODE_SPLIT", original_in_node, original_out_node)
        if key not in self.history:
            self.history[key] = self.counter
            self.counter += 1
        return self.history[key]

    def next_id(self) -> int:
        """Allocate a fresh globally-unique ID (for nodes without a canonical key)."""
        idx = self.counter
        self.counter += 1
        return idx

    def reset_generation(self) -> None:
        """Clear per-generation history while keeping the counter monotonically increasing."""
        self.history = {}
