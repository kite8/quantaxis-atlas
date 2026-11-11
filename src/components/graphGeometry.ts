const width = 218;
const height = 144;

// Keep React Flow's measured geometry when interaction state rebuilds a node.
// The card's rendered border-box must use these same dimensions.
export const GRAPH_NODE_GEOMETRY = {
  width,
  height,
  measured: { width, height },
} as const;
