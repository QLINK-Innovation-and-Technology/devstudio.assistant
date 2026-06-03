import React from 'react';
import { PhaseStatus, FeatureWorkflow, WorkflowPhase } from '../../shared/types';

interface Props {
  constitutionStatus: PhaseStatus;
  activeFeature: FeatureWorkflow | null;
}

type Step = { label: string; short: string; status: PhaseStatus };

const FEATURE_PHASES: WorkflowPhase[] = ['specification', 'planning', 'tasks', 'implementation'];

function featurePhaseStatus(feature: FeatureWorkflow | null, phase: WorkflowPhase): PhaseStatus {
  return feature?.phases.find((p) => p.phase === phase)?.status ?? 'idle';
}

function statusIcon(status: PhaseStatus): string {
  switch (status) {
    case 'idle':            return '○';
    case 'running':         return '◌';
    case 'awaiting_review': return '●';
    case 'approved':        return '✓';
  }
}

function dotColor(status: PhaseStatus): string {
  switch (status) {
    case 'approved':        return 'var(--vscode-terminal-ansiGreen, #4ec9b0)';
    case 'awaiting_review': return 'var(--vscode-textLink-foreground)';
    case 'running':         return 'var(--vscode-progressBar-background, #0e70c0)';
    default:                return 'var(--vscode-descriptionForeground)';
  }
}

export default function PhaseProgress({ constitutionStatus, activeFeature }: Props) {
  const steps: Step[] = [
    { label: 'Constitution', short: 'Const.', status: constitutionStatus },
    { label: 'Specification', short: 'Spec', status: featurePhaseStatus(activeFeature, 'specification') },
    { label: 'Planning', short: 'Plan', status: featurePhaseStatus(activeFeature, 'planning') },
    { label: 'Tasks', short: 'Tasks', status: featurePhaseStatus(activeFeature, 'tasks') },
    { label: 'Impl.', short: 'Impl.', status: featurePhaseStatus(activeFeature, 'implementation') },
  ];

  return (
    <div style={container}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div style={stepCol}>
            <span
              style={{ ...dot, color: dotColor(step.status) }}
              className={step.status === 'running' ? 'running-pulse' : undefined}
            >
              {statusIcon(step.status)}
            </span>
            <span style={labelStyle(step.status)}>{step.short}</span>
          </div>
          {i < steps.length - 1 && <div style={connector} />}
        </React.Fragment>
      ))}
    </div>
  );
}

const container: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '8px 6px 6px',
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
  overflowX: 'auto',
  flexShrink: 0,
};

const stepCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  minWidth: 44,
};

const dot: React.CSSProperties = {
  fontSize: '1em',
  lineHeight: 1,
};

function labelStyle(status: PhaseStatus): React.CSSProperties {
  return {
    fontSize: '0.62em',
    textAlign: 'center',
    opacity: status === 'idle' ? 0.35 : 1,
    color: status === 'approved' ? 'var(--vscode-terminal-ansiGreen, #4ec9b0)' : undefined,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };
}

const connector: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: 'var(--vscode-panel-border, #3a3a3a)',
  marginTop: 8,
  minWidth: 4,
};
