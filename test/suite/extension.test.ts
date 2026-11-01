import * as assert from 'assert';
import * as vscode from 'vscode';
import { activateExtension, fixture, hoverText, isRuleHover, waitFor } from './helpers';

const NEW_FILE = 'src/tmp-live.css';
const HTML = '<div class="fresh-class"></div>';

describe('extension', () => {
  before(activateExtension);

  afterEach(async () => {
    await vscode.workspace.fs.delete(fixture(NEW_FILE)).then(undefined, () => undefined);
    await vscode.workspace.fs.delete(fixture('src/tmp-live.html')).then(undefined, () => undefined);
    await vscode.workspace.getConfiguration('cssClassHover').update('enabled', undefined, true);
  });

  it('activates and indexes the workspace', async () => {
    const index = await activateExtension();
    assert.ok(index.lookup('card').length === 3);
  });

  it('picks up created, changed and deleted stylesheets without a restart', async () => {
    const write = (text: string) => vscode.workspace.fs.writeFile(fixture(NEW_FILE), Buffer.from(text));
    await vscode.workspace.fs.writeFile(fixture('src/tmp-live.html'), Buffer.from(HTML));
    const hover = () => hoverText('src/tmp-live.html', 'fresh-class');
    // The OS-level recursive watcher needs a moment after activation before it reports events.
    await new Promise((r) => setTimeout(r, 1500));

    await write('.fresh-class { color: lime; }');
    await waitFor(async () => (await hover()).includes('color: lime;'));

    await write('.fresh-class { color: navy; }');
    await waitFor(async () => (await hover()).includes('color: navy;'));

    await vscode.workspace.fs.delete(fixture(NEW_FILE));
    await waitFor(async () => !isRuleHover(await hover()));
  });

  it('can be disabled through settings', async () => {
    const config = vscode.workspace.getConfiguration('cssClassHover');
    await config.update('enabled', false, true);
    await waitFor(async () => !isRuleHover(await hoverText('src/App.tsx', 'primary-card')));
    await config.update('enabled', undefined, true);
    await waitFor(async () => isRuleHover(await hoverText('src/App.tsx', 'primary-card')));
  });
});
