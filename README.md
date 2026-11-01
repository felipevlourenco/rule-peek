# RulePeek

Hover a CSS class name in your markup and see the CSS rules behind it — properties, selectors, media queries and the
stylesheet location — in a native VS Code tooltip. No more jumping between components and stylesheets.

## Example

```tsx
<div className="card primary-card">Hello world</div>
```

```css
.card {
  display: flex;
  padding: 16px;
  border-radius: 8px;
}

.primary-card {
  background-color: #2563eb;
  color: white;
}

@media (max-width: 600px) {
  .card {
    padding: 8px;
  }
}
```

With that CSS in `src/styles.css`, hovering `card` shows:

> **.card** · 2 rules
>
> [src/styles.css:1](#)
> ```css
> .card {
>   display: flex;
>   padding: 16px;
>   border-radius: 8px;
> }
> ```
> [src/styles.css:13](#)
> ```css
> @media (max-width: 600px) {
>   .card {
>     padding: 8px;
>   }
> }
> ```

Each location is a link: click it to open the stylesheet at that line. When a class has more than 10 rules, the first
10 are shown.

## Supported files

| Hover in | Class syntaxes recognized |
| --- | --- |
| HTML | `class="card primary"` |
| JSX / TSX, JS / TS | `className="card"`, `className={"card"}`, `` className={`card ${x ? "on" : ""}`} ``, `className={cond ? "a" : "b"}`, `className={clsx("a", { "b": x })}` |
| Vue | `class="card"`, `:class="{ 'is-active': on }"`, `v-bind:class="[x ? 'a' : 'b']"` |
| Svelte | `class="card"` |

Vue and Svelte need an extension that registers the `vue` / `svelte` languages (e.g. Vue - Official, Svelte for VS Code).

Only statically written class names are recognized: string literals and the static parts of template literals. The
hover only appears when the cursor is on a class token inside a class attribute, never on the same word elsewhere.

## Supported stylesheets

`.css`, `.scss` and `.less`, parsed with [PostCSS](https://postcss.org/) (`postcss-scss`, `postcss-less`) and
`postcss-selector-parser`:

- Multiple rules, multiple stylesheets, selector lists (`.a, .b`), compound selectors (`.card.primary`).
- Pseudo-classes/elements (`.btn:hover`, `.btn::before`) are shown with their full selector.
- Enclosing at-rules (`@media`, `@supports`, `@layer`, …) are shown around the rule.
- A rule belongs to the classes of its *subject* (last compound selector): `.card .title` shows on `title`, not `card`;
  `.btn:not(.disabled)` shows on `btn` only.
- SCSS/LESS nesting is resolved: `.card { &__title {} &:hover {} .icon {} }` gives `.card__title`, `.card:hover`,
  `.card .icon`. Mixin bodies (`@mixin`, LESS `.mixin()`) are ignored.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `cssClassHover.enabled` | `true` | Turn the hover (and indexing) on or off. |
| `cssClassHover.include` | `["**/*.{css,scss,less}"]` | Globs of stylesheets to index. |
| `cssClassHover.exclude` | `node_modules`, `dist`, `build`, `out`, `.next`, `.nuxt`, `.svelte-kit`, `coverage`, `.git` | Globs to skip. Don't nest `{}` braces inside one pattern. |

## How it works

On activation (when an HTML/JS/TS/Vue/Svelte file opens) RulePeek scans every workspace folder once and indexes rules
by class name. File watchers keep the index current: saving a stylesheet re-parses only that file; creating or deleting
stylesheets triggers a quick rescan that parses only new files. Hovers are plain map lookups. Stylesheets that fail to
parse are skipped (and logged in the **RulePeek** output channel); if a previously valid file breaks mid-edit, its last
good version stays indexed.

```text
src/
  extension.ts                         activation, wiring
  providers/cssClassHoverProvider.ts   HoverProvider + markdown rendering
  services/classExtractor.ts           finds the class token under the cursor (no vscode dependency)
  services/cssParser.ts                PostCSS → rules per class (no vscode dependency)
  services/workspaceStyleIndex.ts      workspace scan, watchers, class → rules index
test/
  suite/                               mocha tests (unit + VS Code integration)
  fixtures/workspace/                  sample project opened by integration tests
```

## Development

```bash
npm install
npm run compile        # or: npm run watch
```

Press **F5** (launch config *Run Extension*) to open an Extension Development Host with the fixture project in
`test/fixtures/workspace`. Open `src/App.tsx` there and hover a class.

### Tests

```bash
npm run test:unit      # parser + extractor tests in plain Node, ~1s
npm test               # full suite inside a downloaded VS Code instance (unit + hover + live-update tests)
```

### Packaging

```bash
npx @vscode/vsce package
```

## Limitations

- Classes built at runtime (`"btn-" + size`, variables, unquoted object keys like `{ active: on }`) are not detected.
- Svelte `class:name={…}` directives and `{expressions}` inside a plain `class="…"` are not parsed.
- Styles inside `<style>` blocks of Vue/Svelte/HTML files, CSS Modules (`styles.card`), CSS-in-JS and indented
  `.sass` files are not indexed.
- SCSS `@extend`/`@include` are not expanded; selectors with interpolation (`#{$x}`) are skipped.
- Stylesheet changes are picked up when saved to disk, not while unsaved.
- Parsing runs on the extension host thread; very large stylesheets (multi‑MB) can make the first scan slow.
