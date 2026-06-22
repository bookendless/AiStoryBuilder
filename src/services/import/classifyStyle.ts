/**
 * 文体フェーズ: 機械計測（Phase A）+ AI分類（Phase B）のハイブリッドで
 * アプリの文体設定8軸（writingStyle）を推測する。
 *
 * - 客観軸（人称・硬軟・リズム・会話比率）: 正規表現計測が確実なため、
 *   AI出力が不正・欠落のときの フォールバック値 として使う
 * - 主観軸（基本文体・比喩・感情描写・トーン）: AIでしか判定できないため、
 *   不正値は空にする（無理に埋めない）
 * - AI出力は constants/writingStyle の選択肢と照合し、選択肢外の値を捨てる
 * - 文体は付加情報のため、AI呼び出しの失敗で取り込み全体を止めない
 *   （中断 AbortError のみ再送出する）
 */

import { Project } from '../../types/project';
import { AISettings } from '../../types/ai';
import { AIRunner } from '../../types/sequel';
import {
    STYLE_OPTIONS,
    PERSPECTIVE_OPTIONS,
    FORMALITY_OPTIONS,
    RHYTHM_OPTIONS,
    METAPHOR_OPTIONS,
    DIALOGUE_OPTIONS,
    EMOTION_OPTIONS,
    TONE_OPTIONS,
    STYLE_SAMPLE_EXTRACT_CHARS,
} from '../../constants/writingStyle';
import { parseJsonLoose } from '../summarization/parseJson';
import { buildStyleClassifyPrompt } from '../prompts/import';
import { computeStyleMetrics, formatStyleMetrics, StyleMetrics } from './analyzeStyleMetrics';
import { STYLE_MIN_CHARS, STYLE_EXCERPT_CHARS, IMPORT_PROMPT_HARD_CAP } from './constants';

export type WritingStyle = NonNullable<Project['writingStyle']>;

export interface StyleAnalysis {
    /** 推測した文体設定（判定できなかった軸は空文字） */
    writingStyle: WritingStyle;
    /** 文体の特徴メモ（AIの自由記述。確認画面の根拠表示用） */
    styleNote: string;
}

interface StyleClassifyOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
}

/** AIが返す想定のJSON形状 */
interface RawStyleResponse {
    style?: string;
    perspective?: string;
    formality?: string;
    rhythm?: string;
    metaphor?: string;
    dialogue?: string;
    emotion?: string;
    tone?: string;
    styleNote?: string;
}

/** styleNote の保存上限（確認UIでの表示を想定した短いメモ） */
const STYLE_NOTE_MAX_CHARS = 200;

/**
 * 値を選択肢と照合し、一致しなければフォールバックを返す。
 * 「一人称」のような省略表記は「一人称（私/僕/俺）」へ寄せる（括弧前の前方一致）。
 */
function pickOption(value: unknown, options: readonly string[], fallback = ''): string {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (!v) return fallback;
    const exact = options.find(o => o === v);
    if (exact) return exact;
    const byPrefix = options.find(o => {
        const head = o.split('（')[0];
        return head.length > 0 && (v === head || v.startsWith(head));
    });
    return byPrefix ?? fallback;
}

/**
 * 本文から代表抜粋を取り出す（冒頭・中間・終盤）。
 * 短い本文は全文1抜粋。途中開始の抜粋は近くの改行まで送り、文の頭から始める。
 */
export function sampleExcerpts(prose: string, excerptChars: number = STYLE_EXCERPT_CHARS): string[] {
    const text = prose.trim();
    if (text.length <= excerptChars * 3) return [text];

    const positions = [
        0,
        Math.floor(text.length / 2) - Math.floor(excerptChars / 2),
        text.length - excerptChars,
    ];
    return positions.map((pos, i) => {
        let start = pos;
        if (i > 0) {
            // 文の途中から始まらないよう、近くの改行直後へ送る（見つからなければそのまま）
            const nl = text.indexOf('\n', pos);
            if (nl !== -1 && nl < pos + Math.floor(excerptChars / 2)) start = nl + 1;
        }
        return text.slice(start, start + excerptChars).trim();
    }).filter(Boolean);
}

/**
 * 本文から文体見本（few-shot 用の代表抜粋）を1つ取り出す。
 *
 * 冒頭はプロローグ・情景設定などで作品全体の語りと異なることが多いため、
 * 物語が走り出している中間部から取る。段落頭に揃えて開始し、
 * 末尾は文の途中で切れないよう最後の文末（。！？」）まで戻す。
 * 決定的処理（AI不使用）。取り込みパイプラインと StyleSampleModal の「本文から抽出」で共用。
 */
export function extractStyleSample(prose: string, maxChars: number = STYLE_SAMPLE_EXTRACT_CHARS): string {
    const text = prose.trim();
    if (!text) return '';
    if (text.length <= maxChars) return text;

    // 中間部の開始位置（段落頭へ送る。近くに改行がなければそのまま）
    let start = Math.floor(text.length / 2) - Math.floor(maxChars / 2);
    const nl = text.indexOf('\n', start);
    if (nl !== -1 && nl < start + Math.floor(maxChars / 2)) start = nl + 1;

    const slice = text.slice(start, start + maxChars);
    // 文の途中で切れないよう、最後の文末記号まで戻す（見つからなければそのまま）
    const lastEnd = Math.max(
        slice.lastIndexOf('。'),
        slice.lastIndexOf('！'),
        slice.lastIndexOf('？'),
        slice.lastIndexOf('」'),
    );
    const cut = lastEnd >= Math.floor(maxChars / 2) ? slice.slice(0, lastEnd + 1) : slice;
    return cut.trim();
}

/** 機械計測のみから文体設定を組み立てる（AIスキップ時・AI失敗時のフォールバック） */
function fromMetricsOnly(metrics: StyleMetrics): StyleAnalysis {
    return {
        writingStyle: {
            style: '',
            perspective: metrics.labels.perspective,
            formality: metrics.labels.formality,
            rhythm: metrics.labels.rhythm,
            metaphor: '',
            dialogue: metrics.labels.dialogue,
            emotion: '',
            tone: '',
        },
        styleNote: '',
    };
}

/**
 * 本文から文体設定を推測する。
 *
 * 1. 機械計測（決定的・ローカル）
 * 2. 本文が十分にあれば AI 分類1回（低温度・閉じた選択肢）
 * 3. AI出力を選択肢と照合: 客観軸は計測値、主観軸は空へフォールバック
 */
export async function analyzeWritingStyle(prose: string, options: StyleClassifyOptions): Promise<StyleAnalysis> {
    const { run, signal } = options;
    const text = prose.trim();
    const metrics = computeStyleMetrics(text);

    // 短い断片はAIの判定材料不足で幻覚リスクが高いため、計測のみで返す
    if (text.length < STYLE_MIN_CHARS) return fromMetricsOnly(metrics);

    let raw: string;
    try {
        raw = await run(
            buildStyleClassifyPrompt(sampleExcerpts(text), formatStyleMetrics(metrics)),
            { signal, temperature: 0.2, maxPromptLength: IMPORT_PROMPT_HARD_CAP }
        );
    } catch (err) {
        // ユーザー中断はパイプライン全体を止める。それ以外（API障害等）は
        // 文体が付加情報のため、計測のみの結果に格下げして取り込みを続行する。
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        return fromMetricsOnly(metrics);
    }

    const parsed = parseJsonLoose<RawStyleResponse>(raw);
    if (!parsed) return fromMetricsOnly(metrics);

    return {
        writingStyle: {
            style: pickOption(parsed.style, STYLE_OPTIONS),
            perspective: pickOption(parsed.perspective, PERSPECTIVE_OPTIONS, metrics.labels.perspective),
            formality: pickOption(parsed.formality, FORMALITY_OPTIONS, metrics.labels.formality),
            rhythm: pickOption(parsed.rhythm, RHYTHM_OPTIONS, metrics.labels.rhythm),
            metaphor: pickOption(parsed.metaphor, METAPHOR_OPTIONS),
            dialogue: pickOption(parsed.dialogue, DIALOGUE_OPTIONS, metrics.labels.dialogue),
            emotion: pickOption(parsed.emotion, EMOTION_OPTIONS),
            tone: pickOption(parsed.tone, TONE_OPTIONS),
        },
        styleNote: typeof parsed.styleNote === 'string'
            ? parsed.styleNote.trim().slice(0, STYLE_NOTE_MAX_CHARS)
            : '',
    };
}
