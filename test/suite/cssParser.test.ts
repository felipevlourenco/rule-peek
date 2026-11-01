import * as assert from 'assert';
import { parseStylesheet, syntaxForPath } from '../../src/services/cssParser';

const byClass = (css: string, cls: string, syntax?: 'css' | 'scss' | 'less') =>
  parseStylesheet(css, syntax).filter((r) => r.className === cls);

describe('cssParser', () => {
  it('parses a basic class with multiple declarations and line', () => {
    const [rule] = byClass('\n.card {\n  display: flex;\n  padding: 16px;\n  border-radius: 8px;\n}', 'card');
    assert.strictEqual(rule.selector, '.card');
    assert.strictEqual(rule.line, 2);
    assert.deepStrictEqual(
      rule.declarations.map((d) => `${d.prop}: ${d.value}`),
      ['display: flex', 'padding: 16px', 'border-radius: 8px'],
    );
  });

  it('keeps !important', () => {
    const [rule] = byClass('.x { color: red !important; }', 'x');
    assert.deepStrictEqual(rule.declarations[0], { prop: 'color', value: 'red', important: true });
  });

  it('returns every rule for the same class', () => {
    const rules = byClass('.btn { color: red }\n.other { x: y }\n.btn { margin: 0 }', 'btn');
    assert.deepStrictEqual(rules.map((r) => r.line), [1, 3]);
  });

  it('attributes compound selectors to every class, descendant selectors to the subject only', () => {
    const css = '.card.primary { a: b }\n.card .title { c: d }\n.list > .item + .item { e: f }';
    assert.deepStrictEqual(byClass(css, 'card').map((r) => r.selector), ['.card.primary']);
    assert.deepStrictEqual(byClass(css, 'primary').map((r) => r.selector), ['.card.primary']);
    assert.deepStrictEqual(byClass(css, 'title').map((r) => r.selector), ['.card .title']);
    assert.strictEqual(byClass(css, 'list').length, 0);
    assert.strictEqual(byClass(css, 'item').length, 1);
  });

  it('handles pseudo-classes and ignores classes inside pseudo arguments', () => {
    const css = '.btn:hover { a: b }\n.btn:focus-visible { c: d }\n.btn:not(.disabled) { e: f }\n.btn::before { g: h }';
    assert.deepStrictEqual(byClass(css, 'btn').map((r) => r.selector), [
      '.btn:hover',
      '.btn:focus-visible',
      '.btn:not(.disabled)',
      '.btn::before',
    ]);
    assert.strictEqual(byClass(css, 'disabled').length, 0);
  });

  it('records at-rule context, outermost first', () => {
    const css = '@supports (display: grid) {\n  @media (max-width: 600px) {\n    .card { padding: 8px }\n  }\n}';
    const [rule] = byClass(css, 'card');
    assert.deepStrictEqual(rule.atRules, ['@supports (display: grid)', '@media (max-width: 600px)']);
    assert.strictEqual(rule.line, 3);
  });

  it('splits selector lists, attributing only the matching selector', () => {
    const css = '.a, .b:hover, div > .c { color: red }';
    assert.deepStrictEqual(byClass(css, 'a').map((r) => r.selector), ['.a']);
    assert.deepStrictEqual(byClass(css, 'b').map((r) => r.selector), ['.b:hover']);
    assert.deepStrictEqual(byClass(css, 'c').map((r) => r.selector), ['div > .c']);
  });

  it('skips rules without declarations and unescapes class names', () => {
    const css = '.empty {}\n.md\\:flex { display: flex }';
    assert.strictEqual(byClass(css, 'empty').length, 0);
    assert.strictEqual(byClass(css, 'md:flex').length, 1);
  });

  it('resolves SCSS nesting and ignores mixins', () => {
    const scss = [
      '$pad: 4px;',
      '@mixin ghost { .inside-mixin { opacity: 0 } }',
      '.card {',
      '  padding: $pad;',
      '  &__title { font-weight: bold; }',
      '  &:hover { color: red; }',
      '  .icon { width: 1em; }',
      '  @media (min-width: 800px) { &--wide { width: 100%; } }',
      '  // line comment',
      '}',
    ].join('\n');
    assert.deepStrictEqual(byClass(scss, 'card', 'scss').map((r) => r.selector), ['.card', '.card:hover']);
    assert.strictEqual(byClass(scss, 'card__title', 'scss')[0].line, 5);
    assert.strictEqual(byClass(scss, 'icon', 'scss')[0].selector, '.card .icon');
    const [wide] = byClass(scss, 'card--wide', 'scss');
    assert.deepStrictEqual(wide.atRules, ['@media (min-width: 800px)']);
    assert.strictEqual(byClass(scss, 'inside-mixin', 'scss').length, 0);
  });

  it('parses LESS variables, mixin definitions and calls', () => {
    const less = '@c: blue;\n.bordered(@w: 2px) { border: @w solid; }\n.box { .bordered(); color: @c; &-head { x: y } }';
    const [box] = byClass(less, 'box', 'less');
    assert.deepStrictEqual(box.declarations.map((d) => d.prop), ['color']);
    assert.strictEqual(byClass(less, 'box-head', 'less').length, 1);
    assert.strictEqual(byClass(less, 'bordered', 'less').length, 0);
  });

  it('throws on unrecoverable CSS so callers can skip the file', () => {
    assert.throws(() => parseStylesheet('.card { color: red'));
  });

  it('tolerates odd but parseable input', () => {
    assert.deepStrictEqual(parseStylesheet(''), []);
    assert.strictEqual(byClass('.a { color: }', 'a').length, 1);
  });

  it('maps file extensions to syntax', () => {
    assert.strictEqual(syntaxForPath('/x/a.SCSS'), 'scss');
    assert.strictEqual(syntaxForPath('a.less'), 'less');
    assert.strictEqual(syntaxForPath('a.css'), 'css');
  });
});
