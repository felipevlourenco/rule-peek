import * as vscode from 'vscode';
import type { WorkspaceStyleIndex } from '../../src/services/workspaceStyleIndex';

export const root = () => vscode.workspace.workspaceFolders![0].uri;
export const fixture = (rel: string) => vscode.Uri.joinPath(root(), rel);

export async function activateExtension(): Promise<WorkspaceStyleIndex> {
  const ext = vscode.extensions.getExtension<{ index: WorkspaceStyleIndex }>('felipelourenco.rule-peek')!;
  const { index } = await ext.activate();
  await index.ready;
  return index;
}

/** Joined markdown of every hover at the first occurrence of `needle` (plus `delta` chars) in `rel`. */
export async function hoverText(rel: string, needle: string, delta = 1): Promise<string> {
  const doc = await vscode.workspace.openTextDocument(fixture(rel));
  const offset = doc.getText().indexOf(needle);
  if (offset < 0) throw new Error(`${needle} not in ${rel}`);
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider',
    doc.uri,
    doc.positionAt(offset + delta),
  );
  return hovers
    .flatMap((h) => h.contents)
    .map((c) => (typeof c === 'string' ? c : c.value))
    .join('\n');
}

/** RulePeek hovers always contain a css code block; other providers' hovers don't. */
export const isRuleHover = (text: string) => text.includes('```css');

export async function waitFor(check: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > until) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 100));
  }
}
