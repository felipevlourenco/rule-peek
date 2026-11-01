import * as vscode from 'vscode';
import { classAt } from '../services/classExtractor';
import { IndexedRule, WorkspaceStyleIndex } from '../services/workspaceStyleIndex';

const MAX_RULES = 10;

export class CssClassHoverProvider implements vscode.HoverProvider {
  constructor(private readonly index: WorkspaceStyleIndex) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    const hit = classAt(document.getText(), document.offsetAt(position));
    if (!hit) return undefined;
    await this.index.ready;
    if (token.isCancellationRequested) return undefined;
    const rules = this.index.lookup(hit.className);
    if (!rules.length) return undefined;
    const range = new vscode.Range(document.positionAt(hit.start), document.positionAt(hit.end));
    return new vscode.Hover(renderHover(hit.className, rules), range);
  }
}

export function renderHover(className: string, rules: IndexedRule[]): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown('**').appendText(`.${className}`).appendMarkdown('**');
  if (rules.length > 1) md.appendMarkdown(` · ${rules.length} rules`);
  for (const rule of rules.slice(0, MAX_RULES)) {
    const location = `${vscode.workspace.asRelativePath(rule.uri)}:${rule.line}`;
    const target = rule.uri.with({ fragment: `L${rule.line}` }).toString();
    md.appendMarkdown('\n\n[').appendText(location).appendMarkdown(`](<${target}>)\n`);
    md.appendCodeblock(ruleToCss(rule), 'css');
  }
  if (rules.length > MAX_RULES) md.appendMarkdown(`\n\n_…and ${rules.length - MAX_RULES} more_`);
  return md;
}

function ruleToCss(rule: IndexedRule): string {
  const lines: string[] = [];
  const pad = (depth: number) => '  '.repeat(depth);
  rule.atRules.forEach((at, i) => lines.push(`${pad(i)}${at} {`));
  const depth = rule.atRules.length;
  lines.push(`${pad(depth)}${rule.selector} {`);
  for (const d of rule.declarations) {
    lines.push(`${pad(depth + 1)}${d.prop}: ${d.value}${d.important ? ' !important' : ''};`);
  }
  for (let i = depth; i >= 0; i--) lines.push(`${pad(i)}}`);
  return lines.join('\n');
}
