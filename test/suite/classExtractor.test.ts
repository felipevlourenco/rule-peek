import * as assert from 'assert';
import { classAt } from '../../src/services/classExtractor';

/** `|` in the source marks the cursor; returns the class name found there. */
function at(source: string): string | undefined {
  const offset = source.indexOf('|');
  return classAt(source.replace('|', ''), offset)?.className;
}

describe('classExtractor', () => {
  it('finds classes in an HTML class attribute', () => {
    assert.strictEqual(at('<div class="ca|rd primary-card"></div>'), 'card');
    assert.strictEqual(at("<div class='card |primary-card'></div>"), 'primary-card');
    assert.strictEqual(at('<div id="x"\n     class="a\n  b|b"></div>'), 'bb');
  });

  it('finds classes in a JSX className string', () => {
    assert.strictEqual(at('<div className="card prim|ary-card" />'), 'primary-card');
    assert.strictEqual(at('<div className={"c|ard"} />'), 'card');
  });

  it('distinguishes each class within the same attribute', () => {
    const src = '<div class="one two three">';
    const names = ['one', 'two', 'three'].map((n) => classAt(src, src.indexOf(n))?.className);
    assert.deepStrictEqual(names, ['one', 'two', 'three']);
  });

  it('returns the token range', () => {
    const src = '<p class="a card b">';
    assert.deepStrictEqual(classAt(src, src.indexOf('card') + 2), { className: 'card', start: 12, end: 16 });
  });

  it('reads static parts of template literals', () => {
    assert.strictEqual(at('<div className={`card pri|mary`} />'), 'primary');
    assert.strictEqual(at('<div className={`card ${big ? "lar|ge" : ""} x`} />'), 'large');
    assert.strictEqual(at('<div className={`card ${is|Big} x`} />'), undefined);
    assert.strictEqual(at('<div className={`card ${isBig} x|x`} />'), 'xx');
  });

  it('reads string literals in conditional and helper expressions', () => {
    assert.strictEqual(at('<div className={cond ? "active" : "inac|tive"} />'), 'inactive');
    assert.strictEqual(at('<div className={cond ? "act|ive" : "inactive"} />'), 'active');
    assert.strictEqual(at('<div className={clsx("btn", { "is-o|pen": open })} />'), 'is-open');
    assert.strictEqual(at('<div className={co|nd ? "a" : "b"} />'), undefined);
  });

  it('handles nested braces in JSX expressions', () => {
    const src = '<div className={cn({ a: x }, "b")} title="ti|tle" />';
    assert.strictEqual(at(src), undefined);
    assert.strictEqual(at('<div className={cn({ a: x }, "|b")} />'), 'b');
  });

  it('supports Vue bindings', () => {
    assert.strictEqual(at(`<div :class="{ 'is-ac|tive': on }"></div>`), 'is-active');
    assert.strictEqual(at(`<div v-bind:class="[on ? 'a|a' : 'bb']"></div>`), 'aa');
    assert.strictEqual(at(`<div :class="{ act|ive: on }"></div>`), undefined);
  });

  it('ignores the cursor outside class attributes', () => {
    assert.strictEqual(at('<div id="ca|rd" class="card"></div>'), undefined);
    assert.strictEqual(at('<div class="card">ca|rd</div>'), undefined);
    assert.strictEqual(at('<div cl|ass="card"></div>'), undefined);
    assert.strictEqual(at('<div class="card"|></div>'), undefined);
    assert.strictEqual(at('<div data-class="ca|rd"></div>'), undefined);
    assert.strictEqual(at('el.className = "ca|rd"'), undefined);
    assert.strictEqual(at('if (className === "ca|rd") {}'), undefined);
    assert.strictEqual(at('const card = 1; // ca|rd'), undefined);
  });

  it('survives unterminated attributes', () => {
    assert.strictEqual(at('<div class="ca|rd'), undefined);
    assert.strictEqual(at('<div className={"ca|rd"'), 'card');
  });
});
