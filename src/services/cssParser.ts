import postcss, { AtRule, Container, Declaration, Root, Rule } from 'postcss';
import postcssScss from 'postcss-scss';
import postcssLess from 'postcss-less';
import selectorParser from 'postcss-selector-parser';

export type StyleSyntax = 'css' | 'scss' | 'less';

export interface CssDeclaration {
  prop: string;
  value: string;
  important: boolean;
}

/** One rule, attributed to one class that appears in the rule's subject compound selector. */
export interface CssRule {
  className: string;
  /** The single (comma-free) resolved selector that matched, e.g. `.card:hover`. */
  selector: string;
  declarations: CssDeclaration[];
  /** Enclosing at-rules, outermost first, e.g. `@media (max-width: 600px)`. */
  atRules: string[];
  /** 1-based line of the rule in its stylesheet. */
  line: number;
}

const parsers = { css: postcss.parse, scss: postcssScss.parse, less: postcssLess.parse };

// At-rules whose bodies are templates, not real rules.
const TEMPLATE_AT_RULES = new Set(['mixin', 'function', 'each', 'for', 'while', 'if', 'else']);

export function syntaxForPath(path: string): StyleSyntax {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'scss' || ext === 'less' ? ext : 'css';
}

/** Parses a stylesheet into rules keyed by class. Throws on unrecoverable syntax errors. */
export function parseStylesheet(text: string, syntax: StyleSyntax = 'css'): CssRule[] {
  const root = parsers[syntax](text) as Root;
  const rules: CssRule[] = [];

  root.walkRules((rule) => {
    const atRules: string[] = [];
    for (let p = rule.parent as Container | undefined; p && p.type !== 'root'; p = p.parent as Container | undefined) {
      if (p.type === 'atrule') {
        const at = p as AtRule;
        if (TEMPLATE_AT_RULES.has(at.name)) return;
        atRules.unshift(`@${at.name} ${at.params}`.trim());
      }
    }
    const declarations = (rule.nodes ?? [])
      .filter((n): n is Declaration => n.type === 'decl')
      .map((d) => ({ prop: d.prop, value: d.value, important: !!d.important }));
    if (!declarations.length) return;

    for (const selector of resolveSelectors(rule)) {
      for (const className of subjectClasses(selector)) {
        rules.push({ className, selector, declarations, atRules, line: rule.source?.start?.line ?? 1 });
      }
    }
  });
  return rules;
}

/** Expands nesting (`&__title`, `&:hover`, descendant nesting) into flat selectors. */
function resolveSelectors(rule: Rule): string[] {
  let parents: string[] | undefined;
  for (let p = rule.parent as Container | undefined; p && p.type !== 'root'; p = p.parent as Container | undefined) {
    if (p.type === 'rule') {
      parents = resolveSelectors(p as Rule);
      break;
    }
  }
  const own = rule.selectors.map((s) => s.trim());
  if (!parents) return own;
  return parents.flatMap((ps) => own.map((s) => (s.includes('&') ? s.replace(/&/g, ps) : `${ps} ${s}`)));
}

/** Classes in the last compound selector (after the last combinator), ignoring pseudo arguments. */
function subjectClasses(selector: string): string[] {
  const classes: string[] = [];
  try {
    selectorParser((root) => {
      const nodes = root.first?.nodes ?? [];
      let start = 0;
      nodes.forEach((n, i) => {
        if (n.type === 'combinator') start = i + 1;
      });
      for (const n of nodes.slice(start)) if (n.type === 'class') classes.push(n.value);
    }).processSync(selector);
  } catch {
    // Unparseable selector (e.g. SCSS interpolation) — just skip it.
  }
  return classes;
}
