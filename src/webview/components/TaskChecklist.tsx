import React from 'react';

interface TaskItem {
  lineIndex: number;
  text: string;
  checked: boolean;
  indent: number;
}

interface Props {
  content: string;
  onToggle(lineIndex: number, checked: boolean): void;
}

const CHECKBOX_RE = /^(\s*)([-*]|\d+\.)\s+\[( |x|X)\]\s+(.+)$/;

function parseTaskItems(content: string): TaskItem[] {
  return content
    .split('\n')
    .map((line, idx) => {
      const m = CHECKBOX_RE.exec(line);
      if (!m) return null;
      return {
        lineIndex: idx,
        text: m[4],
        checked: m[3].toLowerCase() === 'x',
        indent: m[1].length,
      };
    })
    .filter((item): item is TaskItem => item !== null);
}

export default function TaskChecklist({ content, onToggle }: Props) {
  const items = parseTaskItems(content);

  if (items.length === 0) return null;

  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  const pct = Math.round((done / total) * 100);

  return (
    <div style={container}>
      {/* Progress bar */}
      <div style={progressRow}>
        <div style={progressTrack}>
          <div style={{ ...progressFill, width: `${pct}%` }} />
        </div>
        <span style={progressLabel}>{done}/{total}</span>
      </div>

      {/* Checkbox list */}
      <div style={list}>
        {items.map((item) => (
          <label
            key={item.lineIndex}
            style={{ ...itemRow, paddingLeft: 8 + item.indent * 10 }}
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => onToggle(item.lineIndex, e.target.checked)}
              style={checkbox}
            />
            <span style={{ ...itemText, textDecoration: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.45 : 1 }}>
              {item.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const container: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
};

const progressRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 6,
};

const progressTrack: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: 'var(--vscode-panel-border, #3a3a3a)',
  borderRadius: 2,
  overflow: 'hidden',
};

const progressFill: React.CSSProperties = {
  height: '100%',
  background: 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
  borderRadius: 2,
  transition: 'width 0.2s ease',
};

const progressLabel: React.CSSProperties = {
  fontSize: '0.68em',
  opacity: 0.55,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

const list: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  maxHeight: 220,
  overflowY: 'auto',
};

const itemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  padding: '2px 0',
  cursor: 'pointer',
  borderRadius: 3,
};

const checkbox: React.CSSProperties = {
  marginTop: 2,
  flexShrink: 0,
  accentColor: 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
  cursor: 'pointer',
};

const itemText: React.CSSProperties = {
  fontSize: '0.8em',
  lineHeight: 1.4,
  color: 'var(--vscode-foreground)',
};
