/**
 * LLM応答から寛容にJSONを取り出す共通ヘルパー
 *
 * モデルはコードフェンス・前置き/後置きの文章・二重波括弧（{{…}}）を付けることがある。
 * 正規表現の貪欲マッチ（/\{[\s\S]*\}/）は後置き文中の波括弧まで取り込んで壊れ、
 * 末尾の `}}` を一律に削る処理はネストしたオブジェクトで終わる正しいJSONを壊すため、
 * 文字列リテラルを考慮した括弧の対応スキャンで「最初にパースできる値」を探す。
 * AI応答のJSON解析はすべてこのモジュールを経由すること。
 */

export type JsonKind = 'object' | 'array' | 'any';

export interface ExtractedJson {
  /** パースに成功したJSON文字列（コードフェンス除去後のテキストの一部） */
  source: string;
  value: unknown;
}

export interface ExtractJsonOptions {
  /** 追加の受理条件。false を返した候補は捨てて次の候補を探す */
  accept?: (value: unknown) => boolean;
}

/** 開き括弧の探索回数の上限（JSONを含まない長文での過剰なスキャンを防ぐ） */
const MAX_SCAN_ATTEMPTS = 50;

const stripCodeFences = (text: string): string => text.replace(/```(?:json)?/gi, '').trim();

const matchesKind = (value: unknown, kind: JsonKind): boolean => {
  if (value === null || typeof value !== 'object') return false;
  if (kind === 'array') return Array.isArray(value);
  if (kind === 'object') return !Array.isArray(value);
  return true;
};

/**
 * 文字列リテラル内の生の改行・タブ等を JSON のエスケープに置き換える。
 * モデルが値の中で改行してしまい JSON.parse が失敗するケースの救済用。
 */
const escapeControlCharsInStrings = (json: string): string => {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      } else if (ch === '\n') {
        out += '\\n';
        continue;
      } else if (ch === '\r') {
        out += '\\r';
        continue;
      } else if (ch === '\t') {
        out += '\\t';
        continue;
      } else if (ch < ' ') {
        continue;
      }
    } else if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
};

const tryParse = (json: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(json) as unknown };
  } catch {
    // 続行：制御文字を修復して再試行
  }
  try {
    return { ok: true, value: JSON.parse(escapeControlCharsInStrings(json)) as unknown };
  } catch {
    return { ok: false };
  }
};

/** start 位置の開き括弧に対応する閉じ括弧の位置を返す（閉じていなければ -1） */
const findMatchingClose = (text: string, start: number): number => {
  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
};

/**
 * テキスト中で最初にパースできる JSON 値を探す。
 * 見つからなければ null（呼び出し側でフォールバック処理）。
 */
export function extractJson(
  text: string,
  kind: JsonKind = 'any',
  options: ExtractJsonOptions = {}
): ExtractedJson | null {
  if (!text || typeof text !== 'string') return null;

  const isAcceptable = (value: unknown): boolean =>
    matchesKind(value, kind) && (options.accept ? options.accept(value) : true);

  const cleaned = stripCodeFences(text);

  const whole = tryParse(cleaned);
  if (whole.ok && isAcceptable(whole.value)) {
    return { source: cleaned, value: whole.value };
  }

  const openPattern = kind === 'object' ? /\{/g : kind === 'array' ? /\[/g : /[[{]/g;
  // パースに失敗した候補の内側から探索を再開すると、壊れた外側JSONの断片（ネストした一部）を
  // 誤って返してしまうため、その場合は候補の終端より後ろから探索を続ける。
  // パースには成功したが受理条件で弾かれた候補は、内側の値が正当な候補になり得るので飛ばさない。
  let resumeFrom = 0;
  let attempts = 0;

  for (const match of cleaned.matchAll(openPattern)) {
    const start = match.index;
    if (start < resumeFrom) continue;
    if (++attempts > MAX_SCAN_ATTEMPTS) break;

    const end = findMatchingClose(cleaned, start);
    // 閉じていない（出力が途中で切れた等）場合、以降の候補はすべてその内側なので打ち切る
    if (end === -1) break;

    const candidate = cleaned.slice(start, end + 1);
    const parsed = tryParse(candidate);
    if (parsed.ok) {
      if (isAcceptable(parsed.value)) {
        return { source: candidate, value: parsed.value };
      }
      continue;
    }

    // 二重波括弧（{{ ... }}）で包まれている場合は内側を試す
    if (candidate.startsWith('{{') && candidate.endsWith('}}')) {
      const inner = candidate.slice(1, -1);
      const innerParsed = tryParse(inner);
      if (innerParsed.ok && isAcceptable(innerParsed.value)) {
        return { source: inner, value: innerParsed.value };
      }
    }

    resumeFrom = end + 1;
  }

  return null;
}

/**
 * テキスト中の最初の JSON オブジェクト or 配列をパースする。
 * 失敗した場合は null を返す（呼び出し側でフォールバック処理）。
 */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  const found = extractJson(text, 'any');
  return found ? (found.value as T) : null;
}

/**
 * テキスト中の最初の JSON オブジェクト（配列を除く）をパースする。
 * 失敗した場合は null を返す。
 */
export function parseJsonObject<T extends object = Record<string, unknown>>(text: string): T | null {
  const found = extractJson(text, 'object');
  return found ? (found.value as T) : null;
}

/** 要素がすべて（配列でない）オブジェクトの配列か。空配列も受理する */
export const isJsonObjectArray = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));

/**
 * テキスト中の最初の「オブジェクトの配列」をパースする。
 * 本文中の「[1]」のような角括弧を誤って拾わないよう、要素がすべてオブジェクトの配列だけを受理する。
 */
export function parseJsonObjectArray<T extends object = Record<string, unknown>>(text: string): T[] | null {
  const found = extractJson(text, 'array', { accept: isJsonObjectArray });
  return found ? (found.value as T[]) : null;
}
