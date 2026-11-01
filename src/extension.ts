import * as vscode from 'vscode';
import { CssClassHoverProvider } from './providers/cssClassHoverProvider';
import { WorkspaceStyleIndex } from './services/workspaceStyleIndex';

const LANGUAGES = ['html', 'javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue', 'svelte'];

export function activate(context: vscode.ExtensionContext) {
  const log = vscode.window.createOutputChannel('RulePeek', { log: true });
  const index = new WorkspaceStyleIndex(log);
  context.subscriptions.push(
    log,
    index,
    vscode.languages.registerHoverProvider(LANGUAGES, new CssClassHoverProvider(index)),
  );
  index.restart();
  return { index };
}

export function deactivate() {}
