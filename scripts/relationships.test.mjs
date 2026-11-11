import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFocusNodeId, getGraphScope, getNodeRelations } from '../src/components/relationshipModel.ts';

const data = JSON.parse(readFileSync(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
const ids = items => items.map(item => item.id).sort();

test('whole-graph scope includes all 59 nodes and 64 edges, including non-overview nodes', () => {
  const scope = getGraphScope(data, null);
  assert.equal(scope.nodes.length, 59);
  assert.equal(scope.edges.length, 64);
  assert.ok(scope.nodes.some(node => !node.overview));
  assert.deepEqual(ids(scope.nodes), ids(data.nodes));
  assert.equal(scope.route, undefined);
  assert.deepEqual(getGraphScope(data, 'unknown-route'), scope);
});

for (const route of data.routes) {
  test(`route ${route.id} strictly limits both nodes and edge IDs`, () => {
    const scope = getGraphScope(data, route.id);
    assert.strictEqual(scope.route, route);
    assert.deepEqual(ids(scope.nodes), [...route.nodeIds].sort());
    assert.deepEqual(ids(scope.edges), [...route.edgeIds].sort());
    const allowedNodes = new Set(route.nodeIds);
    const allowedEdges = new Set(route.edgeIds);
    for (const edge of scope.edges) {
      assert.ok(allowedNodes.has(edge.source) && allowedNodes.has(edge.target));
      assert.ok(allowedEdges.has(edge.id));
    }
    for (const node of scope.nodes) {
      const relations = getNodeRelations(scope.nodes, scope.edges, node.id);
      assert.deepEqual(ids(relations.incoming.map(item => item.edge)), ids(scope.edges.filter(edge => edge.target === node.id)));
      assert.deepEqual(ids(relations.outgoing.map(item => item.edge)), ids(scope.edges.filter(edge => edge.source === node.id)));
    }
    assert.equal(getFocusNodeId(scope.nodes, scope.edges, null, route), route.steps[0].nodeId);
  });
}

test('every real edge retains its direction and exact neighboring node', () => {
  for (const node of data.nodes) {
    const relations = getNodeRelations(data.nodes, data.edges, node.id);
    assert.strictEqual(relations.node, node);
    assert.deepEqual(ids(relations.incoming.map(item => item.edge)), ids(data.edges.filter(edge => edge.target === node.id)));
    assert.deepEqual(ids(relations.outgoing.map(item => item.edge)), ids(data.edges.filter(edge => edge.source === node.id)));
    for (const { edge, neighbor } of relations.incoming) {
      assert.equal(edge.target, node.id);
      assert.equal(neighbor.id, edge.source);
      assert.strictEqual(neighbor, data.nodes.find(item => item.id === edge.source));
    }
    for (const { edge, neighbor } of relations.outgoing) {
      assert.equal(edge.source, node.id);
      assert.equal(neighbor.id, edge.target);
    }
  }
});

test('real mixed-kind relations retain concept, lineage and implementation calls', () => {
  const { incoming, outgoing } = getNodeRelations(data.nodes, data.edges, 'py-factor');
  assert.deepEqual([...new Set([...incoming, ...outgoing].map(item => item.edge.kind))].sort(), ['calls', 'concept', 'lineage']);
  assert.ok(incoming.some(item => item.edge.kind === 'lineage' && item.neighbor.id === 'old-factor'));
  assert.ok(incoming.some(item => item.edge.kind === 'concept' && item.neighbor.id === 'indicator'));
  assert.ok(outgoing.some(item => item.edge.kind === 'calls' && item.neighbor.id === 'py-account'));
});

test('parallel relations to the same neighbor stay separate by edge ID and kind', () => {
  const [source, target] = data.nodes;
  const edges = ['concept', 'lineage', 'calls', 'concept'].map((kind, index) => ({
    ...data.edges[0], id: `parallel-${index}`, source: source.id, target: target.id, kind,
  }));
  const outgoing = getNodeRelations([source, target], edges, source.id).outgoing;
  const incoming = getNodeRelations([source, target], edges, target.id).incoming;
  assert.equal(outgoing.length, 4);
  assert.equal(incoming.length, 4);
  assert.deepEqual(outgoing.map(item => item.edge), edges);
  assert.deepEqual(incoming.map(item => item.edge), edges);
  assert.ok(outgoing.every(item => item.neighbor === target));
  assert.ok(incoming.every(item => item.neighbor === source));
});

test('missing focus and dangling endpoints produce no fabricated relations', () => {
  const [source, target] = data.nodes;
  const valid = { ...data.edges[0], id: 'valid', source: source.id, target: target.id };
  const edges = [valid,
    { ...valid, id: 'missing-source', source: 'absent' },
    { ...valid, id: 'missing-target', target: 'absent' },
  ];
  const nodes = [source, target];
  assert.deepEqual(getNodeRelations(nodes, edges, 'absent'), { node: null, incoming: [], outgoing: [] });
  assert.deepEqual(getNodeRelations(nodes, edges, null), { node: null, incoming: [], outgoing: [] });
  assert.deepEqual(getNodeRelations([], edges, source.id), { node: null, incoming: [], outgoing: [] });
  assert.deepEqual(getNodeRelations(nodes, edges, source.id).outgoing.map(item => item.edge.id), ['valid']);
  assert.deepEqual(getNodeRelations(nodes, edges, target.id).incoming.map(item => item.edge.id), ['valid']);
  const scope = getGraphScope({ ...data, nodes, edges }, null);
  assert.deepEqual(scope.edges, [valid]);
  const scopedRoute = { ...data.routes[0], id: 'test-route', nodeIds: [source.id], edgeIds: edges.map(edge => edge.id) };
  assert.deepEqual(getGraphScope({ ...data, nodes, edges, routes: [scopedRoute] }, 'test-route').edges, []);
});

test('focus preference uses valid choice, route steps, QAData, first node, then null', () => {
  const scope = getGraphScope(data, 'research');
  const preferred = scope.nodes.at(-1).id;
  assert.equal(getFocusNodeId(scope.nodes, scope.edges, preferred, scope.route), preferred);
  assert.equal(getFocusNodeId(scope.nodes, scope.edges, 'absent', scope.route), scope.route.steps[0].nodeId);
  const routeWithMissingStep = { ...scope.route, steps: [{ nodeId: 'absent' }, ...scope.route.steps] };
  assert.equal(getFocusNodeId(scope.nodes, scope.edges, null, routeWithMissingStep), scope.route.steps[0].nodeId);
  assert.equal(getFocusNodeId(data.nodes, data.edges, null), 'data');
  assert.equal(getFocusNodeId(data.nodes, data.edges, 'absent'), 'data');
  assert.equal(getFocusNodeId(data.nodes, [], 'cmd'), 'cmd', 'an isolated valid choice remains selectable');
  assert.equal(getFocusNodeId([data.nodes[0]], [], null), data.nodes[0].id);
  assert.equal(getFocusNodeId([], [], 'data', scope.route), null);
});
