import { describe, it, expect } from 'vitest';
import { validateIssues } from '../../services/consistency/validateIssues';
import { buildFactSheet, FACT_SHEET_MAX_CHARS } from '../../services/consistency/buildFactSheet';
import { Project } from '../../types/project';

const CHAPTER_TEXT = '彼の青い瞳が揺れた。「俺は行くよ」と健太は言った。翌朝、僕は駅に向かった。';

const makeIssue = (overrides: Record<string, unknown> = {}) => ({
    quote: '彼の青い瞳が揺れた。',
    category: 'appearance',
    severity: 'high',
    description: '設定では黒い瞳とされている',
    evidence: 'キャラクター設定: 健太は黒い瞳',
    suggestion: '彼の黒い瞳が揺れた。',
    ...overrides,
});

describe('validateIssues', () => {
    it('本文に実在する引用の指摘を通す', () => {
        const result = validateIssues({ issues: [makeIssue()] }, CHAPTER_TEXT);
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('appearance');
        expect(result[0].severity).toBe('high');
        expect(result[0].suggestion).toBe('彼の黒い瞳が揺れた。');
    });

    it('本文に存在しない引用（幻覚指摘）を破棄する', () => {
        const result = validateIssues(
            { issues: [makeIssue({ quote: '彼女の赤い髪がなびいた。' })] },
            CHAPTER_TEXT
        );
        expect(result).toHaveLength(0);
    });

    it('不正なカテゴリの指摘を破棄する', () => {
        const result = validateIssues(
            { issues: [makeIssue({ category: 'style' })] },
            CHAPTER_TEXT
        );
        expect(result).toHaveLength(0);
    });

    it('不正な深刻度は medium にフォールバックする', () => {
        const result = validateIssues(
            { issues: [makeIssue({ severity: 'critical' })] },
            CHAPTER_TEXT
        );
        expect(result).toHaveLength(1);
        expect(result[0].severity).toBe('medium');
    });

    it('quote または description が空の指摘を破棄する', () => {
        const result = validateIssues(
            { issues: [makeIssue({ quote: '' }), makeIssue({ description: '' })] },
            CHAPTER_TEXT
        );
        expect(result).toHaveLength(0);
    });

    it('同一の quote+description を重複排除する', () => {
        const result = validateIssues(
            { issues: [makeIssue(), makeIssue()] },
            CHAPTER_TEXT
        );
        expect(result).toHaveLength(1);
    });

    it('issues が配列でない・データ不正の場合は空配列を返す', () => {
        expect(validateIssues(null, CHAPTER_TEXT)).toEqual([]);
        expect(validateIssues({ issues: 'なし' }, CHAPTER_TEXT)).toEqual([]);
        expect(validateIssues({ issues: [null, 'x', 42] }, CHAPTER_TEXT)).toEqual([]);
    });

    it('suggestion が空文字の場合は undefined になる', () => {
        const result = validateIssues(
            { issues: [makeIssue({ suggestion: '  ' })] },
            CHAPTER_TEXT
        );
        expect(result).toHaveLength(1);
        expect(result[0].suggestion).toBeUndefined();
    });
});

const makeProject = (overrides: Partial<Project> = {}): Project => ({
    id: 'p1',
    title: 'テスト作品',
    description: '',
    theme: '',
    imageBoard: [],
    progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
    characters: [],
    plot: { theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' },
    synopsis: '',
    chapters: [],
    draft: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe('buildFactSheet', () => {
    it('キャラクター・用語集・世界観・時系列をセクション化する', () => {
        const project = makeProject({
            characters: [
                {
                    id: 'c1',
                    name: '健太',
                    role: '主人公',
                    appearance: '黒い瞳と短い黒髪',
                    personality: '直情的',
                    background: '',
                    speechStyle: '一人称は「俺」',
                },
            ],
            glossary: [
                {
                    id: 'g1',
                    term: '星霜石',
                    reading: 'せいそうせき',
                    definition: '時を封じる鉱石',
                    category: 'item',
                    createdAt: new Date(),
                },
            ],
            worldSettings: [
                {
                    id: 'w1',
                    category: 'geography',
                    title: '王都アルカ',
                    content: '大陸中央の城塞都市',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
            timeline: [
                { id: 't2', title: '決戦', description: '王都陥落', order: 2, category: 'plot' },
                { id: 't1', title: '出会い', description: '健太が星霜石を拾う', order: 1, category: 'plot' },
            ],
        });

        const sheet = buildFactSheet(project);
        expect(sheet).toContain('■キャラクター設定');
        expect(sheet).toContain('健太');
        expect(sheet).toContain('黒い瞳');
        expect(sheet).toContain('一人称は「俺」');
        expect(sheet).toContain('■用語集');
        expect(sheet).toContain('星霜石（せいそうせき）');
        expect(sheet).toContain('■世界観設定');
        expect(sheet).toContain('王都アルカ');
        expect(sheet).toContain('■時系列');
        // orderの昇順に並ぶ
        expect(sheet.indexOf('出会い')).toBeLessThan(sheet.indexOf('決戦'));
    });

    it('台帳が空の場合はその旨のプレースホルダを返す', () => {
        const sheet = buildFactSheet(makeProject());
        expect(sheet).toContain('未登録');
    });

    it('上限文字数を超えない', () => {
        const manyCharacters = Array.from({ length: 100 }, (_, i) => ({
            id: `c${i}`,
            name: `キャラクター${i}`,
            role: '脇役',
            appearance: 'あ'.repeat(200),
            personality: 'い'.repeat(200),
            background: '',
        }));
        const sheet = buildFactSheet(makeProject({ characters: manyCharacters }));
        // packSections はセクション切り詰め後に省略記号を足すため、わずかな超過を許容
        expect(sheet.length).toBeLessThanOrEqual(FACT_SHEET_MAX_CHARS + 10);
    });
});
