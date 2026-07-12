import { describe, it, expect } from 'vitest';
import { parseWhatIfReport } from '../../services/whatIf/parseWhatIfReport';
import { Chapter } from '../../types/project';

const CHAPTERS: Chapter[] = [
    { id: 'ch1', title: '第一章 出会い', summary: '' },
    { id: 'ch2', title: '第二章 決別', summary: '' },
];

const validData = {
    immediate: '主人公は列車に乗らず、街に残る。',
    chapterImpacts: [
        { chapterTitle: '第一章 出会い', impact: 'ヒロインとの出会いが消滅する。', severity: 'major' },
        { chapterTitle: '決別', impact: '対立の理由が変わる。', severity: 'moderate' },
        { chapterTitle: '存在しない章', impact: '影響あり。', severity: 'minor' },
    ],
    brokenForeshadowings: ['切符の伏線'],
    relationshipChanges: ['主人公とヒロインは他人のまま'],
    newPossibilities: ['街に残った主人公が事件に巻き込まれる展開'],
    verdict: '本編より閉塞感が強くなるが、ミステリー要素を足すなら有望。',
};

describe('parseWhatIfReport', () => {
    it('正常なレポートをパースし、章タイトルからchapterIdを照合する', () => {
        const report = parseWhatIfReport(validData, CHAPTERS);
        expect(report).not.toBeNull();
        expect(report!.immediate).toContain('街に残る');
        expect(report!.chapterImpacts).toHaveLength(3);
        // 完全一致
        expect(report!.chapterImpacts[0].chapterId).toBe('ch1');
        // 部分一致（「決別」⊂「第二章 決別」）
        expect(report!.chapterImpacts[1].chapterId).toBe('ch2');
        expect(report!.chapterImpacts[1].title).toBe('第二章 決別');
        // 照合不能はIDなしで保持
        expect(report!.chapterImpacts[2].chapterId).toBe('');
        expect(report!.brokenForeshadowings).toEqual(['切符の伏線']);
        expect(report!.verdict).toContain('有望');
    });

    it('immediate または verdict が欠けている場合は null を返す', () => {
        expect(parseWhatIfReport({ ...validData, immediate: '' }, CHAPTERS)).toBeNull();
        expect(parseWhatIfReport({ ...validData, verdict: undefined }, CHAPTERS)).toBeNull();
        expect(parseWhatIfReport(null, CHAPTERS)).toBeNull();
        expect(parseWhatIfReport('text', CHAPTERS)).toBeNull();
    });

    it('不正な severity は moderate にフォールバックする', () => {
        const report = parseWhatIfReport(
            {
                ...validData,
                chapterImpacts: [{ chapterTitle: '第一章 出会い', impact: 'x', severity: 'huge' }],
            },
            CHAPTERS
        );
        expect(report!.chapterImpacts[0].severity).toBe('moderate');
    });

    it('impact が空・chapterTitle が空の項目は除外する', () => {
        const report = parseWhatIfReport(
            {
                ...validData,
                chapterImpacts: [
                    { chapterTitle: '', impact: 'x', severity: 'minor' },
                    { chapterTitle: '第一章 出会い', impact: '', severity: 'minor' },
                    'broken',
                    null,
                ],
            },
            CHAPTERS
        );
        expect(report!.chapterImpacts).toHaveLength(0);
    });

    it('配列でないフィールドは空配列に正規化する', () => {
        const report = parseWhatIfReport(
            {
                ...validData,
                brokenForeshadowings: 'なし',
                relationshipChanges: null,
                newPossibilities: [42, '有効な案', ''],
                chapterImpacts: undefined,
            },
            CHAPTERS
        );
        expect(report!.brokenForeshadowings).toEqual([]);
        expect(report!.relationshipChanges).toEqual([]);
        expect(report!.newPossibilities).toEqual(['有効な案']);
        expect(report!.chapterImpacts).toEqual([]);
    });
});
