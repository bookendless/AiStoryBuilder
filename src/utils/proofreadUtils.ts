/**
 * 機械校正ユーティリティ
 *
 * AIを使わない正規表現ベースの原稿チェック。即時・無料で実行できる。
 * 日本語小説の慣習的な記法（かぎ括弧の対応、三点リーダ・ダッシュの用法、
 * 感嘆符・疑問符の後の全角スペース、段落の字下げ）を検査する。
 */

export type ProofreadIssueType =
  | 'unclosed-bracket'
  | 'ellipsis-style'
  | 'dash-style'
  | 'punctuation-space'
  | 'indentation';

export type ProofreadSeverity = 'warning' | 'info';

export interface ProofreadIssue {
  type: ProofreadIssueType;
  severity: ProofreadSeverity;
  /** 1始まりの行番号 */
  line: number;
  /** 指摘内容 */
  message: string;
  /** 該当箇所の抜粋 */
  excerpt: string;
}

export const PROOFREAD_TYPE_LABELS: Record<ProofreadIssueType, string> = {
  'unclosed-bracket': '括弧の対応',
  'ellipsis-style': '三点リーダ',
  'dash-style': 'ダッシュ',
  'punctuation-space': '感嘆符・疑問符',
  'indentation': '字下げ',
};

/** 行の抜粋を作る（長すぎる行は前後を切り詰め） */
function makeExcerpt(line: string, maxLength: number = 40): string {
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength)}…`;
}

/** 括弧の対応チェック（「」『』（）の開閉数を行単位で照合） */
const BRACKET_PAIRS: Array<{ open: string; close: string; label: string }> = [
  { open: '「', close: '」', label: 'かぎ括弧「」' },
  { open: '『', close: '』', label: '二重かぎ括弧『』' },
  { open: '（', close: '）', label: '丸括弧（）' },
];

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

// 全角スペース（no-irregular-whitespace対応のため文字列定数からRegExpを構築する）
const FULLWIDTH_SPACE = '　';
/** ！？の直後に地の文が続く（全角スペース・閉じ括弧・連続記号・行末を除く） */
const PUNCTUATION_SPACE_RE = new RegExp(
  `[！？](?![！？\\s${FULLWIDTH_SPACE}」』）】…―])(?!$)`
);
/** 行頭が空白（字下げ済み）で始まる */
const INDENTED_LINE_RE = new RegExp(`^[${FULLWIDTH_SPACE}\\s]`);

/**
 * 草案テキストを機械校正し、指摘リストを返す
 */
export function proofreadText(text: string): ProofreadIssue[] {
  if (!text) return [];

  const issues: ProofreadIssue[] = [];
  const lines = text.split('\n');

  // 括弧はテキスト全体で対応を確認（会話文が複数行に渡る場合があるため）
  BRACKET_PAIRS.forEach(({ open, close, label }) => {
    const openCount = countChar(text, open);
    const closeCount = countChar(text, close);
    if (openCount !== closeCount) {
      // 最初に不整合が発生する行を推定（初回検出時点で確定）
      let balance = 0;
      let issueLine = 1;
      for (let i = 0; i < lines.length; i++) {
        balance += countChar(lines[i], open) - countChar(lines[i], close);
        if (openCount > closeCount ? balance > 0 : balance < 0) {
          issueLine = i + 1;
          break;
        }
      }
      issues.push({
        type: 'unclosed-bracket',
        severity: 'warning',
        line: issueLine,
        message: `${label}の開き（${openCount}）と閉じ（${closeCount}）の数が一致しません`,
        excerpt: makeExcerpt(lines[issueLine - 1] ?? ''),
      });
    }
  });

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 三点リーダ: 「。。。」「・・・」は「……」を推奨
    if (/。{3,}|・{3,}/.test(line)) {
      issues.push({
        type: 'ellipsis-style',
        severity: 'info',
        line: lineNumber,
        message: '「。。。」「・・・」よりも三点リーダ「……」の使用が一般的です',
        excerpt: makeExcerpt(line),
      });
    }
    // 三点リーダの奇数個使用（……のように偶数個で使うのが慣習）
    const ellipsisRuns = line.match(/…+/g);
    if (ellipsisRuns?.some(run => run.length % 2 === 1)) {
      issues.push({
        type: 'ellipsis-style',
        severity: 'info',
        line: lineNumber,
        message: '三点リーダは「……」のように偶数個で使うのが慣習です',
        excerpt: makeExcerpt(line),
      });
    }

    // ダッシュの奇数個使用（――のように偶数個で使うのが慣習）
    const dashRuns = line.match(/―+/g);
    if (dashRuns?.some(run => run.length % 2 === 1)) {
      issues.push({
        type: 'dash-style',
        severity: 'info',
        line: lineNumber,
        message: 'ダッシュは「――」のように偶数個で使うのが慣習です',
        excerpt: makeExcerpt(line),
      });
    }

    // 感嘆符・疑問符の直後は全角スペース（文末・閉じ括弧前・連続記号は除外）
    if (PUNCTUATION_SPACE_RE.test(line)) {
      issues.push({
        type: 'punctuation-space',
        severity: 'info',
        line: lineNumber,
        message: '「！」「？」の直後に文が続く場合は全角スペースを入れるのが慣習です',
        excerpt: makeExcerpt(line),
      });
    }
  });

  // 字下げ: 地の文の段落が全角スペースで始まっていない（サンプリングして1件のみ指摘）
  const paragraphs = lines.filter(line => line.trim().length > 0);
  const nonIndented = paragraphs.filter(
    line => !INDENTED_LINE_RE.test(line) && !/^[「『（【〈《・―…]/.test(line)
  );
  if (paragraphs.length >= 3 && nonIndented.length > paragraphs.length / 2) {
    const firstLine = lines.findIndex(line => nonIndented.includes(line)) + 1;
    issues.push({
      type: 'indentation',
      severity: 'info',
      line: Math.max(firstLine, 1),
      message: `地の文の段落頭に全角スペース（字下げ）がない箇所が${nonIndented.length}箇所あります（縦書き・出版慣習では字下げが一般的）`,
      excerpt: makeExcerpt(nonIndented[0] ?? ''),
    });
  }

  return issues.sort((a, b) => a.line - b.line);
}

/** AI校正の1件分の修正（置換前→置換後） */
export interface Correction {
  before: string;
  after: string;
}

/**
 * 選択済みの修正候補を本文へ順に適用する（純粋関数）。
 * - split/join で全一致箇所を置換する（String.replace の「最初の1件のみ」「$特殊置換」の
 *   落とし穴を避けるため）。
 * - applied は「適用できた修正の件数」（出現回数ではなく修正候補の数）。
 */
export function applyCorrections(
  draft: string,
  corrections: Correction[]
): { newText: string; applied: number } {
  let newText = draft;
  let applied = 0;
  for (const c of corrections) {
    if (c.before && newText.includes(c.before)) {
      newText = newText.split(c.before).join(c.after);
      applied++;
    }
  }
  return { newText, applied };
}
