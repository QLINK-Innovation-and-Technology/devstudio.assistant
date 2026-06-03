import React, { useState } from 'react';
import { FileTree, FileItem } from '../../shared/types';

interface Props {
  tree: FileTree;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

const KIND_ICON: Record<string, string> = {
  constitution: '📜',
  spec: '📋',
  plan: '🗺️',
  tasks: '✅',
  other: '📄',
};

export default function FileTreeView({ tree, selectedPath, onSelect }: Props) {
  const hasContent = tree.constitution || tree.features.length > 0;

  return (
    <div style={styles.root}>
      {/* Constitution section */}
      {tree.constitution && (
        <div>
          <SectionLabel text="Constitution" />
          <FileRow
            file={tree.constitution}
            selected={selectedPath === tree.constitution.path}
            indent={false}
            onSelect={onSelect}
          />
        </div>
      )}

      {/* Specs section */}
      {tree.features.length > 0 && (
        <div>
          <SectionLabel text="Specs" />
          {tree.features.map((feature) => (
            <FeatureSection
              key={feature.name}
              name={feature.name}
              files={feature.files}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {!hasContent && (
        <div style={styles.empty}>No markdown files found.</div>
      )}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <div style={styles.sectionLabel}>{text.toUpperCase()}</div>;
}

function FeatureSection({
  name, files, selectedPath, onSelect,
}: {
  name: string;
  files: FileItem[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button style={styles.featureHeader} onClick={() => setOpen((v) => !v)}>
        <span style={styles.chevron}>{open ? '▾' : '▸'}</span>
        <span style={styles.featureName}>{name}</span>
      </button>
      {open && files.map((file) => (
        <FileRow
          key={file.path}
          file={file}
          selected={selectedPath === file.path}
          indent
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function FileRow({
  file, selected, indent, onSelect,
}: {
  file: FileItem;
  selected: boolean;
  indent: boolean;
  onSelect: (path: string) => void;
}) {
  return (
    <button
      style={{
        ...styles.fileRow,
        paddingLeft: indent ? 28 : 12,
        background: selected
          ? 'var(--vscode-list-activeSelectionBackground)'
          : 'transparent',
        color: selected
          ? 'var(--vscode-list-activeSelectionForeground)'
          : 'var(--vscode-foreground)',
      }}
      onClick={() => onSelect(file.path)}
      title={file.path}
    >
      <span style={styles.icon}>{KIND_ICON[file.kind] ?? KIND_ICON.other}</span>
      <span style={styles.filename}>{file.name}</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '4px 0',
  },
  sectionLabel: {
    padding: '6px 12px 2px',
    fontSize: '0.7em',
    fontWeight: 700,
    letterSpacing: '0.09em',
    color: 'var(--vscode-sideBarSectionHeader-foreground)',
    opacity: 0.55,
    userSelect: 'none',
  },
  featureHeader: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '3px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--vscode-foreground)',
    fontSize: '0.85em',
    textAlign: 'left',
  },
  chevron: {
    marginRight: 4,
    fontSize: '0.8em',
    opacity: 0.65,
    flexShrink: 0,
  },
  featureName: {
    fontWeight: 500,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '3px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85em',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  icon: {
    marginRight: 6,
    fontSize: '0.88em',
    flexShrink: 0,
  },
  filename: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: '10px 12px',
    fontSize: '0.8em',
    opacity: 0.5,
  },
};
