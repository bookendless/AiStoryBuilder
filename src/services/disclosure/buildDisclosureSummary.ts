/**
 * AI利用状況の開示サマリー生成
 *
 * 小説家になろう・カクヨムは作品ごとにAI利用区分の申告を求めている。その申告を書くときの
 * 材料として、記録済みのAI呼び出しを工程別に整理したテキストを組み立てる。
 *
 * 重要な前提: このアプリが記録できるのは「AIを呼び出した回数」だけで、生成結果を実際に
 * 本文へ採用したかどうかは分からない。区分は採用の仕方で変わる（そのまま使えば直接使用、
 * 下書きとして書き直せば間接利用）ため、サマリーは区分を断定せず「候補」として示し、
 * 最終判断は作者に委ねる。虚偽の申告は作者側の責任になるため、ここは断定してはいけない。
 */

import {
    AI_USAGE_PURPOSE_LABELS,
    PURPOSE_DISPLAY_ORDER,
    TalliedPurpose,
    UNCLASSIFIED_PURPOSE,
    isProsePurpose,
} from '../../constants/aiLogTypes';
import { AIUsageTallyEntry } from '../aiUsageTallyService';

export interface DisclosureRow {
    purpose: TalliedPurpose;
    label: string;
    count: number;
    /** 本文生成が対象とした章の数（章の記録がない工程は0） */
    chapterCount: number;
}

export interface DisclosureSummary {
    /** 記録が1件もない */
    isEmpty: boolean;
    /** 記録の開始時刻。これより前のAI利用は記録に含まれない */
    recordedSince: Date | null;
    rows: DisclosureRow[];
    /** 本文の生成・書き換えにAIを使った記録があるか */
    hasProseUsage: boolean;
    /** 工程が記録されていない呼び出しがあるか */
    hasUnclassified: boolean;
    /** そのまま貼り付けられる説明文 */
    text: string;
}

const formatDate = (date: Date): string =>
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

/**
 * 工程別タリーから開示サマリーを組み立てる（純関数）。
 */
export function buildDisclosureSummary(entries: AIUsageTallyEntry[]): DisclosureSummary {
    const byPurpose = new Map<TalliedPurpose, AIUsageTallyEntry>();
    for (const entry of entries) {
        if (entry.count > 0) byPurpose.set(entry.purpose, entry);
    }

    const rows: DisclosureRow[] = PURPOSE_DISPLAY_ORDER
        .filter(purpose => byPurpose.has(purpose))
        .map(purpose => {
            const entry = byPurpose.get(purpose)!;
            return {
                purpose,
                label: AI_USAGE_PURPOSE_LABELS[purpose],
                count: entry.count,
                chapterCount: entry.chapterIds.length,
            };
        });

    const timestamps = entries.filter(e => e.count > 0).map(e => e.firstUsedAt);
    const recordedSince = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
    const hasProseUsage = rows.some(row => isProsePurpose(row.purpose));
    const hasUnclassified = rows.some(row => row.purpose === UNCLASSIFIED_PURPOSE);

    return {
        isEmpty: rows.length === 0,
        recordedSince,
        rows,
        hasProseUsage,
        hasUnclassified,
        text: buildText(rows, recordedSince, hasProseUsage, hasUnclassified),
    };
}

function buildText(
    rows: DisclosureRow[],
    recordedSince: Date | null,
    hasProseUsage: boolean,
    hasUnclassified: boolean
): string {
    if (rows.length === 0) {
        return [
            '【AI利用状況の記録】',
            'この作品でのAI利用は記録されていません。',
            '',
            '※ここに出るのは記録に対応した機能の利用だけです。記録が始まる前の利用、このアプリの外での利用、まだ記録に対応していない機能の利用は含まれません。「AI不使用」として申告してよいかは、ご自身でご確認ください。',
        ].join('\n');
    }

    const lines: string[] = ['【AI利用状況の記録】'];
    if (recordedSince) {
        lines.push(`${formatDate(recordedSince)} 以降に、このアプリで記録された内容です。`);
    }
    lines.push('');

    for (const row of rows) {
        const chapters = row.chapterCount > 0 ? `（${row.chapterCount}章分）` : '';
        lines.push(`・${row.label}: ${row.count}回${chapters}`);
    }

    lines.push('');
    lines.push('■ 小説家になろう の区分（候補）');
    if (hasProseUsage) {
        lines.push('本文の生成・書き換えにAIを使った記録があります。生成された文章をそのまま本文に使っているなら「AI直接使用」、下書きや素材として自分の表現に書き直しているなら「AI間接利用」が候補です。');
    } else {
        lines.push('本文の生成・書き換えにAIを使った記録はありません。アイデア出し・資料調査・誤字脱字チェックのみであれば「AI補助的利用」が候補です。');
    }

    lines.push('');
    lines.push('■ カクヨム のタグ（候補）');
    if (hasProseUsage) {
        lines.push('本文の生成・書き換えにAIを使った記録があります。本文の50%以上がAIによるものなら「AI本文利用」、50%未満なら「AI本文一部利用」が候補です。');
    } else {
        lines.push('本文の生成・書き換えにAIを使った記録はありません。アイデア出しや校正のみであれば「AI補助利用」が候補です。');
    }

    lines.push('');
    lines.push('※このアプリが記録できるのは「AIを呼び出した回数」だけです。生成結果を実際に本文へ採用したかどうかまでは記録できないため、最終的な区分はご自身でご判断ください。');
    if (hasUnclassified) {
        lines.push('※「未分類」は、工程の記録に対応していない機能からの呼び出しです。本文生成が含まれている可能性があるかご確認ください。');
    }

    return lines.join('\n');
}
