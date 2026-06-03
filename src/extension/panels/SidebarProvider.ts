import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  ExtToWebMsg,
  WebToExtMsg,
  FileTree,
  FileItem,
  FileKind,
  FeatureGroup,
} from '../../shared/types';
import { WorkflowManager } from '../workflow/WorkflowManager';

// Ordered list of known spec filenames
const SPEC_FILE_ORDER: Record<string, number> = {
  'spec.md': 0,
  'plan.md': 1,
  'tasks.md': 2,
  'research.md': 3,
  'data-model.md': 4,
  'quickstart.md': 5,
};

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _watcher?: vscode.FileSystemWatcher;
  private _selectedFilePath: string | null = null;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _workflow: WorkflowManager,
  ) {
    _workflow.onStateChange(() => this._sendWorkflowState());
    _workflow.onConsoleData((text, promptOptions) => {
      this._post({ type: 'consoleOutput', text, promptOptions });
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: WebToExtMsg) => {
      this._handleMessage(msg);
    });

    this._setupWatcher();
  }

  public refresh(): void {
    this._sendFileTree();
    this._sendWorkflowState();
  }

  // ─── Message handling ────────────────────────────────────────────────────

  private _handleMessage(msg: WebToExtMsg): void {
    switch (msg.type) {
      case 'ready':
        this._onReady();
        break;
      case 'refresh':
        this._sendFileTree();
        this._sendWorkflowState();
        break;
      case 'selectFile':
        this._selectedFilePath = msg.path;
        this._sendFileContent(msg.path);
        break;
      case 'openInEditor':
        vscode.commands.executeCommand('devstudio.assistant.openInEditor', msg.path);
        break;
      case 'initProject':
        this._initProject(msg.agent);
        break;
      case 'runPhase':
        this._workflow.runPhase(msg.phase, msg.prompt);
        break;
      case 'approvePhase':
        this._workflow.approvePhase(msg.phase);
        break;
      case 'discardPhase':
        this._workflow.discardPhase(msg.phase);
        break;
      case 'createFeature':
        this._workflow.createFeature(msg.name);
        break;
      case 'setActiveFeature':
        this._workflow.setActiveFeature(msg.name);
        break;
      case 'terminalInput':
        this._workflow.sendToTerminal(msg.text);
        break;
      case 'showTerminal':
        this._workflow.showTerminal();
        break;
      case 'toggleTask':
        this._workflow.toggleTask(msg.featureName, msg.lineIndex, msg.checked);
        break;
    }
  }

  private _onReady(): void {
    const root = this._workspaceRoot();
    if (root) {
      const factoryDir = path.join(root, '.factory');
      if (fs.existsSync(factoryDir)) {
        this._workflow.reconcileWithDisk(root);
      }
    }
    this._sendFileTree();
    this._sendWorkflowState();
  }

  // ─── Initialization ──────────────────────────────────────────────────────

  private _initProject(agent: string): void {
    const root = this._workspaceRoot();
    if (!root) return;

    this._post({ type: 'initializing', agent });

    const args = ['init', '--here', '--ai', agent, '--force'];
    if (agent === 'claude') {
      args.push('--ai-skills');
    }

    const channel = vscode.window.createOutputChannel('DevStudio Assistant');
    channel.show(true);
    channel.appendLine(`$ devstudio ${args.join(' ')}\n`);

    const child = spawn('devstudio', args, {
      cwd: root,
      shell: process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const shellKey = process.platform === 'win32' ? '\x1B[B\n' : '\n';
    child.stdin.write(shellKey);
    child.stdin.end();

    child.stdout.on('data', (data: Buffer) => channel.append(data.toString()));
    child.stderr.on('data', (data: Buffer) => channel.append(data.toString()));

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        channel.appendLine('\n❌ devstudio command not found.');
        channel.appendLine(
          'Install: uv tool install devstudio-factory --from git+https://github.com/QLINK-Innovation-and-Technology/devstudio.git',
        );
      } else {
        channel.appendLine(`\n❌ ${err.message}`);
      }
      this._sendFileTree();
    });

    child.on('close', (code) => {
      channel.appendLine(`\n${code === 0 ? '✓' : '❌'} Done (exit ${code})`);
      this._sendFileTree();
      const newRoot = this._workspaceRoot();
      if (newRoot) this._workflow.reconcileWithDisk(newRoot);
    });
  }

  // ─── File tree scanning ──────────────────────────────────────────────────

  private _workspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  private _sendFileTree(): void {
    const root = this._workspaceRoot();
    if (!root) {
      this._post({ type: 'noWorkspace' });
      return;
    }

    const factoryDir = path.join(root, '.factory');
    if (!fs.existsSync(factoryDir)) {
      const defaultAgent = vscode.workspace
        .getConfiguration('devstudio.assistant')
        .get<string>('aiAgent', 'claude');
      this._post({ type: 'noDevstudio', defaultAgent });
      return;
    }

    this._post({ type: 'fileTree', tree: this._buildTree(root, factoryDir) });
  }

  private _sendWorkflowState(): void {
    this._post({ type: 'workflowState', state: this._workflow.getState() });
  }

  private _buildTree(root: string, factoryDir: string): FileTree {
    const constitutionPath = path.join(factoryDir, 'memory', 'constitution.md');
    const constitution: FileItem | null = fs.existsSync(constitutionPath)
      ? { name: 'constitution.md', path: constitutionPath, kind: 'constitution' }
      : null;

    const features: FeatureGroup[] = [];
    const specsDir = path.join(root, 'specs');

    if (fs.existsSync(specsDir)) {
      const entries = fs.readdirSync(specsDir, { withFileTypes: true });
      for (const entry of entries.filter((e) => e.isDirectory())) {
        const featureDir = path.join(specsDir, entry.name);
        const files = this._scanFeatureDir(featureDir);
        if (files.length > 0) {
          features.push({ name: entry.name, files });
        }
      }
    }

    return { constitution, features };
  }

  private _scanFeatureDir(dir: string): FileItem[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: FileItem[] = entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
        kind: this._fileKind(e.name),
      }));

    files.sort((a, b) => {
      const ao = SPEC_FILE_ORDER[a.name] ?? 99;
      const bo = SPEC_FILE_ORDER[b.name] ?? 99;
      return ao - bo || a.name.localeCompare(b.name);
    });

    return files;
  }

  private _fileKind(name: string): FileKind {
    switch (name) {
      case 'spec.md':   return 'spec';
      case 'plan.md':   return 'plan';
      case 'tasks.md':  return 'tasks';
      default:          return 'other';
    }
  }

  private _sendFileContent(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this._post({ type: 'fileContent', path: filePath, title: path.basename(filePath), content });
    } catch {
      // ignore
    }
  }

  // ─── File watcher ────────────────────────────────────────────────────────

  private _setupWatcher(): void {
    this._watcher?.dispose();
    const root = this._workspaceRoot();
    if (!root) return;

    const watchers = [
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(root, '.factory/**/*'),
      ),
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(root, 'specs/**/*.md'),
      ),
    ];

    this._watcher = watchers[0];

    for (const w of watchers) {
      w.onDidCreate((uri) => {
        this._sendFileTree();
        this._workflow.onFileEvent(uri.fsPath);
      });
      w.onDidDelete(() => this._sendFileTree());
      w.onDidChange((uri) => {
        this._sendFileTree();
        this._workflow.onFileEvent(uri.fsPath);
        if (this._selectedFilePath && uri.fsPath === this._selectedFilePath) {
          this._sendFileContent(this._selectedFilePath);
        }
      });
      this._context.subscriptions.push(w);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private _post(msg: ExtToWebMsg): void {
    this._view?.webview.postMessage(msg);
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview.js'),
    );
    const nonce = generateNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <title>DevStudio Assistant</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      overflow-x: hidden;
    }
    #root { height: 100vh; display: flex; flex-direction: column; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .running-pulse { animation: pulse 1.2s ease-in-out infinite; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
