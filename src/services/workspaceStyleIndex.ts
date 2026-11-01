import * as vscode from 'vscode';
import { CssRule, parseStylesheet, syntaxForPath } from './cssParser';

export interface IndexedRule extends CssRule {
  uri: vscode.Uri;
}

/** Workspace-wide index of stylesheet rules by class name, kept current by file watchers. */
export class WorkspaceStyleIndex implements vscode.Disposable {
  private readonly files = new Map<string, IndexedRule[]>();
  private readonly byClass = new Map<string, Map<string, IndexedRule[]>>();
  private watchers: vscode.Disposable[] = [];
  private readonly listeners: vscode.Disposable[];
  private syncTimer?: NodeJS.Timeout;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly log: vscode.LogOutputChannel) {
    this.listeners = [
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('cssClassHover') && this.restart()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.scheduleSync()),
    ];
  }

  /** Resolves once all pending scans and re-parses have finished. */
  get ready(): Promise<void> {
    return this.queue;
  }

  lookup(className: string): IndexedRule[] {
    const perFile = this.byClass.get(className);
    if (!perFile) return [];
    return [...perFile.values()].flat().sort((a, b) => a.uri.path.localeCompare(b.uri.path) || a.line - b.line);
  }

  /** (Re)reads settings, recreates watchers and rescans. */
  restart(): void {
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [];
    const config = vscode.workspace.getConfiguration('cssClassHover');
    if (!config.get<boolean>('enabled', true)) {
      this.enqueue(async () => this.clear());
      return;
    }
    for (const pattern of config.get<string[]>('include', [])) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      // Saves often surface as `create` (replace-on-save), so an already-indexed file is re-parsed on either event.
      // Genuinely new files go through a rescan, which applies include/exclude via findFiles; unknown files that
      // merely change (excluded build output) are ignored.
      const reindex = (uri: vscode.Uri): boolean => {
        const known = this.files.has(uri.toString());
        if (known) this.enqueue(() => this.indexFile(uri));
        return known;
      };
      watcher.onDidChange((uri) => void reindex(uri));
      watcher.onDidCreate((uri) => !reindex(uri) && this.scheduleSync());
      watcher.onDidDelete((uri) => this.enqueue(async () => this.remove(uri.toString())));
      this.watchers.push(watcher);
    }
    this.enqueue(() => this.sync());
  }

  dispose(): void {
    clearTimeout(this.syncTimer);
    [...this.watchers, ...this.listeners].forEach((d) => d.dispose());
    this.clear();
  }

  private scheduleSync(): void {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.enqueue(() => this.sync()), 200);
  }

  /** Serializes index mutations so scans and re-parses never interleave. */
  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((e) => this.log.error(e));
  }

  /** Finds stylesheets, drops vanished ones and parses ones not yet indexed. */
  private async sync(): Promise<void> {
    const config = vscode.workspace.getConfiguration('cssClassHover');
    if (!config.get<boolean>('enabled', true)) return;
    const exclude = config.get<string[]>('exclude', []);
    const excludeGlob = exclude.length ? `{${exclude.join(',')}}` : undefined;
    const found = new Map<string, vscode.Uri>();
    for (const pattern of config.get<string[]>('include', [])) {
      for (const uri of await vscode.workspace.findFiles(pattern, excludeGlob)) found.set(uri.toString(), uri);
    }
    for (const key of this.files.keys()) if (!found.has(key)) this.remove(key);
    const started = Date.now();
    let parsed = 0;
    for (const [key, uri] of found) {
      if (this.files.has(key)) continue;
      await this.indexFile(uri); // awaiting each read yields to the editor between files
      parsed++;
    }
    if (parsed) this.log.info(`Indexed ${parsed} stylesheet(s) in ${Date.now() - started}ms`);
  }

  // ponytail: parsing runs on the extension host thread; move to a worker if huge stylesheets stall hovers.
  private async indexFile(uri: vscode.Uri): Promise<void> {
    const key = uri.toString();
    let rules: IndexedRule[];
    try {
      const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      rules = parseStylesheet(text, syntaxForPath(uri.path)).map((r) => ({ ...r, uri }));
    } catch (e) {
      this.log.warn(`Skipping ${uri.fsPath}: ${e instanceof Error ? e.message : e}`);
      rules = this.files.get(key) ?? []; // keep the last good parse while the file is mid-edit
    }
    this.remove(key);
    this.files.set(key, rules);
    for (const rule of rules) {
      let perFile = this.byClass.get(rule.className);
      if (!perFile) this.byClass.set(rule.className, (perFile = new Map()));
      const list = perFile.get(key);
      if (list) list.push(rule);
      else perFile.set(key, [rule]);
    }
  }

  private remove(key: string): void {
    for (const rule of this.files.get(key) ?? []) {
      const perFile = this.byClass.get(rule.className);
      perFile?.delete(key);
      if (perFile?.size === 0) this.byClass.delete(rule.className);
    }
    this.files.delete(key);
  }

  private clear(): void {
    this.files.clear();
    this.byClass.clear();
  }
}
