/**
 * コンテキスト予算（キャラ整形の一本化・前章あらすじの予算配分・非RAG経路のガード）
 *
 * ここが崩れると、AIに渡る情報が黙って欠ける。しかもエラーにならないため、
 * 生成物の質が落ちたことでしか気づけない。特に「章が抜けない」ことを重点的に固定する。
 */

import { describe, it, expect } from 'vitest';
import { formatCharacter, formatCharacters } from '../../services/context/formatCharacter';
import { formatCharacter as ragFormatCharacter } from '../../services/rag/chunkSources';
import {
    buildPreviousStory,
    PREVIOUS_STORY_BUDGET,
    RECENT_FULL_CHAPTERS,
} from '../../services/context/buildPreviousStory';
import { clampContextSections, OMISSION_NOTE } from '../../services/context/clampContextSections';
import { formatRelationships } from '../../services/context/formatProjectContext';
import { Character } from '../../types/project/character';
import { Chapter } from '../../types/project/chapter';
import { Project } from '../../types/project';

const character = (over: Partial<Character> = {}): Character => ({
    id: 'c1',
    name: '蒼真',
    role: '主人公',
    appearance: '黒髪に痩身',
    personality: '寡黙',
    background: '港町の出身',
    speechStyle: '一人称は僕',
    ...over,
} as Character);

const chapter = (n: number, summary: string): Chapter => ({
    id: `ch${n}`,
    title: `章${n}`,
    summary,
});

describe('formatCharacter', () => {
    it('外見を含める（RAGのON/OFFで人物像が変わらないようにするための本体）', () => {
        expect(formatCharacter(character())).toContain('外見: 黒髪に痩身');
    });

    it('RAG側の export と同じ実装を指している', () => {
        expect(ragFormatCharacter).toBe(formatCharacter);
    });

    it('口調は100文字で切り詰める（1人でプロンプトを食い潰さないため）', () => {
        const result = formatCharacter(character({ speechStyle: 'あ'.repeat(200) }));
        expect(result).toContain(`口調: ${'あ'.repeat(100)}...`);
    });

    it('未設定の項目は行ごと出さない', () => {
        const result = formatCharacter({ id: 'c', name: '名無し' } as Character);
        expect(result).toBe('名無し');
    });

    it('複数人は空行区切りで連結する', () => {
        const result = formatCharacters([character(), character({ id: 'c2', name: '灯' })]);
        expect(result.split('\n\n')).toHaveLength(2);
    });
});

describe('buildPreviousStory', () => {
    it('最初の章では空文字（呼び出し側が「これが最初の章です。」に置き換える）', () => {
        expect(buildPreviousStory([chapter(1, 'あらすじ')], 0)).toBe('');
    });

    it('直近2章はあらすじを全文のまま残す', () => {
        const long = 'い'.repeat(400);
        const result = buildPreviousStory(
            [chapter(1, 'あ'.repeat(400)), chapter(2, long), chapter(3, long)],
            3
        );
        // 直近2章（章2・章3）は全文
        expect(result).toContain(`第2章「章2」\nあらすじ: ${long}`);
        expect(result).toContain(`第3章「章3」\nあらすじ: ${long}`);
    });

    it('それ以前の章は圧縮する', () => {
        const result = buildPreviousStory(
            [chapter(1, 'あ'.repeat(400)), chapter(2, 'い'), chapter(3, 'う')],
            3
        );
        const firstBlock = result.split('\n\n')[0];
        expect(firstBlock.length).toBeLessThan(200);
        expect(firstBlock).toContain('第1章「章1」');
    });

    it('あらすじが空でも章を飛ばさない（AIが「その章は無い」と誤解しないため）', () => {
        const result = buildPreviousStory([chapter(1, ''), chapter(2, 'ある')], 2);
        expect(result).toContain('第1章「章1」');
        expect(result).toContain('（あらすじなし）');
    });

    it('予算を超えたら古い章から順にタイトルだけへ落とす', () => {
        const chapters = Array.from({ length: 40 }, (_, i) => chapter(i + 1, 'あ'.repeat(300)));
        const result = buildPreviousStory(chapters, 40);

        expect(result.length).toBeLessThanOrEqual(PREVIOUS_STORY_BUDGET);
        // 古い章はタイトルのみ（あらすじ行が付かない）
        expect(result).toContain('第1章「章1」\n\n');
        // 直近の章はあらすじが残る
        expect(result).toContain('第40章「章40」\nあらすじ:');
    });

    it('予算超過でも全章の番号とタイトルは残す（抜けを作らない）', () => {
        const chapters = Array.from({ length: 40 }, (_, i) => chapter(i + 1, 'あ'.repeat(300)));
        const result = buildPreviousStory(chapters, 40);
        for (let i = 1; i <= 40; i++) {
            expect(result).toContain(`第${i}章「章${i}」`);
        }
    });

    it('直近1章のあらすじは予算超過でも必ず残す（接続の手がかりが消えるため）', () => {
        const chapters = Array.from({ length: 30 }, (_, i) => chapter(i + 1, 'あ'.repeat(500)));
        const result = buildPreviousStory(chapters, 30, 100);
        expect(result).toContain('第30章「章30」\nあらすじ: ');
    });

    it('章数が直近枠以下ならすべて全文', () => {
        const long = 'あ'.repeat(300);
        const chapters = Array.from({ length: RECENT_FULL_CHAPTERS }, (_, i) => chapter(i + 1, long));
        const result = buildPreviousStory(chapters, RECENT_FULL_CHAPTERS);
        expect(result.split(long).length - 1).toBe(RECENT_FULL_CHAPTERS);
    });
});

describe('clampContextSections', () => {
    const sections = [
        { heading: '【相関図】', body: Array.from({ length: 20 }, (_, i) => `・関係${i}`).join('\n') },
        { heading: '【用語集】', body: Array.from({ length: 20 }, (_, i) => `・用語${i}`).join('\n') },
        { heading: '【世界観】', body: Array.from({ length: 20 }, (_, i) => `・設定${i}`).join('\n') },
    ];

    it('予算に収まるならそのまま全部入れる', () => {
        const result = clampContextSections('キャラ本文', sections, 100000);
        expect(result).toContain('【相関図】');
        expect(result).toContain('【用語集】');
        expect(result).toContain('【世界観】');
        expect(result).not.toContain(OMISSION_NOTE);
    });

    it('予算を超えたら優先順位の低いセクションから落とす', () => {
        const result = clampContextSections('キャラ本文', sections, 300);
        expect(result).toContain('・関係0');
        // 見出しは省略の注記に残るため、中身が入っていないことで判定する
        expect(result).not.toContain('・設定0');
    });

    it('結果は必ず予算内に収まる', () => {
        for (const budget of [200, 500, 1000]) {
            expect(clampContextSections('キャラ本文', sections, budget).length)
                .toBeLessThanOrEqual(budget);
        }
    });

    it('セクションを丸ごと落としたときは、何を落としたか名前で明示する', () => {
        const result = clampContextSections('キャラ本文', sections, 300);
        expect(result).toContain('文字数の都合で次の情報を省略');
        expect(result).toContain('【世界観】');
    });

    it('セクションの途中で切ったときは、その場に注記を入れる', () => {
        const long = { heading: '【用語集】', body: Array.from({ length: 200 }, (_, i) => `・用語${i}`).join('\n') };
        const result = clampContextSections('キャラ本文', [long], 400);
        expect(result).toContain(OMISSION_NOTE);
        expect(result).toContain('【用語集】');
    });

    it('キャラクターは最優先で残す', () => {
        const result = clampContextSections('とても大事なキャラ情報', sections, 200);
        expect(result.startsWith('とても大事なキャラ情報')).toBe(true);
    });

    it('空のセクションは見出しごと出さない', () => {
        const result = clampContextSections('キャラ', [{ heading: '【用語集】', body: '' }], 1000);
        expect(result).toBe('キャラ');
    });
});

describe('formatRelationships', () => {
    const project = {
        characters: [
            { id: 'a', name: '蒼真' },
            { id: 'b', name: '灯' },
        ],
        relationships: [
            { from: 'a', to: 'b', type: '友人', description: '幼馴染', fromCallsTo: 'あかり', toCallsFrom: 'そうま' },
        ],
    } as unknown as Project;

    it('呼び方を含める（先回り生成だけ落ちていた項目）', () => {
        const result = formatRelationships(project);
        expect(result).toContain('呼び方: 蒼真は灯を「あかり」、灯は蒼真を「そうま」と呼ぶ');
    });

    it('呼び方が未設定なら注記を付けない', () => {
        const withoutCalls = {
            ...project,
            relationships: [{ from: 'a', to: 'b', type: '友人', description: '幼馴染' }],
        } as unknown as Project;
        expect(formatRelationships(withoutCalls)).not.toContain('呼び方');
    });

    it('存在しないIDは「不明」にして落とさない', () => {
        const broken = {
            ...project,
            relationships: [{ from: 'x', to: 'b', type: '敵対', description: '' }],
        } as unknown as Project;
        expect(formatRelationships(broken)).toContain('・不明 → 灯: 敵対');
    });
});
