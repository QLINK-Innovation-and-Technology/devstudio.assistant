import * as vscode from 'vscode';
import { SidebarProvider } from './panels/SidebarProvider';
import { DagPanel } from './panels/DagPanel';
import { WorkflowManager } from './workflow/WorkflowManager';

export function activate(context: vscode.ExtensionContext): void {
  const workflowManager = new WorkflowManager(context);
  const provider = new SidebarProvider(context, workflowManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('devstudio.assistant.sidebar', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devstudio.assistant.refreshFiles', () => {
      provider.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devstudio.assistant.openInEditor', (filePath: string) => {
      const uri = vscode.Uri.file(filePath);
      vscode.window.showTextDocument(uri, { preview: false });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devstudio.assistant.openDag', () => {
      DagPanel.createOrShow(context, workflowManager);
    }),
  );
}

export function deactivate(): void {}
