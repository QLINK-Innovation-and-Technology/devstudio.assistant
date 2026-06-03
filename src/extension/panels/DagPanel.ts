import * as vscode from 'vscode';
import { ExtToWebMsg, WebToExtMsg } from '../../shared/types';
import { WorkflowManager } from '../workflow/WorkflowManager';

export class DagPanel {
  private static _current: DagPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];

  /** Open (or focus) the DAG panel. */
  public static createOrShow(
    context: vscode.ExtensionContext,
    workflow: WorkflowManager,
  ): void {
    if (DagPanel._current) {
      DagPanel._current._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'devstudio.assistantDag',
      'DevStudio Workflow Map',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
      },
    );

    DagPanel._current = new DagPanel(panel, context, workflow);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    workflow: WorkflowManager,
  ) {
    this._panel = panel;
    this._panel.webview.html = this._buildHtml(context);

    // Messages from webview
    this._panel.webview.onDidReceiveMessage(
      (msg: WebToExtMsg) => {
        if (msg.type === 'ready') {
          this._post({ type: 'workflowState', state: workflow.getState() });
        } else if (msg.type === 'openInEditor') {
          const uri = vscode.Uri.file(msg.path);
          vscode.window.showTextDocument(uri, { preview: false });
        }
      },
      undefined,
      this._disposables,
    );

    // Push state updates to the panel
    workflow.onStateChange(() => {
      this._post({ type: 'workflowState', state: workflow.getState() });
    });

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
  }

  private _post(msg: ExtToWebMsg): void {
    this._panel.webview.postMessage(msg);
  }

  private _dispose(): void {
    DagPanel._current = undefined;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
  }

  private _buildHtml(context: vscode.ExtensionContext): string {
    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-dag.js'),
    );
    const nonce = generateNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <title>SDD Workflow Map</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
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
