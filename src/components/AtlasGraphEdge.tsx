import { memo, type CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import { ArrowUpRight } from 'lucide-react';
import type { EdgeLabelBox } from './edgeLabelLayout';

export type AtlasFlowEdge = Edge<{
  label: string;
  active: boolean;
  accessibleLabel: string;
  labelBox?: EdgeLabelBox;
  open: (id: string) => void;
}, 'atlas'>;

export const AtlasGraphEdge = memo(function AtlasGraphEdge(props: EdgeProps<AtlasFlowEdge>) {
  const [path, anchorX, anchorY] = getBezierPath(props);
  const box = props.data?.labelBox;
  const showLabel = props.data?.active && box;
  const labelX = box ? Math.max(box.x, Math.min(anchorX, box.x + box.width)) : anchorX;
  const labelY = box ? Math.max(box.y, Math.min(anchorY, box.y + box.height)) : anchorY;
  return <>
    <BaseEdge id={props.id} path={path} markerStart={props.markerStart} markerEnd={props.markerEnd}
      style={props.style} interactionWidth={props.interactionWidth} />
    {showLabel && <>
      <path className="atlas-edge-label-leader" d={`M ${anchorX} ${anchorY} L ${labelX} ${labelY}`}
        style={{ stroke: props.style?.stroke }} aria-hidden="true" />
      <EdgeLabelRenderer>
        <button type="button" className="atlas-edge-label nodrag nopan" data-atlas-edge-id={props.id}
          style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.width, minHeight: box.height,
            '--edge-color': props.style?.stroke } as CSSProperties}
          aria-label={`查看关系证据：${props.data?.accessibleLabel}`}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); props.data?.open(props.id); }}>
          <span>{props.data?.label}</span><ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </EdgeLabelRenderer>
    </>}
  </>;
});
