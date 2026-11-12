import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canPreviewPointer, resolveGraphHighlight } from '../src/components/graphInteraction.ts';
import { getGraphScope } from '../src/components/relationshipModel.ts';

const data = JSON.parse(readFileSync(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
const resolve = (pinned, preview, allowHover = true) => resolveGraphHighlight(data.nodes, data.edges, pinned, preview, allowHover);

test('mouse entry previews complete real neighbors and leaving restores the pinned node', () => {
  const pinned = 'exchange';
  const before = resolve(pinned, null);
  const hovered = resolve(pinned, { kind: 'node', id: 'data' });
  assert.equal(hovered.nodeId, 'data');
  assert.equal(hovered.edgeId, null);
  assert.deepEqual(hovered.connectedIds, new Set(['data', 'fetch', 'indicator', 'analysis', 'data-bridge']));
  assert.deepEqual(resolve(pinned, null), before);
  assert.equal(before.nodeId, pinned);
});

test('edge preview isolates its two real endpoints and retains its directed edge identity', () => {
  const edge = data.edges.find(item => item.id === 'e-fetch-data-data');
  assert.ok(edge);
  const original = { ...edge };
  const highlighted = resolve('exchange', { kind: 'edge', id: edge.id });
  assert.equal(highlighted.nodeId, null);
  assert.equal(highlighted.edgeId, edge.id);
  assert.deepEqual(highlighted.connectedIds, new Set(['fetch', 'data']));
  assert.equal(highlighted.connectedIds.has('indicator'), false);
  assert.deepEqual(edge, original, 'highlighting must not reverse or alter the source edge');
  assert.equal(resolve('exchange', null).nodeId, 'exchange');
});

test('route change discards stale previews and computes pinned neighbors only within the new route', () => {
  const scope = getGraphScope(data, 'exchange');
  const pinned = scope.route.steps[0].nodeId;
  const baseline = resolveGraphHighlight(scope.nodes, scope.edges, pinned, null, true);
  for (const preview of [{ kind: 'node', id: 'data' }, { kind: 'edge', id: 'e-fetch-data-data' }]) {
    assert.deepEqual(resolveGraphHighlight(scope.nodes, scope.edges, pinned, preview, true), baseline);
  }
  assert.equal(baseline.nodeId, pinned);
  assert.ok([...baseline.connectedIds].every(id => scope.nodes.some(node => node.id === id)));
});

test('touch mode ignores valid node and edge previews while preserving the tap-pinned component', () => {
  const baseline = resolve('data', null, false);
  for (const preview of [{ kind: 'node', id: 'exchange' }, { kind: 'edge', id: 'e-fetch-data-data' }]) {
    assert.deepEqual(resolve('data', preview, false), baseline);
  }
  assert.equal(baseline.nodeId, 'data');
  assert.equal(baseline.edgeId, null);
});

test('dangling edge previews and unknown nodes safely fall back without fabricated endpoints', () => {
  const nodes = data.nodes.filter(node => node.id === 'data');
  const baseline = { nodeId: 'data', edgeId: null, connectedIds: new Set(['data']) };
  // The supplied edges still contain fetch -> data, but fetch is outside this scope.
  assert.deepEqual(resolveGraphHighlight(nodes, data.edges, 'data', { kind: 'edge', id: 'e-fetch-data-data' }, true), baseline);
  assert.deepEqual(resolveGraphHighlight(nodes, data.edges, 'data', { kind: 'node', id: 'unknown' }, true), baseline);
  assert.deepEqual(resolveGraphHighlight(nodes, data.edges, 'unknown', null, true), { nodeId: null, edgeId: null, connectedIds: new Set() });
  assert.deepEqual(resolveGraphHighlight([], data.edges, 'data', { kind: 'node', id: 'data' }, true), { nodeId: null, edgeId: null, connectedIds: new Set() });
});

test('only unpressed mouse pointers on hover-capable devices can begin a preview', () => {
  assert.equal(canPreviewPointer({ pointerType: 'mouse', buttons: 0 }, true), true);
  for (const buttons of [1, 2, 4, 3]) {
    assert.equal(canPreviewPointer({ pointerType: 'mouse', buttons }, true), false, `button mask ${buttons} must not preview during drag`);
  }
  for (const pointerType of ['touch', 'pen', '', undefined]) {
    assert.equal(canPreviewPointer({ pointerType, buttons: 0 }, true), false, `non-mouse pointer ${pointerType}`);
  }
  assert.equal(canPreviewPointer({ pointerType: 'mouse', buttons: 0 }, false), false);
});

test('ignored touch and pen events cannot replace the existing tap-pinned highlight', () => {
  const pinned = 'data';
  const baseline = resolve(pinned, null);
  for (const event of [{ pointerType: 'touch', buttons: 0 }, { pointerType: 'pen', buttons: 0 }, { pointerType: 'mouse', buttons: 1 }]) {
    const preview = canPreviewPointer(event, true) ? { kind: 'node', id: 'exchange' } : null;
    assert.deepEqual(resolve(pinned, preview), baseline);
  }
});
