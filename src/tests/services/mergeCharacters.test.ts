import { describe, it, expect } from 'vitest';
import {
    mergeCharacters,
    normalizeName,
    formatKnownCharacters,
    applyConsolidationGroups,
    RawCharacter,
} from '../../services/import/extractCharacters';
import { Character } from '../../types/project';

describe('normalizeName', () => {
    it('空白・括弧・大小を吸収する', () => {
        expect(normalizeName('太 郎')).toBe('太郎');
        expect(normalizeName('「太郎」')).toBe('太郎');
        expect(normalizeName('太郎　')).toBe('太郎');
        expect(normalizeName('Alice')).toBe('alice');
    });
});

describe('mergeCharacters', () => {
    it('空入力は空配列を返す', () => {
        expect(mergeCharacters([])).toEqual([]);
        expect(mergeCharacters([[]])).toEqual([]);
    });

    it('1チャンクの人物を Character に変換する', () => {
        const chunk: RawCharacter[] = [
            { name: '太郎', role: '主人公', personality: 'まっすぐ', background: '田舎育ち', speechStyle: '丁寧' },
        ];
        const result = mergeCharacters([chunk]);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            name: '太郎',
            role: '主人公',
            personality: 'まっすぐ',
            background: '田舎育ち',
            speechStyle: '丁寧',
        });
        expect(result[0].id).toBeTruthy();
    });

    it('同名（表記ゆれ含む）はチャンクを跨いで名寄せ統合する', () => {
        const chunk1: RawCharacter[] = [{ name: '太郎', personality: 'やさしい' }];
        const chunk2: RawCharacter[] = [{ name: '「太郎」', personality: '勇敢', background: '騎士' }];
        const result = mergeCharacters([chunk1, chunk2]);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('太郎');
        // 異なる記述は結合される
        expect(result[0].personality).toBe('やさしい\n勇敢');
        // 片方にしかない項目は補完される
        expect(result[0].background).toBe('騎士');
    });

    it('同一の記述は重複させない', () => {
        const chunk1: RawCharacter[] = [{ name: '花子', personality: '冷静' }];
        const chunk2: RawCharacter[] = [{ name: '花子', personality: '冷静' }];
        const result = mergeCharacters([chunk1, chunk2]);
        expect(result).toHaveLength(1);
        expect(result[0].personality).toBe('冷静');
    });

    it('名前のない候補はスキップする', () => {
        const chunk: RawCharacter[] = [
            { name: '', personality: '謎' },
            { personality: '名無し' },
            { name: '次郎', role: '脇役' },
        ];
        const result = mergeCharacters([chunk]);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('次郎');
    });

    it('最初に現れた非空の役割を保持する', () => {
        const chunk1: RawCharacter[] = [{ name: '三郎', role: '' }];
        const chunk2: RawCharacter[] = [{ name: '三郎', role: '協力者' }];
        const result = mergeCharacters([chunk1, chunk2]);
        expect(result[0].role).toBe('協力者');
    });

    it('複数の異なる人物はすべて保持する', () => {
        const chunk: RawCharacter[] = [
            { name: 'A' }, { name: 'B' }, { name: 'C' },
        ];
        const result = mergeCharacters([chunk]);
        expect(result.map(c => c.name).sort()).toEqual(['A', 'B', 'C']);
    });

    it('別名（aliases）経由で同一人物を名寄せする', () => {
        const chunk1: RawCharacter[] = [{ name: '山田太郎', aliases: ['太郎'], personality: '実直' }];
        const chunk2: RawCharacter[] = [{ name: '太郎', personality: '頑固' }];
        const result = mergeCharacters([chunk1, chunk2]);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('山田太郎');
        expect(result[0].personality).toBe('実直\n頑固');
    });

    it('後からフルネームが判明したら代表名を昇格する（太郎 → 山田太郎）', () => {
        const chunk1: RawCharacter[] = [{ name: '太郎', role: '主人公' }];
        const chunk2: RawCharacter[] = [{ name: '山田太郎', aliases: ['太郎'], background: '商家の長男' }];
        const result = mergeCharacters([chunk1, chunk2]);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('山田太郎');
        expect(result[0].role).toBe('主人公');
        expect(result[0].background).toBe('商家の長男');
    });

    it('別名が橋渡しになり、分かれていたエントリを1人に統合する', () => {
        const chunk1: RawCharacter[] = [{ name: '山田太郎', personality: '実直' }];
        const chunk2: RawCharacter[] = [{ name: 'タロちゃん', personality: '陽気' }];
        const chunk3: RawCharacter[] = [{ name: '太郎', aliases: ['山田太郎', 'タロちゃん'], background: '騎士' }];
        const result = mergeCharacters([chunk1, chunk2, chunk3]);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('山田太郎');
        expect(result[0].personality).toBe('実直\n陽気');
        expect(result[0].background).toBe('騎士');
    });

    it('別名同士の一致だけでは統合しない（汎用呼称「先生」の共有）', () => {
        const chunk: RawCharacter[] = [
            { name: '山田', aliases: ['先生'] },
            { name: '佐藤', aliases: ['先生'] },
        ];
        const result = mergeCharacters([chunk]);
        expect(result.map(c => c.name).sort()).toEqual(['佐藤', '山田']);
    });

    it('包含関係だけでは統合しない（山田 と 山田太郎 は別人のまま）', () => {
        const chunk: RawCharacter[] = [
            { name: '山田' },
            { name: '山田太郎' },
        ];
        const result = mergeCharacters([chunk]);
        expect(result.map(c => c.name).sort()).toEqual(['山田', '山田太郎']);
    });

    it('空・1文字・代表名と同じ別名は無視する', () => {
        const chunk: RawCharacter[] = [
            { name: '太郎', aliases: ['', ' ', '太郎', '彼'] },
            { name: '次郎' },
        ];
        const result = mergeCharacters([chunk]);
        expect(result.map(c => c.name).sort()).toEqual(['太郎', '次郎']);
    });
});

describe('formatKnownCharacters', () => {
    it('名前と別名を1行に整形する', () => {
        const text = formatKnownCharacters([
            { name: '山田太郎', aliases: ['太郎', 'タロちゃん'] },
            { name: '佐藤花子', aliases: [] },
        ]);
        expect(text).toBe('山田太郎（別名: 太郎、タロちゃん）、佐藤花子');
    });

    it('別名は上限数まで、全体は上限文字数まで（末尾の人物ごと落とす）', () => {
        const text = formatKnownCharacters(
            [
                { name: 'A', aliases: ['a1', 'a2', 'a3', 'a4'] },
                { name: 'BBBBBBBBBB', aliases: [] },
            ],
            20,
            3
        );
        // A のエントリ「A（別名: a1、a2、a3）」(15文字) のみが収まり、後続は丸ごと落ちる
        expect(text).toBe('A（別名: a1、a2、a3）');
    });

    it('空入力は空文字を返す', () => {
        expect(formatKnownCharacters([])).toBe('');
    });
});

describe('applyConsolidationGroups', () => {
    const make = (name: string, fields: Partial<Character> = {}): Character => ({
        id: `id-${name}`,
        name,
        role: '',
        appearance: '',
        personality: '',
        background: '',
        ...fields,
    });

    it('グループの先頭（最も若い番号）が id と name を保持して統合する', () => {
        const chars = [
            make('山田太郎', { personality: '実直' }),
            make('花子'),
            make('少年', { personality: '無口', role: '主人公' }),
        ];
        const result = applyConsolidationGroups(chars, [[1, 3]]);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('id-山田太郎');
        expect(result[0].name).toBe('山田太郎');
        expect(result[0].personality).toBe('実直\n無口');
        expect(result[0].role).toBe('主人公');
        expect(result[1].name).toBe('花子');
    });

    it('番号を共有するグループ同士は1つにまとめる', () => {
        const chars = [make('A'), make('B'), make('C')];
        const result = applyConsolidationGroups(chars, [[1, 2], [2, 3]]);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('A');
    });

    it('範囲外・非整数の番号は無視し、1人だけのグループは何もしない', () => {
        const chars = [make('A'), make('B')];
        expect(applyConsolidationGroups(chars, [[0, 5], [1.5, 2], [1]])).toHaveLength(2);
    });

    it('空のグループ配列は恒等変換', () => {
        const chars = [make('A'), make('B')];
        const result = applyConsolidationGroups(chars, []);
        expect(result.map(c => c.name)).toEqual(['A', 'B']);
    });
});
