/** Keep a UTF-16 offset map while applying the same normalization as prompt sanitization. */
export function normalizeMapped(raw: string): { text: string; starts: number[]; ends: number[] } {
  let text = raw;
  let starts = Array.from({ length: raw.length }, (_, i) => i);
  let ends = starts.map(i => i + 1);
  const replace = (pattern: RegExp, replacement: string) => {
    const nextStarts: number[] = [], nextEnds: number[] = [];
    let next = '', at = 0;
    for (const m of text.matchAll(pattern)) {
      const from = m.index!, to = from + m[0].length;
      next += text.slice(at, from) + replacement;
      for (let i = at; i < from; i++) { nextStarts.push(starts[i]); nextEnds.push(ends[i]); }
      for (let i = 0; i < replacement.length; i++) { nextStarts.push(starts[from]); nextEnds.push(ends[to - 1]); }
      at = to;
    }
    next += text.slice(at);
    for (let i = at; i < starts.length; i++) { nextStarts.push(starts[i]); nextEnds.push(ends[i]); }
    text = next; starts = nextStarts; ends = nextEnds;
  };
  replace(/^\s+|\s+$/g, '');
  replace(/[<>]/g, '');
  replace(/javascript:|on\w+\s*=|data:text\/html|vbscript:/gi, '');
  // Match securityUtils without imposing its 50K default citation limit.
  replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  replace(/\n{3,}/g, '\n\n');
  replace(/ {5,}/g, ' ');
  return { text, starts, ends };
}

export function findQuote(raw: string, quote: string, offset = 0): Array<{ start: number; end: number; quote: string }> {
  const normalized = normalizeMapped(raw);
  const needle = normalizeMapped(quote).text;
  if (!needle || needle.length > 200) return [];
  const found: Array<{ start: number; end: number; quote: string }> = [];
  for (let i = normalized.text.indexOf(needle); i >= 0; i = normalized.text.indexOf(needle, i + 1)) {
    const start = normalized.starts[i], end = normalized.ends[i + needle.length - 1];
    found.push({ start: start + offset, end: end + offset, quote: raw.slice(start, end) });
  }
  return found;
}
