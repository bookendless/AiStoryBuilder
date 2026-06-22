/**
 * 章見出しの決定的検出（AI不要）
 *
 * 取り込んだ本文（章ドラフト）から章境界の候補を正規表現で検出する。
 * 実コーパス分析で判明した日本語小説の見出し規約に対応する:
 *  - 「第」あり: `第3章` `第三話` `### 第5章`
 *  - 「第」なし: `一話 タイトル`（全角空白区切り）`０１章` `02章`（誤検出防止のため単位直後に区切りor行末を要求）
 *  - 話数物の番号のみ形式: `００ 入学前の疑惑？`（番号＋全角空白＋タイトル）
 *  - 特殊見出し: `プロローグ` `序章` `エピローグ` など
 *  - markdown見出し: `# タイトル` 〜 `### タイトル`
 *
 * シーン区切り記号（`◇◆◇` `***` `===` など）は場面転換であって章境界ではないため、
 * 既定では返さない（includeSceneBreaks 指定時のみ kind:'scene-break' として返す）。
 */

export interface HeadingMatch {
    /** 0始まりの行番号 */
    lineIndex: number;
    /** 全文中の行頭 char オフセット（常に行頭） */
    offset: number;
    /** 見出し行そのまま（章bodyに含めたまま残す） */
    rawLine: string;
    /** 整形済みタイトル（markdown `#` や前後空白を除去） */
    title: string;
    kind: 'chapter' | 'scene-break';
}

export interface DetectHeadingsOptions {
    /** シーン区切り記号の行も候補として返す（既定 false） */
    includeSceneBreaks?: boolean;
}

/** 見出し候補行の最大長（これより長い行は本文とみなす） */
const MAX_HEADING_LENGTH = 30;

const NUM = '(?:[0-9０-９]+|[一二三四五六七八九十百千〇零]+)';
const UNIT = '[章話部編節幕]';
const MD_PREFIX = '(?:(#{1,3})[ \\u3000]*)?';
/** 番号見出しの後ろに許す区切り（これが無い場合は行末のみ許可） */
const SEP = '[ \\u3000:：．.、・〜~―－‐「『（(]';

/** 第N章/N章/N話 系（第なし形は単位直後に区切りor行末を要求し「三話まで読んだ」等を弾く） */
const NUMBERED_HEADING = new RegExp(
    `^${MD_PREFIX}(第${NUM}${UNIT}|${NUM}${UNIT})(?:${SEP}.*)?$`
);

/** 話数物の「番号＋全角空白＋タイトル」形式（単位なし。例: ００ 入学前の疑惑？※実際は全角空白区切り） */
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);
const NUMBERED_SPACE_HEADING = new RegExp(`^${MD_PREFIX}${NUM}${IDEOGRAPHIC_SPACE}+.+$`);

/** 序章・プロローグ等の特殊見出し */
const SPECIAL_HEADING = new RegExp(
    `^${MD_PREFIX}(序章|終章|序幕|終幕|間章|幕間|プロローグ|エピローグ|まえがき|あとがき)(?:${SEP}.*)?$`
);

/** markdown 見出し（# 〜 ###。番号や特殊語が無くても見出しとみなす） */
const MARKDOWN_HEADING = /^(#{1,3})[ \u3000]+(\S.*)$/;

/** シーン区切り: 記号のみで構成される行（数字は含めない） */
const SCENE_BREAK_CHARS = /^[◇◆□■☆★○●△▲▽▼＊*＋+＝=‐－—―ー~〜・×†‡§…‥.,、。 \u3000-]+$/;
const SCENE_BREAK_MIN_SYMBOLS = 3;

/** 本文の文末・台詞として除外する形（？！は見出し題名にも使われるため句点のみ弾く） */
function isProseLike(trimmed: string): boolean {
    if (/[。｡]$/.test(trimmed)) return true;
    if (/^[「『（(]/.test(trimmed)) return true;
    return false;
}

function isSceneBreak(trimmed: string): boolean {
    if (!SCENE_BREAK_CHARS.test(trimmed)) return false;
    const symbols = trimmed.replace(/[ \u3000]/g, '');
    return symbols.length >= SCENE_BREAK_MIN_SYMBOLS;
}

/** 見出し行からタイトルを整形（markdown `#` を除去して trim） */
function cleanTitle(trimmed: string): string {
    return trimmed.replace(/^#{1,3}[ \u3000]*/, '').trim();
}

/**
 * 本文から章見出し候補を検出する。
 * 入力は行末正規化済み（LFのみ）であることを前提とする（normalizeLineEndings を通すこと）。
 * 戻り値は offset 昇順。
 */
export function detectHeadings(text: string, opts?: DetectHeadingsOptions): HeadingMatch[] {
    const includeSceneBreaks = opts?.includeSceneBreaks ?? false;
    const matches: HeadingMatch[] = [];
    if (!text) return matches;

    const lines = text.split('\n');
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (trimmed && trimmed.length <= MAX_HEADING_LENGTH && !isProseLike(trimmed)) {
            if (isSceneBreak(trimmed)) {
                if (includeSceneBreaks) {
                    matches.push({ lineIndex: i, offset, rawLine, title: trimmed, kind: 'scene-break' });
                }
            } else if (
                NUMBERED_HEADING.test(trimmed) ||
                NUMBERED_SPACE_HEADING.test(trimmed) ||
                SPECIAL_HEADING.test(trimmed) ||
                MARKDOWN_HEADING.test(trimmed)
            ) {
                matches.push({ lineIndex: i, offset, rawLine, title: cleanTitle(trimmed), kind: 'chapter' });
            }
        }

        offset += rawLine.length + 1; // +1 = '\n'
    }

    return matches;
}
