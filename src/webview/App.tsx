import React, { useState, useEffect, useCallback } from 'react';
import { ExtToWebMsg, WebToExtMsg, FileTree, WorkflowState } from '../shared/types';
import FileTreeView from './components/FileTree';
import MarkdownViewer from './components/MarkdownViewer';
import WorkflowView from './components/WorkflowView';

declare function acquireVsCodeApi(): { postMessage(msg: WebToExtMsg): void };
const vscode = acquireVsCodeApi();

type AppStatus = 'loading' | 'noWorkspace' | 'noDevstudio' | 'initializing' | 'ready';
type Tab = 'workflow' | 'files';
type FileView = 'tree' | 'content';

export default function App() {
  const [status, setStatus] = useState<AppStatus>('loading');
  const [tab, setTab] = useState<Tab>('workflow');
  const [fileView, setFileView] = useState<FileView>('tree');
  const [tree, setTree] = useState<FileTree | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ title: string; text: string } | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('claude');
  const [initializingAgent, setInitializingAgent] = useState<string>('');
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [promptOptions, setPromptOptions] = useState<string[] | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtToWebMsg;
      switch (msg.type) {
        case 'fileTree':
          setTree(msg.tree);
          setStatus('ready');
          break;
        case 'fileContent':
          setFileContent({ title: msg.title, text: msg.content });
          setFileView('content');
          setTab('files');
          break;
        case 'workflowState':
          setWorkflowState(msg.state);
          break;
        case 'consoleOutput':
          setConsoleLines((prev) => {
            const incoming = msg.text.split('\n').filter((l) => l.length > 0);
            const next = [...prev, ...incoming];
            return next.length > 300 ? next.slice(-300) : next;
          });
          setPromptOptions(msg.promptOptions);
          break;
        case 'noWorkspace':
          setStatus('noWorkspace');
          break;
        case 'noDevstudio':
          setSelectedAgent(msg.defaultAgent);
          setStatus('noDevstudio');
          break;
        case 'initializing':
          setInitializingAgent(msg.agent);
          setStatus('initializing');
          break;
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedPath(filePath);
    vscode.postMessage({ type: 'selectFile', path: filePath });
  }, []);

  const handleOpenInEditor = useCallback((filePath: string) => {
    vscode.postMessage({ type: 'openInEditor', path: filePath });
  }, []);

  const handleInitProject = useCallback(() => {
    vscode.postMessage({ type: 'initProject', agent: selectedAgent });
  }, [selectedAgent]);

  // ─── Status screens ────────────────────────────────────────────────────────

  if (status === 'loading') {
    return <Center>Loading…</Center>;
  }

  if (status === 'noWorkspace') {
    return <Center>Open a workspace folder to use DevStudio Assistant.</Center>;
  }

  if (status === 'noDevstudio') {
    return (
      <Center>
        <p>No <code style={inlineCode}>.factory/</code> found in this workspace.</p>
        <div style={{ marginTop: 14, width: '100%', maxWidth: 220 }}>
          <label style={labelStyle}>AI Agent</label>
          <select
            style={selectStyle}
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="gemini">Gemini (Google)</option>
            <option value="copilot">Copilot (GitHub)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <button style={initBtn} onClick={handleInitProject}>
          Initialize DevStudio
        </button>
        <p style={{ fontSize: '0.75em', opacity: 0.45, marginTop: 6 }}>
          Runs <code style={inlineCode}>devstudio init --here --ai {selectedAgent}</code>
        </p>
      </Center>
    );
  }

  if (status === 'initializing') {
    return (
      <Center>
        <p style={{ marginBottom: 6 }}>Initializing with <strong>{initializingAgent}</strong>…</p>
        <p style={{ fontSize: '0.8em', opacity: 0.6 }}>
          Check the <strong>DevStudio Assistant</strong> output channel for progress.
        </p>
      </Center>
    );
  }

  // ─── Ready: tab layout ────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button
          style={tab === 'workflow' ? styles.tabActive : styles.tab}
          onClick={() => setTab('workflow')}
        >
          Workflow
        </button>
        <button
          style={tab === 'files' ? styles.tabActive : styles.tab}
          onClick={() => setTab('files')}
        >
          Files
        </button>
      </div>

      {/* Tab content */}
      <div style={styles.tabContent}>
        {tab === 'workflow' ? (
          workflowState ? (
            <WorkflowView
              state={workflowState}
              onMessage={(msg) => vscode.postMessage(msg)}
              consoleLines={consoleLines}
              promptOptions={promptOptions}
              onClearConsole={() => { setConsoleLines([]); setPromptOptions(null); }}
              onClearPrompt={() => setPromptOptions(null)}
            />
          ) : (
            <Center>Loading workflow…</Center>
          )
        ) : fileView === 'content' ? (
          /* Files tab — content view */
          <div style={styles.contentWrapper}>
            <div style={styles.contentHeader}>
              <button style={styles.backBtn} onClick={() => setFileView('tree')}>
                ← Files
              </button>
              <span style={styles.contentTitle}>{fileContent?.title ?? ''}</span>
              {selectedPath && (
                <button
                  style={styles.openBtn}
                  title="Open in editor"
                  onClick={() => handleOpenInEditor(selectedPath)}
                >
                  ↗
                </button>
              )}
            </div>
            <div style={styles.contentBody}>
              {fileContent && <MarkdownViewer content={fileContent.text} />}
            </div>
          </div>
        ) : (
          /* Files tab — tree view */
          <FileTreeView
            tree={tree!}
            selectedPath={selectedPath}
            onSelect={handleSelectFile}
          />
        )}
      </div>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={centerStyle}>{children}</div>
  );
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  padding: 20,
  textAlign: 'center',
  color: 'var(--vscode-descriptionForeground)',
  fontSize: '0.9em',
  gap: 4,
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75em',
  opacity: 0.6,
  marginBottom: 4,
  textAlign: 'left',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: 'var(--vscode-dropdown-background)',
  color: 'var(--vscode-dropdown-foreground)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: 3,
  fontSize: '0.9em',
  cursor: 'pointer',
};

const initBtn: React.CSSProperties = {
  marginTop: 12,
  padding: '6px 16px',
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.9em',
  fontWeight: 600,
};

const inlineCode: React.CSSProperties = {
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  background: 'var(--vscode-textCodeBlock-background)',
  padding: '1px 4px',
  borderRadius: 3,
  fontSize: '0.9em',
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
    background: 'var(--vscode-sideBarSectionHeader-background)',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '6px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    fontSize: '0.82em',
    opacity: 0.6,
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  tabActive: {
    flex: 1,
    padding: '6px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid var(--vscode-focusBorder, #007fd4)',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    fontSize: '0.82em',
    opacity: 1,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  tabContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  contentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  contentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    borderBottom: '1px solid var(--vscode-panel-border, #3a3a3a)',
    background: 'var(--vscode-sideBarSectionHeader-background)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--vscode-textLink-foreground)',
    cursor: 'pointer',
    fontSize: '0.8em',
    padding: '2px 6px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  contentTitle: {
    flex: 1,
    fontSize: '0.8em',
    fontWeight: 600,
    opacity: 0.75,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  openBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    fontSize: '1em',
    padding: '1px 5px',
    borderRadius: 3,
    opacity: 0.55,
    flexShrink: 0,
    lineHeight: 1,
  },
  contentBody: {
    flex: 1,
    overflowY: 'auto',
  },
};
