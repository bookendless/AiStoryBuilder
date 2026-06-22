/**
 * 文体の機械計測（Phase A）
 *
 * 取り込んだ小説本文から、正規表現と統計で確実に測れる文体特徴を抽出する。
 * AIを使わない決定的な処理のため、人称・会話比率などの客観軸は
 * AI分類（classifyStyle）の検証・フォールバック値としても用いる。
 *
 * 計測の前提:
 * - 人称・硬軟の判定は会話文（「」内）を除いた地の文だけで行う
 *   （セリフ内の「俺」「です」で語りの人称・文体を誤判定しないため）
 * - 判定材料が不足する軸はラベルを空文字にする（無理に埋めない）
 */

import {
    PERSPECTIVE_OPTIONS,
    FORMALITY_OPTIONS,
    RHYTHM_OPTIONS,
    DIALOGUE_OPTIONS,
} from '../../constants/writingStyle';

export interface StyleMetrics {
    /** 本文全体の文字数 */
    totalChars: number;
    /** 会話比率（「」内の文字数 ÷ 全体。0〜1） */
    dialogueRatio: number;
    /** 地の文の文の数 */
    narrativeSentenceCount: number;
    /** 地の文の平均文長（文字数） */
    avgSentenceLength: number;
    /** 文長の変動係数（標準偏差 ÷ 平均。ばらつきの指標） */
    sentenceLengthCV: number;
    /** 一人称代名詞（私/僕/俺 等）の出現回数（地の文のみ） */
    firstPersonCount: number;
    /** 三人称代名詞（彼/彼女）の出現回数（地の文のみ） */
    thirdPersonCount: number;
    /** 計測から導いた文体設定ラベル（判定できない軸は空文字） */
    labels: {
        perspective: (typeof PERSPECTIVE_OPTIONS)[number] | '';
        formality: (typeof FORMALITY_OPTIONS)[number] | '';
        rhythm: (typeof RHYTHM_OPTIONS)[number] | '';
        dialogue: (typeof DIALOGUE_OPTIONS)[number] | '';
    };
}

// ---- 判定しきい値 ----

/** 会話比率: これ以上で「会話多め」 */
const DIALOGUE_HIGH_RATIO = 0.35;
/** 会話比率: これ以下で「描写重視」 */
const DIALOGUE_LOW_RATIO = 0.12;
/** リズム判定に必要な地の文の最小文数 */
const RHYTHM_MIN_SENTENCES = 5;
/** 平均文長: これ以下で「短文中心」 */
const RHYTHM_SHORT_AVG = 25;
/** 平均文長: これ以上で「流れるような長文」 */
const RHYTHM_LONG_AVG = 60;
/** 変動係数: これ以上で「長短混合」 */
const RHYTHM_MIXED_CV = 0.65;
/** 人称判定に必要な最小出現回数 */
const PERSPECTIVE_MIN_COUNT = 3;
/** 人称判定: 優勢側が劣勢側の何倍必要か */
const PERSPECTIVE_DOMINANCE = 1.5;
/** 硬軟判定に必要な地の文の最小文数 */
const FORMALITY_MIN_SENTENCES = 5;
/** 文末の敬体率: これ以上で「柔らかめ」 */
const FORMALITY_POLITE_RATIO = 0.4;
/** 文末の常体率: これ以上（かつ敬体ほぼ無し）で「硬め」 */
const FORMALITY_PLAIN_RATIO = 0.25;

// 一人称・三人称の代名詞（助詞を伴う形に限定し、「私立」「彼方」等の複合語誤検出を抑える）
const FIRST_PERSON_RE = /(私|僕|俺|わたし|あたし|オレ|ボク)(は|が|の|を|に|も|だ|で|たち|自身)/g;
const THIRD_PERSON_RE = /(彼女|彼)(は|が|の|を|に|も|ら|たち)/g;

// 文末表現（splitSentences で句点を除去した後の末尾に対して判定）
const POLITE_ENDING_RE = /(です|ます|ました|でした|ません|でしょう|ましょう)$/;
const PLAIN_ENDING_RE = /(だ|である|だった|であった)$/;

/** 「」内の文字数を合計する（括弧自体は含めない） */
function countDialogueChars(text: string): number {
    let total = 0;
    for (const m of text.matchAll(/「([^「」]*)」/g)) {
        total += m[1].length;
    }
    return total;
}

/** 会話文（「」ごと）を取り除いた地の文を返す */
function stripDialogue(text: string): string {
    return text.replace(/「[^「」]*」/g, '');
}

/** 地の文を文単位に分割する（句点・感嘆・疑問・改行区切り。句読点は除去される） */
function splitSentences(narrative: string): string[] {
    return narrative
        .split(/[。！？\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/** 本文から文体の機械計測値とラベルを算出する */
export function computeStyleMetrics(prose: string): StyleMetrics {
    const text = prose.trim();
    const totalChars = text.length;

    const dialogueChars = countDialogueChars(text);
    const dialogueRatio = totalChars > 0 ? dialogueChars / totalChars : 0;

    const narrative = stripDialogue(text);
    const sentences = splitSentences(narrative);
    const narrativeSentenceCount = sentences.length;

    const avgSentenceLength = narrativeSentenceCount > 0
        ? sentences.reduce((sum, s) => sum + s.length, 0) / narrativeSentenceCount
        : 0;
    const variance = narrativeSentenceCount > 0
        ? sentences.reduce((sum, s) => sum + (s.length - avgSentenceLength) ** 2, 0) / narrativeSentenceCount
        : 0;
    const sentenceLengthCV = avgSentenceLength > 0 ? Math.sqrt(variance) / avgSentenceLength : 0;

    const firstPersonCount = [...narrative.matchAll(FIRST_PERSON_RE)].length;
    const thirdPersonCount = [...narrative.matchAll(THIRD_PERSON_RE)].length;

    return {
        totalChars,
        dialogueRatio,
        narrativeSentenceCount,
        avgSentenceLength,
        sentenceLengthCV,
        firstPersonCount,
        thirdPersonCount,
        labels: {
            perspective: judgePerspective(firstPersonCount, thirdPersonCount),
            formality: judgeFormality(sentences),
            rhythm: judgeRhythm(narrativeSentenceCount, avgSentenceLength, sentenceLengthCV),
            dialogue: judgeDialogue(totalChars, dialogueRatio),
        },
    };
}

function judgePerspective(first: number, third: number): StyleMetrics['labels']['perspective'] {
    if (first >= PERSPECTIVE_MIN_COUNT && first > third * PERSPECTIVE_DOMINANCE) {
        return '一人称（私/僕/俺）';
    }
    if (third >= PERSPECTIVE_MIN_COUNT && third > first * PERSPECTIVE_DOMINANCE) {
        return '三人称（彼/彼女）';
    }
    return '';
}

function judgeFormality(sentences: string[]): StyleMetrics['labels']['formality'] {
    if (sentences.length < FORMALITY_MIN_SENTENCES) return '';
    const polite = sentences.filter(s => POLITE_ENDING_RE.test(s)).length;
    const plain = sentences.filter(s => PLAIN_ENDING_RE.test(s)).length;
    const politeRatio = polite / sentences.length;
    const plainRatio = plain / sentences.length;
    if (politeRatio >= FORMALITY_POLITE_RATIO) return '柔らかめ';
    if (plainRatio >= FORMALITY_PLAIN_RATIO && politeRatio < 0.1) return '硬め';
    return '';
}

function judgeRhythm(count: number, avg: number, cv: number): StyleMetrics['labels']['rhythm'] {
    if (count < RHYTHM_MIN_SENTENCES) return '';
    if (avg >= RHYTHM_LONG_AVG) return '流れるような長文';
    if (avg <= RHYTHM_SHORT_AVG) return '短文中心';
    if (cv >= RHYTHM_MIXED_CV) return '長短混合';
    return 'テンポよく';
}

function judgeDialogue(totalChars: number, ratio: number): StyleMetrics['labels']['dialogue'] {
    if (totalChars === 0) return '';
    if (ratio >= DIALOGUE_HIGH_RATIO) return '会話多め';
    if (ratio <= DIALOGUE_LOW_RATIO) return '描写重視';
    return 'バランス型';
}

/** AI分類プロンプトや確認UIに渡す、人間可読の計測サマリーを整形する */
export function formatStyleMetrics(m: StyleMetrics): string {
    const lines = [
        `- 会話比率: ${Math.round(m.dialogueRatio * 100)}%（「」内の文字数の割合）`,
        `- 地の文の平均文長: ${Math.round(m.avgSentenceLength)}字（文数 ${m.narrativeSentenceCount}、ばらつき係数 ${m.sentenceLengthCV.toFixed(2)}）`,
        `- 一人称代名詞: ${m.firstPersonCount}回 / 三人称代名詞: ${m.thirdPersonCount}回（地の文のみ）`,
    ];
    const judged: string[] = [];
    if (m.labels.perspective) judged.push(`人称=${m.labels.perspective}`);
    if (m.labels.formality) judged.push(`硬軟=${m.labels.formality}`);
    if (m.labels.rhythm) judged.push(`リズム=${m.labels.rhythm}`);
    if (m.labels.dialogue) judged.push(`会話比率=${m.labels.dialogue}`);
    if (judged.length > 0) lines.push(`- 機械判定: ${judged.join(' / ')}`);
    return lines.join('\n');
}
