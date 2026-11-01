export interface ClassToken {
  className: string;
  /** Offsets into the document text, end exclusive. */
  start: number;
  end: number;
}

type Segment = [start: number, end: number];

// `class=`, `className=`, `:class=`, `v-bind:class=`, not preceded by an identifier char or `.`/`-`.
const ATTR = /(?<![\w$.:-])(v-bind:|:)?(?:class|className)\s*=\s*/g;

/** Returns the class token under `offset` if it sits inside a class attribute's static text. */
export function classAt(text: string, offset: number): ClassToken | undefined {
  ATTR.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = ATTR.exec(text)); ) {
    const open = m.index + m[0].length;
    if (open > offset) return undefined;
    const quote = text[open];
    let segments: Segment[];
    let end: number;
    if (quote === '"' || quote === "'") {
      if (m[1]) {
        ({ end, segments } = scanJs(text, open + 1, quote)); // Vue binding: JS expression in quotes
      } else {
        end = text.indexOf(quote, open + 1);
        if (end === -1) return undefined;
        segments = [[open + 1, end]];
      }
    } else if (quote === '{') {
      ({ end, segments } = scanJs(text, open + 1, '}'));
    } else {
      continue;
    }
    ATTR.lastIndex = end;
    if (offset > end) continue;
    return tokenAt(text, segments, offset);
  }
  return undefined;
}

function tokenAt(text: string, segments: Segment[], offset: number): ClassToken | undefined {
  for (const [s, e] of segments) {
    if (offset < s || offset >= e) continue;
    for (const m of text.slice(s, e).matchAll(/\S+/g)) {
      const start = s + m.index;
      const end = start + m[0].length;
      if (offset >= start && offset < end) return { className: m[0], start, end };
    }
  }
  return undefined;
}

/**
 * Scans a JS expression from `i` until `terminator` (at brace depth 0) and collects the static
 * parts of string and template literals. Returns the terminator's offset.
 */
function scanJs(text: string, i: number, terminator: string): { end: number; segments: Segment[] } {
  const segments: Segment[] = [];
  let depth = 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === terminator && depth === 0) return { end: i, segments };
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '"' || ch === "'") {
      const start = i + 1;
      for (i = start; i < text.length && text[i] !== ch && text[i] !== '\n'; i++) if (text[i] === '\\') i++;
      segments.push([start, i]);
    } else if (ch === '`') {
      let start = i + 1;
      for (i = start; i < text.length && text[i] !== '`'; i++) {
        if (text[i] === '\\') i++;
        else if (text[i] === '$' && text[i + 1] === '{') {
          segments.push([start, i]);
          const inner = scanJs(text, i + 2, '}');
          segments.push(...inner.segments);
          i = inner.end;
          start = i + 1;
        }
      }
      segments.push([start, i]);
    }
  }
  return { end: text.length, segments };
}
