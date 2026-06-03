import React, { useState } from 'react';
import { FeatureWorkflow } from '../../shared/types';

interface Props {
  features: FeatureWorkflow[];
  activeFeatureName: string | null;
  onSelect(name: string): void;
  onCreate(name: string): void;
}

export default function FeatureManager({ features, activeFeatureName, onSelect, onCreate }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setCreating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setCreating(false);
      setNewName('');
    }
  };

  return (
    <div style={container}>
      <div style={row}>
        <label style={label}>Feature</label>
        <div style={controls}>
          <select
            style={select}
            value={activeFeatureName ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={features.length === 0}
          >
            {features.length === 0 && <option value="">— no features yet —</option>}
            {features.map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
          <button
            style={addBtn}
            title={creating ? 'Cancel' : 'New feature'}
            onClick={() => { setCreating((c) => !c); setNewName(''); }}
          >
            {creating ? '×' : '+'}
          </button>
        </div>
      </div>

      {creating && (
        <div style={createRow}>
          <input
            autoFocus
            style={input}
            placeholder="feature-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button style={confirmBtn} onClick={handleCreate}>Create</button>
        </div>
      )}
    </div>
  );
}

const container: React.CSSProperties = {
  padding: '5px 8px',
  borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
  flexShrink: 0,
};

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const label: React.CSSProperties = {
  fontSize: '0.72em',
  opacity: 0.5,
  whiteSpace: 'nowrap',
};

const controls: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  gap: 4,
};

const select: React.CSSProperties = {
  flex: 1,
  padding: '3px 6px',
  background: 'var(--vscode-dropdown-background)',
  color: 'var(--vscode-dropdown-foreground)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: 3,
  fontSize: '0.82em',
  cursor: 'pointer',
  minWidth: 0,
};

const addBtn: React.CSSProperties = {
  padding: '2px 7px',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '1em',
  fontWeight: 700,
  lineHeight: 1,
  flexShrink: 0,
};

const createRow: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginTop: 4,
};

const input: React.CSSProperties = {
  flex: 1,
  padding: '3px 7px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, #3a3a3a)',
  borderRadius: 3,
  fontSize: '0.82em',
  outline: 'none',
};

const confirmBtn: React.CSSProperties = {
  padding: '2px 10px',
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.82em',
  fontWeight: 600,
  flexShrink: 0,
};
