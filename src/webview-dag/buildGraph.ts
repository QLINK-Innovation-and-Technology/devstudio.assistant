import { Node, Edge } from '@xyflow/react';
import { WorkflowState, WorkflowPhase } from '../shared/types';
import { PhaseNodeData, TaskProgress } from './PhaseNode';
import { ConstitutionNodeData } from './ConstitutionNode';

const CHECKBOX_RE = /^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]/gm;

function parseTaskProgress(content: string): TaskProgress | null {
  const matches = [...content.matchAll(CHECKBOX_RE)];
  if (matches.length === 0) return null;
  return {
    done: matches.filter((m) => m[1].toLowerCase() === 'x').length,
    total: matches.length,
  };
}

// Layout constants
const NODE_W = 160;
const NODE_H = 80;
const GAP_X = 44;       // horizontal gap between phases in a row
const CONST_GAP_Y = 90; // vertical gap: constitution → first feature row
const ROW_GAP_Y = 44;   // vertical gap between feature rows

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  constitution: 'Constitution',
  specification: 'Spec',
  planning: 'Plan',
  tasks: 'Tasks',
  implementation: 'Implementation',
};

const STATUS_EDGE_COLOR: Record<string, string> = {
  idle: '#484f58',
  running: '#58a6ff',
  awaiting_review: '#f0883e',
  approved: '#3fb950',
};

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export function buildGraph(
  state: WorkflowState,
  onOpenFile: (path: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Total row width = 4 phases * NODE_W + 3 gaps
  const rowWidth = 4 * NODE_W + 3 * GAP_X;
  const constitutionX = rowWidth / 2 - NODE_W / 2;

  // Determine active phase for highlighting
  const constitutionApproved = state.constitutionPhase.status === 'approved';
  const activeFeature = state.features.find((f) => f.name === state.activeFeatureName);
  const activePhase = !constitutionApproved
    ? state.constitutionPhase
    : activeFeature?.phases.find((p) => p.status !== 'approved') ?? null;

  // ── Constitution node ──────────────────────────────────────────────────────
  const constitutionData: ConstitutionNodeData = {
    status: state.constitutionPhase.status,
    artifact: state.constitutionPhase.filePath
      ? basename(state.constitutionPhase.filePath)
      : null,
    filePath: state.constitutionPhase.filePath,
    onOpenFile,
  };

  nodes.push({
    id: 'constitution',
    type: 'constitution',
    position: { x: constitutionX, y: 0 },
    data: constitutionData as unknown as Record<string, unknown>,
    style: { width: NODE_W },
  });

  // ── Feature rows ──────────────────────────────────────────────────────────
  state.features.forEach((feature, fi) => {
    const rowY = NODE_H + CONST_GAP_Y + fi * (NODE_H + ROW_GAP_Y);

    // Parse task progress once per feature (from tasks phase content)
    const tasksContent = feature.phases.find((p) => p.phase === 'tasks')?.content ?? null;
    const taskProgress = tasksContent ? parseTaskProgress(tasksContent) : null;

    feature.phases.forEach((phase, pi) => {
      const nodeId = `${feature.name}::${phase.phase}`;
      const isFirst = pi === 0;
      const isLast = pi === feature.phases.length - 1;
      const isActive =
        activePhase?.phase === phase.phase &&
        feature.name === state.activeFeatureName;

      // Show task progress on the tasks node (total) and implementation node (done/total)
      const showProgress = phase.phase === 'tasks' || phase.phase === 'implementation';

      const nodeData: PhaseNodeData = {
        label: PHASE_LABELS[phase.phase],
        phase: phase.phase,
        status: phase.status,
        artifact: phase.filePath ? basename(phase.filePath) : null,
        filePath: phase.filePath,
        featureName: feature.name,
        isFirst,
        isLast,
        isActive,
        taskProgress: showProgress ? taskProgress : null,
        onOpenFile,
      };

      nodes.push({
        id: nodeId,
        type: 'phase',
        position: { x: pi * (NODE_W + GAP_X), y: rowY },
        data: nodeData as unknown as Record<string, unknown>,
        style: { width: NODE_W },
      });

      // Edge: Constitution → first phase of each feature
      if (isFirst) {
        edges.push({
          id: `constitution-->${nodeId}`,
          source: 'constitution',
          sourceHandle: 'bottom',
          target: nodeId,
          targetHandle: 'top',
          type: 'smoothstep',
          animated: phase.status === 'running',
          style: {
            stroke: STATUS_EDGE_COLOR[phase.status] ?? '#484f58',
            strokeWidth: 1.5,
          },
        });
      }

      // Edge: previous phase → this phase
      if (!isFirst) {
        const prevId = `${feature.name}::${feature.phases[pi - 1].phase}`;
        edges.push({
          id: `${prevId}-->${nodeId}`,
          source: prevId,
          sourceHandle: 'right',
          target: nodeId,
          targetHandle: 'left',
          type: 'smoothstep',
          animated: phase.status === 'running',
          style: {
            stroke: STATUS_EDGE_COLOR[phase.status] ?? '#484f58',
            strokeWidth: 1.5,
          },
        });
      }
    });

    // Feature label as a group annotation node
    const labelNodeId = `${feature.name}::label`;
    nodes.push({
      id: labelNodeId,
      type: 'default',
      position: { x: -140, y: NODE_H + CONST_GAP_Y + fi * (NODE_H + ROW_GAP_Y) + NODE_H / 2 - 10 },
      data: { label: feature.name },
      style: {
        background: 'transparent',
        border: 'none',
        fontSize: '0.72em',
        color: 'var(--vscode-descriptionForeground)',
        fontWeight: 600,
        width: 130,
        textAlign: 'right',
        padding: 0,
        boxShadow: 'none',
        pointerEvents: 'none',
      },
      selectable: false,
      draggable: false,
    });
  });

  return { nodes, edges };
}
