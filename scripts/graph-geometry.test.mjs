import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adoptUserNodes,
  ConnectionMode,
  getEdgePosition,
  nodeHasDimensions,
  Position,
} from '@xyflow/system';
import { GRAPH_NODE_GEOMETRY } from '../src/components/graphGeometry.ts';

const edge = { id: 'source-to-target', source: 'source', target: 'target' };
const interactionStates = [
  { name: 'node hover', data: { connected: true, dimmed: false }, selected: false },
  { name: 'edge focus', data: { connected: false, dimmed: true }, selected: false },
  { name: 'node selected', data: { connected: true, dimmed: false }, selected: true },
  { name: 'pointer leaves', data: { connected: false, dimmed: false }, selected: false },
];

function createNodes(state = { data: {}, selected: false }) {
  return [edge.source, edge.target].map((id, index) => ({
    id,
    position: { x: index * (GRAPH_NODE_GEOMETRY.width + 100), y: index * 20 },
    ...GRAPH_NODE_GEOMETRY,
    selected: state.selected,
    data: { ...state.data },
  }));
}

function createMeasuredGraph() {
  const nodes = createNodes();
  const nodeLookup = new Map();
  const parentLookup = new Map();
  adoptUserNodes(nodes, nodeLookup, parentLookup, { checkEquality: true });
  // Model the DOM measurement that React Flow stores after mounting Handles.
  // Subsequent adoption and edge resolution use the real installed library.
  for (const node of nodeLookup.values()) {
    node.measured = { ...GRAPH_NODE_GEOMETRY.measured };
    node.internals.handleBounds = {
      source: [{ id: null, nodeId: node.id, type: 'source', position: Position.Right,
        x: GRAPH_NODE_GEOMETRY.width - 2.5, y: GRAPH_NODE_GEOMETRY.height / 2 - 2.5, width: 5, height: 5 }],
      target: [{ id: null, nodeId: node.id, type: 'target', position: Position.Left,
        x: -2.5, y: GRAPH_NODE_GEOMETRY.height / 2 - 2.5, width: 5, height: 5 }],
    };
  }
  return { nodes, nodeLookup, parentLookup };
}

function resolveEdge(nodeLookup) {
  return getEdgePosition({
    id: edge.id,
    sourceNode: nodeLookup.get(edge.source),
    targetNode: nodeLookup.get(edge.target),
    sourceHandle: null,
    targetHandle: null,
    connectionMode: ConnectionMode.Strict,
    onError: (code, message) => assert.fail(`${code}: ${message}`),
  });
}

test('initial graph nodes have usable dimensions before DOM measurement', () => {
  const nodeLookup = new Map();
  const result = adoptUserNodes(createNodes(), nodeLookup, new Map(), { checkEquality: true });
  assert.equal(result.nodesInitialized, true);
  for (const node of nodeLookup.values()) {
    assert.equal(nodeHasDimensions(node), true, `${node.id} must not become visibility:hidden`);
  }
});

test('new node objects preserve dimensions and measured Handles across interaction updates', () => {
  const { nodeLookup, parentLookup } = createMeasuredGraph();
  const measuredHandles = new Map([...nodeLookup].map(([id, node]) => [id, node.internals.handleBounds]));
  for (const state of interactionStates) {
    const previousNode = nodeLookup.get(edge.source);
    const result = adoptUserNodes(createNodes(state), nodeLookup, parentLookup, { checkEquality: true });
    assert.notStrictEqual(nodeLookup.get(edge.source), previousNode, 'exercise actual fresh-object adoption');
    assert.equal(result.nodesInitialized, true, state.name);
    for (const node of nodeLookup.values()) {
      assert.equal(nodeHasDimensions(node), true, `${state.name}: ${node.id} remains visible`);
      assert.strictEqual(node.internals.handleBounds, measuredHandles.get(node.id), `${state.name}: preserve ${node.id} Handles`);
    }
  }
});

test('an existing edge keeps resolvable, unchanged endpoints after every interaction update', () => {
  const { nodeLookup, parentLookup } = createMeasuredGraph();
  const initialEndpoints = resolveEdge(nodeLookup);
  assert.ok(initialEndpoints, 'mounted graph has a real source and target Handle');
  for (const coordinate of ['sourceX', 'sourceY', 'targetX', 'targetY']) {
    assert.ok(Number.isFinite(initialEndpoints[coordinate]), coordinate);
  }
  for (const state of interactionStates) {
    adoptUserNodes(createNodes(state), nodeLookup, parentLookup, { checkEquality: true });
    const endpoints = resolveEdge(nodeLookup);
    assert.ok(endpoints, `${state.name}: edge must not disappear while Handles are remeasured`);
    assert.deepEqual(endpoints, initialEndpoints, `${state.name}: interaction must not move edge endpoints`);
  }
});
