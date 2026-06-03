import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { PhaseStatus, WorkflowPhase } from '../shared/types';

export type TaskProgress = { done: number; total: number };

export type PhaseNodeData = {
  label: string;
  phase: WorkflowPhase;
  status: PhaseStatus;
  artifact: string | null;
  filePath: string | null;
  featureName: string;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  taskProgress: TaskProgress | null;
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

function PhaseNode({ data }: NodeProps) {
  const d = data as PhaseNodeData;
  const color = STATUS_COLOR[d.status];
  const isRunning = d.status === 'running';

  return (
    <div style={{
      background: d.isActive
        ? 'var(--vscode-list-activeSelectionBackground, #094771)'
        : 'var(--vscode-editor-background, #1e1e1e)',
      border: `1.5px solid ${color}`,
      borderRadius: 6,
      padding: '8px 10px',
      minWidth: 150,
      boxShadow: d.isActive ? `0 0 0 1px ${color}` : 'none',
      cursor: 'default',
      userSelect: 'none',
    }}>
      {/* Top handle — receives edge from Constitution */}
      {d.isFirst && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ background: '#555', border: 'none', width: 8, height: 8 }}
        />
      )}

      {/* Left handle — receives edge from previous phase */}
      {!d.isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{ background: '#555', border: 'none', width: 8, height: 8 }}
        />
      )}

      {/* Phase label */}
      <div style={{
        fontSize: '0.78em',
        fontWeight: 700,
        color: 'var(--vscode-foreground)',
        letterSpacing: '0.03em',
        marginBottom: 4,
      }}>
        {d.label}
      </div>

      {/* Status row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.72em',
        color: color,
        animation: isRunning ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }}>
        <span>{STATUS_ICON[d.status]}</span>
        <span>{STATUS_LABEL[d.status]}</span>
      </div>

      {/* Task progress — shown on tasks node (total) and implementation node (done/total + bar) */}
      {d.taskProgress && d.taskProgress.total > 0 && (
        <div style={{ marginTop: 5 }}>
          {d.phase === 'implementation' && (
            <div style={{ height: 3, background: '#2a2a2a', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
              <div style={{
                height: '100%',
                width: `${Math.round((d.taskProgress.done / d.taskProgress.total) * 100)}%`,
                background: d.taskProgress.done === d.taskProgress.total ? '#3fb950' : '#58a6ff',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
          <div style={{ fontSize: '0.65em', color: '#8b949e', fontVariantNumeric: 'tabular-nums' }}>
            {d.phase === 'implementation'
              ? `${d.taskProgress.done}/${d.taskProgress.total} tasks`
              : `${d.taskProgress.total} task${d.taskProgress.total !== 1 ? 's' : ''}`}
          </div>
        </div>
      )}

      {/* Artifact link */}
      {d.artifact && d.filePath && (
        <div
          className="nodrag nopan"
          onClick={(e) => { e.stopPropagation(); d.onOpenFile(d.filePath!); }}
          onPointerDown={(e) => e.stopPropagation()}
          title={`Open ${d.filePath}`}
          style={{
            marginTop: 5,
            fontSize: '0.68em',
            color: 'var(--vscode-textLink-foreground, #4daafc)',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 130,
          }}
        >
          📄 {d.artifact}
        </div>
      )}

      {/* Right handle — sends edge to next phase */}
      {!d.isLast && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{ background: '#555', border: 'none', width: 8, height: 8 }}
        />
      )}
    </div>
  );
}

export default memo(PhaseNode);
