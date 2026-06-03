import React, { useState } from 'react';
import { PhaseState, WorkflowPhase } from '../../shared/types';
import MarkdownViewer from './MarkdownViewer';
import TaskChecklist from './TaskChecklist';

interface Props {
  phase: PhaseState;
  featureName?: string;
  promptOptions?: string[] | null;
  onRun(prompt?: string): void;
  onApprove(): void;
  onDiscard(): void;
  onOpenInEditor(path: string): void;
  onTerminalInput(text: string): void;
  onToggleTask(lineIndex: number, checked: boolean): void;
}

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  constitution: 'Constitution',
  specification: 'Specification',
  planning: 'Planning',
  tasks: 'Tasks',
  implementation: 'Implementation',
};

const PHASE_DESC: Record<WorkflowPhase, string> = {
  constitution: 'Generate architectural principles and project constitution.',
  specification: 'Generate the feature specification (spec.md).',
  planning: 'Generate the technical plan (plan.md).',
  tasks: 'Generate the task breakdown (tasks.md).',
  implementation: 'Run the implementation phase.',
};

const CLARIFICATION_LABEL: Partial<Record<WorkflowPhase, string>> = {
  specification:  'Feature description',
  planning:       'Technical context',
  tasks:          'Task preferences',
  implementation: 'Implementation notes',
};

const CLARIFICATION_PLACEHOLDER: Partial<Record<WorkflowPhase, string>> = {
  specification:  'Describe the feature you want to build — goals, scope, user stories…',
  planning:       'Add technical constraints, architecture preferences or stack notes…',
  tasks:          'Specify task granularity, any steps to skip or expand on…',
  implementation: 'Implementation guidelines, patterns or conventions to follow…',
};

// ── Feature 3: Templates de clarification ─────────────────────────────────────
const CLARIFICATION_TEMPLATE: Partial<Record<WorkflowPhase, string>> = {
  specification: `## Goal
Describe the main goal of this feature.

## User persona
Who will use this feature?

## Acceptance criteria
- [ ]
- [ ]

## Out of scope
- `,
  planning: `## Stack & constraints
List languages, frameworks, or infra constraints.

## Architecture approach
Describe the high-level design.

## Key dependencies
-

## Open questions
- `,
  tasks: `## Task preferences
Granularity: fine-grained

## Steps to expand
-

## Steps to skip
- none`,
  implementation: `## Patterns to follow


## Conventions


## Do not change
- `,
};

const QUICK_REPLIES_FALLBACK = ['y', 'n', '↵'];

export default function PhaseCard({
  phase, featureName, promptOptions = null,
  onRun, onApprove, onDiscard, onOpenInEditor, onTerminalInput, onToggleTask,
}: Props) {
  const [clarification, setClarification] = useState('');
  const [refinements, setRefinements] = useState('');
  const [termInput, setTermInput] = useState('');

  const hasPrompt = promptOptions !== null && promptOptions !== undefined && promptOptions.length > 0;
  const quickReplies = hasPrompt ? promptOptions! : QUICK_REPLIES_FALLBACK;
  const isRunning = phase.status === 'running';
  const hasContent = phase.content != null;
  const isFeaturePhase = phase.phase !== 'constitution';
  const isTasksPhase = phase.phase === 'tasks';
  const canApprove = phase.status === 'awaiting_review';
  const canDiscard = phase.status !== 'idle';
  const showTermInput = phase.status === 'running' || phase.status === 'awaiting_review';
  const showClarification = isFeaturePhase && phase.status !== 'approved';
  const showRefinements = phase.status === 'awaiting_review';
  const template = CLARIFICATION_TEMPLATE[phase.phase];

  const handleRun = () => {
    const parts = [clarification.trim(), refinements.trim()].filter(Boolean);
    onRun(parts.length > 0 ? parts.join('\n\n') : undefined);
    setRefinements('');
  };

  const handleTermSend = () => {
    onTerminalInput(termInput);
    setTermInput('');
  };

  const handleTermKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTermSend(); }
  };

  const handleUseTemplate = () => {
    if (template) setClarification(template);
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={header}>
        <div style={{ flex: 1 }}>
          <div style={titleStyle}>{PHASE_LABELS[phase.phase]}</div>
          <div style={statusBar(phase.status)} />
        </div>
        {phase.filePath && (
          <button style={editorBtn} title="Open in editor" onClick={() => onOpenInEditor(phase.filePath!)}>
            ↗
          </button>
        )}
      </div>

      {/* Feature 1: Stale warning banner */}
      {phase.stale && (
        <div style={staleBanner}>
          ⚠ An earlier phase was re-run — this approved output may be outdated. Consider re-running.
        </div>
      )}

      {/* Status line */}
      <div style={statusDesc}>
        {phase.status === 'idle'            && PHASE_DESC[phase.phase]}
        {phase.status === 'running'         && 'Running… reply to any terminal prompts below.'}
        {phase.status === 'awaiting_review' && 'Ready for review — approve or refine below.'}
        {phase.status === 'approved'        && '✓ Approved'}
      </div>

      {/* Feature 3: Clarification with template button */}
      {showClarification && (
        <div style={section}>
          <div style={sectionLabelRow}>
            <label style={sectionLabel}>{CLARIFICATION_LABEL[phase.phase]}</label>
            {template && !clarification && (
              <button style={templateBtn} onClick={handleUseTemplate} title="Fill with template">
                ↙ template
              </button>
            )}
          </div>
          <textarea
            style={{ ...textarea, opacity: isRunning ? 0.6 : 1 }}
            placeholder={CLARIFICATION_PLACEHOLDER[phase.phase]}
            value={clarification}
            onChange={(e) => setClarification(e.target.value)}
            rows={4}
            disabled={isRunning}
          />
        </div>
      )}

      {/* Terminal reply */}
      {showTermInput && (
        <div style={{ ...termSection, ...(hasPrompt ? termSectionActive : {}) }}>
          <div style={termHeader}>
            <span style={termLabel}>Terminal reply</span>
            <div style={quickRow}>
              {quickReplies.map((opt) => (
                <button
                  key={opt}
                  style={quickBtn}
                  title={opt === '↵' ? 'Send Enter' : `Send "${opt}"`}
                  onClick={() => onTerminalInput(opt === '↵' ? '' : opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div style={termInputRow}>
            <input
              style={termInputStyle}
              placeholder="Type a reply and press Enter…"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              onKeyDown={handleTermKeyDown}
            />
            <button style={sendBtn} onClick={handleTermSend}>Send</button>
          </div>
        </div>
      )}

      {/* Feature 2: Tasks inline checklist (tasks phase only) */}
      {isTasksPhase && hasContent && (
        <TaskChecklist
          content={phase.content!}
          onToggle={onToggleTask}
        />
      )}

      {/* Markdown preview — always for non-tasks phases; hidden for tasks (checklist replaces it) */}
      {hasContent && !isTasksPhase && (
        <div style={preview}>
          <MarkdownViewer content={phase.content!} />
        </div>
      )}

      {/* Refinements */}
      {showRefinements && (
        <div style={section}>
          <label style={sectionLabel}>Refinements <span style={labelHint}>(for next run)</span></label>
          <textarea
            style={textarea}
            placeholder="Describe what to change or improve in the next generation…"
            value={refinements}
            onChange={(e) => setRefinements(e.target.value)}
            rows={3}
          />
        </div>
      )}

      {/* Actions */}
      <div style={actions}>
        <button style={{ ...btn, ...runBtnStyle }} onClick={handleRun} disabled={isRunning}>
          {isRunning ? 'Running…' : '▶ Run'}
        </button>
        {canApprove && (
          <button style={{ ...btn, ...approveBtnStyle }} onClick={onApprove}>
            ✓ Approve
          </button>
        )}
        {canDiscard && (
          <button style={{ ...btn, ...discardBtnStyle }} onClick={onDiscard}>
            ✗ Discard
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBar(status: string): React.CSSProperties {
  const color =
    status === 'approved'        ? 'var(--vscode-terminal-ansiGreen, #4ec9b0)' :
    status === 'awaiting_review' ? 'var(--vscode-textLink-foreground)' :
    status === 'running'         ? 'var(--vscode-progressBar-background, #0e70c0)' :
    'transparent';
  return { height: 2, background: color, borderRadius: 1, marginTop: 4 };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  margin: '8px 8px 0',
  border: '1px solid var(--vscode-panel-border, #3a3a3a)',
  borderRadius: 5,
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '8px 10px 6px',
  background: 'var(--vscode-sideBarSectionHeader-background)',
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
  gap: 6,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.82em',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const editorBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--vscode-foreground)',
  cursor: 'pointer',
  fontSize: '1em',
  opacity: 0.5,
  padding: '0 2px',
  lineHeight: 1,
  flexShrink: 0,
};

// Feature 1: stale banner
const staleBanner: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '0.74em',
  background: 'color-mix(in srgb, #f0883e 12%, transparent)',
  borderBottom: '1px solid #f0883e55',
  color: '#f0883e',
  lineHeight: 1.4,
};

const statusDesc: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '0.75em',
  opacity: 0.65,
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
  lineHeight: 1.4,
};

const section: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
};

// Feature 3: label row with template button
const sectionLabelRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 3,
};

const sectionLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7em',
  opacity: 0.55,
  fontWeight: 600,
};

const labelHint: React.CSSProperties = {
  fontWeight: 400,
  opacity: 0.7,
};

const templateBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--vscode-textLink-foreground, #4daafc)',
  cursor: 'pointer',
  fontSize: '0.68em',
  padding: '1px 4px',
  borderRadius: 3,
  opacity: 0.75,
};

const textarea: React.CSSProperties = {
  width: '100%',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, #3a3a3a)',
  borderRadius: 3,
  fontSize: '0.82em',
  padding: '5px 7px',
  resize: 'vertical',
  fontFamily: 'var(--vscode-font-family)',
  boxSizing: 'border-box',
  outline: 'none',
  lineHeight: 1.5,
};

const termSection: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
  background: 'var(--vscode-terminal-background, var(--vscode-editor-background))',
};

const termSectionActive: React.CSSProperties = {
  borderLeft: '2px solid var(--vscode-textLink-foreground)',
};

const termHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 5,
};

const termLabel: React.CSSProperties = {
  fontSize: '0.68em',
  opacity: 0.55,
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  whiteSpace: 'nowrap',
};

const quickRow: React.CSSProperties = {
  display: 'flex',
  gap: 3,
  flexWrap: 'wrap',
};

const quickBtn: React.CSSProperties = {
  padding: '2px 7px',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.75em',
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  fontWeight: 600,
  lineHeight: 1.4,
};

const termInputRow: React.CSSProperties = {
  display: 'flex',
  gap: 4,
};

const termInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '3px 7px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, #3a3a3a)',
  borderRadius: 3,
  fontSize: '0.82em',
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  outline: 'none',
  minWidth: 0,
};

const sendBtn: React.CSSProperties = {
  padding: '3px 9px',
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.78em',
  fontWeight: 600,
  flexShrink: 0,
};

const preview: React.CSSProperties = {
  maxHeight: 260,
  overflowY: 'auto',
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
};

const actions: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '7px 8px',
  flexWrap: 'wrap',
};

const btn: React.CSSProperties = {
  padding: '4px 10px',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.8em',
  fontWeight: 600,
};

const runBtnStyle: React.CSSProperties = {
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
};

const approveBtnStyle: React.CSSProperties = {
  background: 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
  color: '#000',
};

const discardBtnStyle: React.CSSProperties = {
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  marginLeft: 'auto',
};
