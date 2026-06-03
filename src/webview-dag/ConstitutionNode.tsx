import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { PhaseStatus } from '../shared/types';

export type ConstitutionNodeData = {
  status: PhaseStatus;
  artifact: string | null;
  filePath: string | null;
  onOpenFile: (path: string) => void;
};

const STATUS_ICON: Record<PhaseStatus, string> = {
  idle: '○',
  running: '◌',
  awaiting_review: '●',
  approved: '✓',
};

const STATUS_COLOR: Record<PhaseStatus, string> = {
  idle: '#6e7681',
  running: '#58a6ff',
  awaiting_review: '#f0883e',
  approved: '#3fb950',
};

const STATUS_LABEL: Record<PhaseStatus, string> = {
  idle: 'idle',
  running: 'running…',
  awaiting_review: 'review',
  approved: 'approved',
};

function ConstitutionNode({ data }: NodeProps) {
  const d = data as ConstitutionNodeData;
  const color = STATUS_COLOR[d.status];
  const isRunning = d.status === 'running';

  return (
    <div style={{
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: `2px solid ${color}`,
      borderRadius: 8,
      padding: '10px 14px',
      minWidth: 160,
      boxShadow: `0 0 0 1px ${color}22`,
      userSelect: 'none',
    }}>
      {/* Title */}
      <div style={{
        fontSize: '0.82em',
        fontWeight: 700,
        color: 'var(--vscode-foreground)',
        letterSpacing: '0.04em',
        marginBottom: 5,
        textAlign: 'center',
      }}>
        Constitution
      </div>

      {/* Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontSize: '0.72em',
        color: color,
        animation: isRunning ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }}>
        <span>{STATUS_ICON[d.status]}</span>
        <span>{STATUS_LABEL[d.status]}</span>
      </div>

      {/* Artifact */}
      {d.artifact && d.filePath && (
        <div
          className="nodrag nopan"
          onClick={(e) => { e.stopPropagation(); d.onOpenFile(d.filePath!); }}
          onPointerDown={(e) => e.stopPropagation()}
          title={`Open ${d.filePath}`}
          style={{
            marginTop: 6,
            fontSize: '0.68em',
            color: 'var(--vscode-textLink-foreground, #4daafc)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          📜 {d.artifact}
        </div>
      )}

      {/* Bottom source handle — one edge per feature */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#555', border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(ConstitutionNode);
