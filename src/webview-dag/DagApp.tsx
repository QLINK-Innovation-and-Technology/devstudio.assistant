import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ExtToWebMsg, WebToExtMsg, WorkflowState } from '../shared/types';
import PhaseNode from './PhaseNode';
import ConstitutionNode from './ConstitutionNode';
import { buildGraph } from './buildGraph';

declare function acquireVsCodeApi(): { postMessage(msg: WebToExtMsg): void };
const vscode = acquireVsCodeApi();

const nodeTypes: NodeTypes = {
  phase: PhaseNode as never,
  constitution: ConstitutionNode as never,
};

const STATUS_LEGEND = [
  { color: '#6e7681', label: 'Idle' },
  { color: '#58a6ff', label: 'Running' },
  { color: '#f0883e', label: 'Awaiting review' },
  { color: '#3fb950', label: 'Approved' },
];

export default function DagApp() {
  const [state, setState] = useState<WorkflowState | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtToWebMsg;
      if (msg.type === 'workflowState') {
        setState(msg.state);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleOpenFile = useCallback((filePath: string) => {
    vscode.postMessage({ type: 'openInEditor', path: filePath });
  }, []);

  const { nodes, edges } = useMemo(
    () => state ? buildGraph(state, handleOpenFile) : { nodes: [], edges: [] },
    [state, handleOpenFile],
  );

  if (!state) {
    return (
      <div style={loadingStyle}>
        Loading workflow…
      </div>
    );
  }

  if (state.features.length === 0 && state.constitutionPhase.status === 'idle') {
    return (
      <div style={loadingStyle}>
        No workflow started yet. Use the DevStudio Assistant sidebar to begin.
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--vscode-editor-background)' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .react-flow__node { cursor: default !important; }
        .react-flow__controls button {
          background: var(--vscode-button-secondaryBackground, #3a3d41) !important;
          color: var(--vscode-button-secondaryForeground, #cccccc) !important;
          border-color: var(--vscode-panel-border, #454545) !important;
        }
        .react-flow__minimap {
          background: var(--vscode-sideBar-background, #252526) !important;
          border: 1px solid var(--vscode-panel-border, #454545);
          border-radius: 4px;
        }
      `}</style>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--vscode-panel-border, #3a3a3a)"
          gap={22}
          size={1}
        />

        <Controls showInteractive={false} />

        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as { status?: string }).status ?? 'idle';
            const colors: Record<string, string> = {
              idle: '#484f58',
              running: '#58a6ff',
              awaiting_review: '#f0883e',
              approved: '#3fb950',
            };
            return colors[status] ?? '#484f58';
          }}
          maskColor="rgba(0,0,0,0.4)"
        />

        {/* Legend panel */}
        <Panel position="top-right">
          <div style={legendStyle}>
            <div style={{ fontSize: '0.7em', fontWeight: 700, marginBottom: 6, opacity: 0.6 }}>
              PHASE STATUS
            </div>
            {STATUS_LEGEND.map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.72em' }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #444', fontSize: '0.68em', opacity: 0.5 }}>
              Click 📄 to open artifact
            </div>
          </div>
        </Panel>

        {/* Project title */}
        <Panel position="top-left">
          <div style={titleStyle}>
            DevStudio Workflow Map
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  color: 'var(--vscode-descriptionForeground)',
  fontSize: '0.9em',
};

const legendStyle: React.CSSProperties = {
  background: 'var(--vscode-sideBar-background, #252526)',
  border: '1px solid var(--vscode-panel-border, #454545)',
  borderRadius: 6,
  padding: '10px 12px',
  color: 'var(--vscode-foreground)',
  minWidth: 140,
};

const titleStyle: React.CSSProperties = {
  background: 'var(--vscode-sideBar-background, #252526)',
  border: '1px solid var(--vscode-panel-border, #454545)',
  borderRadius: 6,
  padding: '6px 12px',
  color: 'var(--vscode-foreground)',
  fontSize: '0.8em',
  fontWeight: 700,
  letterSpacing: '0.05em',
  opacity: 0.85,
};
