import * as assert from 'assert';
import { activateExtension, hoverText, isRuleHover } from './helpers';

describe('CssClassHoverProvider', () => {
  before(activateExtension);

  it('shows the rule for a JSX class with declarations and source location', async () => {
    const text = await hoverText('src/App.tsx', 'primary-card');
    assert.ok(text.includes('**\\.primary\\-card**') || text.includes('**.primary-card**'), text);
    assert.ok(text.includes('background-color: #2563eb;'), text);
    assert.ok(text.includes('color: white;'), text);
    assert.ok(text.includes('src/styles.css:7'), text);
  });

  it('lists every matching rule across stylesheets, with at-rule context', async () => {
    const text = await hoverText('src/App.tsx', 'card primary');
    assert.ok(text.includes('src/styles.css:1'), text);
    assert.ok(text.includes('.card:hover {'), text);
    assert.ok(text.includes('@media (max-width: 600px) {'), text);
    assert.ok(text.includes('src/styles.css:17'), text);
    assert.ok(text.includes('3 rules'), text);
  });

  it('finds SCSS nested and LESS rules from template literals', async () => {
    const title = await hoverText('src/App.tsx', 'card__title');
    assert.ok(title.includes('.card__title {') && title.includes('src/theme.scss:4'), title);
    const legacy = await hoverText('src/App.tsx', 'legacy-box');
    assert.ok(legacy.includes('color: @accent;') && legacy.includes('src/legacy.less:3'), legacy);
  });

  it('works in HTML', async () => {
    const text = await hoverText('src/index.html', 'primary-card');
    assert.ok(text.includes('src/styles.css:7') && text.includes('src/theme.scss:9'), text);
  });

  it('skips excluded folders and unparseable files', async () => {
    const text = await hoverText('src/App.tsx', 'card primary');
    assert.ok(!text.includes('from-dist'), text);
    assert.ok(!text.includes('broken.css'), text);
  });

  it('returns nothing for unknown classes', async () => {
    assert.ok(!isRuleHover(await hoverText('src/App.tsx', 'unknown-class')));
  });

  it('returns nothing outside class attributes', async () => {
    assert.ok(!isRuleHover(await hoverText('src/App.tsx', 'card</h2>')));
    assert.ok(!isRuleHover(await hoverText('src/index.html', 'card</div>')));
    assert.ok(!isRuleHover(await hoverText('src/App.tsx', 'className="card', 2)));
  });
});
