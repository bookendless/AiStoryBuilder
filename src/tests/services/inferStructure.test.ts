import { describe, it, expect } from 'vitest';
import {
    buildStructureCatalog,
    buildChapterDigest,
    parseStructureInference,
} from '../../services/plotStructure/inferStructure';
import { buildStructureInferencePrompt } from '../../services/prompts/plotStructure';
import { CHARACTER_LIMIT } from '../../components/steps/plot2/constants';
import { Chapter } from '../../types/project/chapter';

const STRUCTURE_KEYS = [
    'kishotenketsu',
    'three-act',
    'four-act',
    'heroes-journey',
    'beat-sheet',
    'mystery-suspense',
];

describe('buildStructureCatalog', () => {
    it('6構成すべてのキーと段階キーを含む', () => {
        const catalog = buildStructureCatalog();
        for (const key of STRUCTURE_KEYS) {
            expect(catalog).toContain(key);
        }
        // 代表的な段階キー
        expect(catalog).toContain('ki:');
        expect(catalog).toContain('act1:');
        expect(catalog).toContain('ms7:');
    });
});

describe('buildStructureInferencePrompt', () => {
    it('あらすじ・章ダイジェスト・カタログを含む', () => {
        const prompt = buildStructureInferencePrompt({
            synopsis: '少年が竜を倒すあらすじ',
            theme: '成長',
            setting: '中世風の王国',
            chaptersDigest: '1. 旅立ち\n2. 竜の山',
            structureCatalog: buildStructureCatalog(),
        });
        expect(prompt).toContain('少年が竜を倒すあらすじ');
        expect(prompt).toContain('旅立ち');
        for (const key of STRUCTURE_KEYS) {
            expect(prompt).toContain(key);
        }
        // 忠実抽出の境界条件
        expect(prompt).toContain('創作');
        expect(prompt).toContain('空文字');
    });
});

describe('buildChapterDigest', () => {
    const chapters: Chapter[] = Array.from({ length: 30 }, (_, i) => ({
        id: `c${i}`,
        title: `第${i + 1}章`,
        summary: 'あ'.repeat(150),
    }));

    it('タイトルと概要を含む一覧を作る', () => {
        const digest = buildChapterDigest(chapters.slice(0, 2), 10000);
        expect(digest).toContain('1. 第1章：');
        expect(digest).toContain('2. 第2章：');
    });

    it('予算を超えない（超過分は省略注記）', () => {
        const digest = buildChapterDigest(chapters, 500);
        expect(digest.length).toBeLessThanOrEqual(500 + 30); // 省略注記分の余裕
        expect(digest).toContain('省略');
    });
});

describe('parseStructureInference', () => {
    it('正常なJSONを受理する（コードフェンス付きでも）', () => {
        const raw =
            '```json\n' +
            JSON.stringify({
                structure: 'three-act',
                reason: '三幕の転換が明確',
                fields: { act1: '導入の内容', act2: '展開の内容', act3: '' },
            }) +
            '\n```';
        const result = parseStructureInference(raw);
        expect(result).not.toBeNull();
        expect(result!.structure).toBe('three-act');
        expect(result!.reason).toBe('三幕の転換が明確');
        expect(result!.fields.act1).toBe('導入の内容');
        expect(result!.fields.act3).toBe('');
    });

    it('未知の構成キーは null を返す', () => {
        expect(
            parseStructureInference(JSON.stringify({ structure: 'five-act', fields: {} }))
        ).toBeNull();
        expect(parseStructureInference('ただのテキスト')).toBeNull();
    });

    it('選定構成に属さないフィールドキーは破棄する', () => {
        const result = parseStructureInference(
            JSON.stringify({
                structure: 'kishotenketsu',
                fields: { ki: '導入', act1: '混入キー', unknown: 'x' },
            })
        );
        expect(result!.fields).toEqual({ ki: '導入' });
    });

    it('上限を超える値は防御的に切り詰める', () => {
        const result = parseStructureInference(
            JSON.stringify({
                structure: 'kishotenketsu',
                fields: { ki: 'あ'.repeat(CHARACTER_LIMIT + 200) },
            })
        );
        expect(result!.fields.ki.length).toBe(CHARACTER_LIMIT);
    });
});
