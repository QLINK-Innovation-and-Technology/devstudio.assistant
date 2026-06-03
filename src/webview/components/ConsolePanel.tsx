import React, { useEffect, useRef, useState } from 'react';

interface Props {
  lines: string[];
  promptOptions: string[] | null;
  onSend(text: string): void;
  onReply(text: string): void;
  onClear(): void;
  onShowTerminal(): void;
}

export default function ConsolePanel({ lines, promptOptions, onSend, onReply, onClear, onShowTerminal }: Props) {
  const hasPrompt = promptOptions !== null && promptOptions.length > 0;
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (!collapsed && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, collapsed]);

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div
        style={{ ...panelHeader, borderTop: hasPrompt ? '1px solid var(--vscode-textLink-foreground)' : '1px solid var(--vscode-panel-border, #3a3a3a)' }}
      >
        <button style={collapseBtn} onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand console' : 'Collapse console'}>
          {collapsed ? '▸' : '▾'}
        </button>
        <span style={headerLabel}>
          Console
          {hasPrompt && !collapsed && <span style={promptBadge}>● waiting</span>}
        </span>
        {lines.length > 0 && (
          <span style={lineCount}>{lines.length} lines</span>
        )}
        <button style={iconBtn} title="Open terminal" onClick={onShowTerminal}>⎆</button>
        <button style={iconBtn} title="Clear" onClick={onClear}>✕</button>
      </div>

      {!collapsed && (
        <>
          {/* Output lines */}
          <div ref={bodyRef} style={body}>
            {lines.length === 0 ? (
              <span style={emptyHint}>No output yet. Run a phase to start.</span>
            ) : (
              lines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    ...outputLine,
                    ...(i === lines.length - 1 && hasPrompt ? promptLine : {}),
                  }}
                >
                  {line}
                </div>
              ))
            )}
          </div>

          {/* Quick-reply buttons — only shown when a prompt is detected */}
          {hasPrompt && promptOptions && (
            <div style={quickReplyRow}>
              {promptOptions.map((opt) => (
                <button
                  key={opt}
                  style={quickReplyBtn}
                  title={opt === '↵' ? 'Send Enter' : `Send "${opt}"`}
                  onClick={() => onReply(opt === '↵' ? '' : opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Input row — always visible so user can reply at any time */}
          <div style={inputRow}>
            <input
              style={inputStyle}
              placeholder={hasPrompt ? 'Reply to prompt…' : 'Send to terminal…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button style={sendBtn} onClick={handleSend}>↵</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderTop: '1px solid var(--vscode-panel-border, #3a3a3a)',
  background: 'var(--vscode-terminal-background, var(--vscode-editor-background, #1e1e1e))',
};

const panelHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 6px',
  background: 'var(--vscode-sideBarSectionHeader-background)',
  userSelect: 'none',
};

const collapseBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--vscode-foreground)',
  cursor: 'pointer',
  fontSize: '0.9em',
  padding: '0 3px',
  opacity: 0.6,
  lineHeight: 1,
  flexShrink: 0,
};

const headerLabel: React.CSSProperties = {
  flex: 1,
  fontSize: '0.72em',
  fontWeight: 600,
  letterSpacing: '0.04em',
  opacity: 0.75,
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const promptBadge: React.CSSProperties = {
  fontSize: '0.9em',
  color: 'var(--vscode-textLink-foreground)',
  fontWeight: 700,
  animation: 'pulse 1.2s ease-in-out infinite',
};

const lineCount: React.CSSProperties = {
  fontSize: '0.68em',
  opacity: 0.4,
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
};

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--vscode-foreground)',
  cursor: 'pointer',
  fontSize: '0.82em',
  padding: '0 4px',
  opacity: 0.45,
  lineHeight: 1,
  flexShrink: 0,
};

const body: React.CSSProperties = {
  height: 130,
  overflowY: 'auto',
  padding: '4px 8px',
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  fontSize: '0.78em',
  lineHeight: 1.5,
  color: 'var(--vscode-terminal-foreground, var(--vscode-foreground))',
  wordBreak: 'break-all',
};

const emptyHint: React.CSSProperties = {
  opacity: 0.35,
  fontStyle: 'italic',
};

const outputLine: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
};

const promptLine: React.CSSProperties = {
  color: 'var(--vscode-textLink-foreground)',
  fontWeight: 600,
};

const quickReplyRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  padding: '4px 6px 2px',
  borderTop: '1px solid var(--vscode-panel-border, #3a3a3a)',
};

const quickReplyBtn: React.CSSProperties = {
  padding: '1px 8px',
  background: 'var(--vscode-button-secondaryBackground, #3a3a3a)',
  color: 'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
  border: '1px solid var(--vscode-button-border, transparent)',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.78em',
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  fontWeight: 600,
};

const inputRow: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '4px 6px',
  borderTop: '1px solid var(--vscode-panel-border, #3a3a3a)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '2px 6px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, #3a3a3a)',
  borderRadius: 3,
  fontSize: '0.78em',
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  outline: 'none',
  minWidth: 0,
};

const sendBtn: React.CSSProperties = {
  padding: '2px 8px',
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.82em',
  fontWeight: 700,
  flexShrink: 0,
};
