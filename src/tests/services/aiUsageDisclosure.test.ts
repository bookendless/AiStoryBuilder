import { describe, it, expect } from 'vitest';
import { buildDisclosureSummary } from '../../services/disclosure/buildDisclosureSummary';
import { AIUsageTallyEntry } from '../../services/aiUsageTallyService';
import {
    AI_USAGE_PURPOSE_LABELS,
    PURPOSE_DISPLAY_ORDER,
    UNCLASSIFIED_PURPOSE,
    getAILogTypeLabel,
    isProsePurpose,
} from '../../constants/aiLogTypes';

const entry = (over: Partial<AIUsageTallyEntry>): AIUsageTallyEntry => ({
    projectId: 'p1',
    purpose: 'prose',
    count: 1,
    chapterIds: [],
    firstUsedAt: Date.UTC(2026, 7, 12),
    lastUsedAt: Date.UTC(2026, 7, 12),
    ...over,
});

describe('AI利用区分の定義', () => {
    it('表示順のすべての工程にラベルがある（工程を増やしたら定義漏れを検出する）', () => {
        for (const purpose of PURPOSE_DISPLAY_ORDER) {
            expect(AI_USAGE_PURPOSE_LABELS[purpose]).toBeTruthy();
        }
        expect(PURPOSE_DISPLAY_ORDER).toContain(UNCLASSIFIED_PURPOSE);
    });

    it('本文に関与する工程は prose のみ（校正・講評は本文執筆そのものではない）', () => {
        expect(isProsePurpose('prose')).toBe(true);
        expect(isProsePurpose('proofread')).toBe(false);
        expect(isProsePurpose('review')).toBe(false);
        expect(isProsePurpose(UNCLASSIFIED_PURPOSE)).toBe(false);
    });

    it('未知のログ種別はそのまま表示する', () => {
        expect(getAILogTypeLabel('generateFull')).toBe('全章一括生成');
        expect(getAILogTypeLabel('未知の種別')).toBe('未知の種別');
    });
});

describe('buildDisclosureSummary', () => {
    it('記録がなければ空として扱い、断定を避けた説明を返す', () => {
        const summary = buildDisclosureSummary([]);
        expect(summary.isEmpty).toBe(true);
        expect(summary.hasProseUsage).toBe(false);
        expect(summary.recordedSince).toBeNull();
        expect(summary.text).toContain('記録されていません');
        // 「AI不使用」と断定してはいけない（記録開始前・アプリ外・未対応機能の利用は分からない）
        expect(summary.text).toContain('ご自身でご確認ください');
        expect(summary.text).toContain('記録に対応した機能の利用だけ');
    });

    it('count が 0 の記録は行に含めない', () => {
        const summary = buildDisclosureSummary([entry({ purpose: 'prose', count: 0 })]);
        expect(summary.isEmpty).toBe(true);
        expect(summary.rows).toHaveLength(0);
    });

    it('本文生成があれば両サイトの候補区分を示し、採用の確認を促す', () => {
        const summary = buildDisclosureSummary([
            entry({ purpose: 'prose', count: 12, chapterIds: ['c1', 'c2', 'c3', 'c4'] }),
            entry({ purpose: 'proofread', count: 3 }),
        ]);

        expect(summary.hasProseUsage).toBe(true);
        expect(summary.rows[0].purpose).toBe('prose');
        expect(summary.rows[0].count).toBe(12);
        expect(summary.rows[0].chapterCount).toBe(4);
        expect(summary.text).toContain('AI直接使用');
        expect(summary.text).toContain('AI間接利用');
        expect(summary.text).toContain('AI本文利用');
        expect(summary.text).toContain('4章分');
        // 区分は断定せず候補として示す
        expect(summary.text).toContain('候補');
        expect(summary.text).toContain('ご自身でご判断ください');
    });

    it('本文生成がなければ補助的利用を候補として示す', () => {
        const summary = buildDisclosureSummary([
            entry({ purpose: 'proofread', count: 5 }),
            entry({ purpose: 'plan', count: 2 }),
        ]);

        expect(summary.hasProseUsage).toBe(false);
        expect(summary.text).toContain('AI補助的利用');
        expect(summary.text).toContain('AI補助利用');
        expect(summary.text).not.toContain('AI直接使用');
    });

    it('未分類の呼び出しがあれば確認を促す注記を添える', () => {
        const summary = buildDisclosureSummary([
            entry({ purpose: UNCLASSIFIED_PURPOSE, count: 4 }),
        ]);

        expect(summary.hasUnclassified).toBe(true);
        expect(summary.text).toContain('未分類');
        expect(summary.text).toContain('本文生成が含まれている可能性');
    });

    it('記録の開始日は最も古い初回利用日で、日付つきで明示する', () => {
        const summary = buildDisclosureSummary([
            entry({ purpose: 'prose', firstUsedAt: Date.UTC(2026, 7, 20, 12) }),
            entry({ purpose: 'review', firstUsedAt: Date.UTC(2026, 7, 12, 12) }),
        ]);

        expect(summary.recordedSince).toEqual(new Date(Date.UTC(2026, 7, 12, 12)));
        expect(summary.text).toContain('以降に、このアプリで記録された内容です');
    });

    it('行は工程の表示順に並ぶ（記録順ではない）', () => {
        const summary = buildDisclosureSummary([
            entry({ purpose: 'analysis', count: 1 }),
            entry({ purpose: 'prose', count: 1 }),
            entry({ purpose: 'proofread', count: 1 }),
        ]);

        expect(summary.rows.map(r => r.purpose)).toEqual(['prose', 'proofread', 'analysis']);
    });
});
