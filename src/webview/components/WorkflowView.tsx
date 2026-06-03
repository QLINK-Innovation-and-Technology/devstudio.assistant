import React from 'react';
import { WorkflowState, WorkflowPhase, PhaseState, FeatureWorkflow, WebToExtMsg } from '../../shared/types';
import PhaseProgress from './PhaseProgress';
import PhaseCard from './PhaseCard';
import FeatureManager from './FeatureManager';
import ConsolePanel from './ConsolePanel';

interface Props {
  state: WorkflowState;
  onMessage(msg: WebToExtMsg): void;
  consoleLines: string[];
  promptOptions: string[] | null;
  onClearConsole(): void;
  onClearPrompt(): void;
}

export default function WorkflowView({
  state, onMessage, consoleLines, promptOptions, onClearConsole, onClearPrompt,
}: Props) {
  const { constitutionPhase, features, activeFeatureName } = state;

  const activeFeature: FeatureWorkflow | null =
    features.find((f) => f.name === activeFeatureName) ?? null;

  // Determine active phase: constitution first, then first non-approved feature phase
  let activePhase: PhaseState | null = null;
  if (constitutionPhase.status !== 'approved') {
    activePhase = constitutionPhase;
  } else if (activeFeature) {
    activePhase = activeFeature.phases.find((p) => p.status !== 'approved') ?? null;
  }

  const constitutionApproved = constitutionPhase.status === 'approved';
  const allDone = constitutionApproved && activeFeature !== null && activePhase === null;
  const needsFeature = constitutionApproved && activeFeature === null;

  const post = (msg: WebToExtMsg) => onMessage(msg);

  const handleRun = (phase: WorkflowPhase) => (prompt?: string) =>
    post({ type: 'runPhase', phase, prompt });

  const handleApprove = (phase: WorkflowPhase) => () =>
    post({ type: 'approvePhase', phase });

  const handleDiscard = (phase: WorkflowPhase) => () =>
    post({ type: 'discardPhase', phase });

  const handleOpenInEditor = (path: string) =>
    post({ type: 'openInEditor', path });

  const handleToggleTask = (lineIndex: number, checked: boolean) => {
    if (activeFeatureName) {
      post({ type: 'toggleTask', featureName: activeFeatureName, lineIndex, checked });
    }
  };

  return (
    <div style={root}>
      <PhaseProgress
        constitutionStatus={constitutionPhase.status}
        activeFeature={activeFeature}
      />

      {constitutionApproved && (
        <FeatureManager
          features={features}
          activeFeatureName={activeFeatureName}
          onSelect={(name) => post({ type: 'setActiveFeature', name })}
          onCreate={(name) => post({ type: 'createFeature', name })}
        />
      )}

      <div style={scrollArea}>
        {activePhase ? (
          <PhaseCard
            key={activePhase.phase + (activeFeatureName ?? '')}
            phase={activePhase}
            featureName={activeFeatureName ?? undefined}
            promptOptions={promptOptions}
            onRun={handleRun(activePhase.phase)}
            onApprove={handleApprove(activePhase.phase)}
            onDiscard={handleDiscard(activePhase.phase)}
            onOpenInEditor={handleOpenInEditor}
            onTerminalInput={(text) => { post({ type: 'terminalInput', text }); onClearPrompt(); }}
            onToggleTask={handleToggleTask}
          />
        ) : needsFeature ? (
          <div style={emptyState}>
            <p>Constitution approved.</p>
            <p style={{ marginTop: 6, opacity: 0.65 }}>
              Create a feature above to continue the workflow.
            </p>
          </div>
        ) : allDone ? (
          <div style={emptyState}>
            <p>All phases complete for <strong>{activeFeatureName}</strong>!</p>
            <p style={{ marginTop: 6, opacity: 0.65 }}>
              Create a new feature or switch to the Files tab to review your specs.
            </p>
          </div>
        ) : null}
      </div>

      <ConsolePanel
        lines={consoleLines}
        promptOptions={promptOptions}
        onSend={(text) => post({ type: 'terminalInput', text })}
        onReply={(text) => { post({ type: 'terminalInput', text }); onClearPrompt(); }}
        onClear={onClearConsole}
        onShowTerminal={() => post({ type: 'showTerminal' })}
      />
    </div>
  );
}

const root: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const scrollArea: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  paddingBottom: 8,
};

const emptyState: React.CSSProperties = {
  padding: '24px 16px',
  textAlign: 'center',
  color: 'var(--vscode-descriptionForeground)',
  fontSize: '0.85em',
  lineHeight: 1.6,
};
