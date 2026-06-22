import { describe, it, expect } from 'vitest';
import { splitCreativePoints, normalizeCreativePointsList } from '../../services/creativePoints/parseCreativePoints';
import { CREATIVE_POINTS_MARKER } from '../../services/prompts/creativePoints';

/**
 * splitCreativePoints の本文分離・正規化を検証する。
 */

describe('splitCreativePoints', () => {
    it('マーカーが無ければ全文を本文として返し、creativePoints は空', () => {
        const res = splitCreativePoints('  あらすじ本文だけ  ');
        expect(res.content).toBe('あらすじ本文だけ');
        expect(res.creativePoints).toEqual([]);
    });

    it('マーカー前を本文として切り出し、JSONを creativePoints に解析する', () => {
        const raw = [
            'これはあらすじ本文です。',
            CREATIVE_POINTS_MARKER,
            JSON.stringify({
                creativePoints: [
                    {
                        label: '主人公の動機',
                        current: '復讐を選ぶ',
                        alternatives: [
                            { summary: '赦しを選ぶ', consequence: '物語は和解へ向かう' },
                            { summary: '逃避を選ぶ', consequence: '主人公は街を去る' },
                        ],
                    },
                ],
            }),
        ].join('\n');

        const res = splitCreativePoints(raw);
        expect(res.content).toBe('これはあらすじ本文です。');
        expect(res.creativePoints).toHaveLength(1);
        expect(res.creativePoints[0].label).toBe('主人公の動機');
        expect(res.creativePoints[0].current).toBe('復讐を選ぶ');
        expect(res.creativePoints[0].alternatives).toHaveLength(2);
        expect(res.creativePoints[0].alternatives[0].summary).toBe('赦しを選ぶ');
        expect(res.creativePoints[0].id.length).toBeGreaterThan(0);
        expect(res.creativePoints[0].alternatives[0].id.length).toBeGreaterThan(0);
    });

    it('最大4ポイント・各最大3別案にクランプする', () => {
        const points = Array.from({ length: 6 }, (_, i) => ({
            label: `ポイント${i}`,
            current: '現在',
            alternatives: Array.from({ length: 5 }, (_, j) => ({
                summary: `別案${j}`,
                consequence: `帰結${j}`,
            })),
        }));
        const raw = `本文\n${CREATIVE_POINTS_MARKER}\n${JSON.stringify({ creativePoints: points })}`;
        const res = splitCreativePoints(raw);
        expect(res.creativePoints).toHaveLength(4);
        expect(res.creativePoints[0].alternatives).toHaveLength(3);
    });

    it('ラベルなし・別案なしのポイントは除外する', () => {
        const raw = `本文\n${CREATIVE_POINTS_MARKER}\n${JSON.stringify({
            creativePoints: [
                { label: '', current: 'x', alternatives: [{ summary: 'a', consequence: 'b' }] },
                { label: '有効', current: 'y', alternatives: [] },
                { label: '別案なし', current: 'z' },
                { label: '正常', current: 'w', alternatives: [{ summary: 'a', consequence: 'b' }] },
            ],
        })}`;
        const res = splitCreativePoints(raw);
        expect(res.creativePoints.map((p) => p.label)).toEqual(['正常']);
    });

    it('JSONが壊れていても本文は返し、creativePoints は空', () => {
        const raw = `本文だけ有効\n${CREATIVE_POINTS_MARKER}\nこれはJSONではありません`;
        const res = splitCreativePoints(raw);
        expect(res.content).toBe('本文だけ有効');
        expect(res.creativePoints).toEqual([]);
    });

    it('マーカーが無くても末尾の creativePoints JSON を本文から切り離す（フォールバック）', () => {
        const json = JSON.stringify({
            creativePoints: [
                { label: '結末', current: '勝利', alternatives: [{ summary: '敗北', consequence: '苦い余韻' }] },
            ],
        });
        // マーカー無し・コードフェンス付きで末尾にJSONが混入
        const raw = `あらすじ本文です。\n\n\`\`\`json\n${json}\n\`\`\``;
        const res = splitCreativePoints(raw);
        expect(res.content).toBe('あらすじ本文です。');
        expect(res.creativePoints).toHaveLength(1);
        expect(res.creativePoints[0].label).toBe('結末');
    });

    it('creativePoints を含まない通常の本文はそのまま返す', () => {
        const raw = 'これは普通のあらすじで、JSONは含まれていません。';
        const res = splitCreativePoints(raw);
        expect(res.content).toBe(raw);
        expect(res.creativePoints).toEqual([]);
    });
});

/**
 * normalizeCreativePointsList: 解析済み配列からの正規化（plot2 のJSONキー方式が使う経路）。
 */
describe('normalizeCreativePointsList', () => {
    it('配列以外は空配列を返す', () => {
        expect(normalizeCreativePointsList(undefined)).toEqual([]);
        expect(normalizeCreativePointsList(null)).toEqual([]);
        expect(normalizeCreativePointsList('x')).toEqual([]);
    });

    it('正規化・クランプ（2〜4ポイント, 各1〜3別案, id付与, 空除外）', () => {
        const list = [
            { label: 'リリィの結末', current: '精霊と一体化', alternatives: [
                { summary: '生き残る', consequence: '自己犠牲が弱まる' },
                { summary: '', consequence: '空summaryは除外' },
            ] },
            { label: '別案なしは除外', current: 'x', alternatives: [] },
            { current: 'ラベル無しは除外', alternatives: [{ summary: 'a', consequence: 'b' }] },
        ];
        const res = normalizeCreativePointsList(list);
        expect(res).toHaveLength(1);
        expect(res[0].label).toBe('リリィの結末');
        expect(res[0].alternatives).toHaveLength(1);
        expect(res[0].id).toBeTruthy();
        expect(res[0].alternatives[0].id).toBeTruthy();
    });
});

/**
 * plot2 抽出経路の再現テスト（model-behavior修正の決定的な検証）。
 * ToT散文の前置き + creativePoints キーを含む単一JSON から、
 * 構成フィールドと創造ポイントの両方が取り出せることを保証する。
 */
describe('plot2 構成JSON + creativePoints キーの抽出', () => {
    // パネル(handleStructureAIGenerate)と同じ抽出ロジックを再現
    const extract = (raw: string) => {
        let normalized = raw.trim();
        if (normalized.startsWith('{{') && normalized.endsWith('}}')) {
            normalized = normalized.slice(1, -1);
        }
        const m = normalized.match(/\{[\s\S]*\}/);
        if (!m) return null;
        let jsonString = m[0];
        if (jsonString.startsWith('{{')) jsonString = jsonString.slice(1);
        if (jsonString.endsWith('}}')) jsonString = jsonString.slice(0, -1);
        const parsed = JSON.parse(jsonString) as Record<string, unknown>;
        return {
            ki: typeof parsed['起（導入）'] === 'string' ? (parsed['起（導入）'] as string) : '',
            creativePoints: normalizeCreativePointsList(parsed.creativePoints),
        };
    };

    it('前置き散文があっても構成フィールドと creativePoints を両取得する', () => {
        const raw = `### 思考のプロセス（ToT）\n案A/案B/案C を評価... 推奨は案C。\n\n${JSON.stringify({
            '起（導入）': '水晶の森の神殿でリリィは歌う。',
            '承（展開）': '旅で外の世界を知る。',
            '転（転換）': '世界の呪いが臨界に達する。',
            '結（結末）': 'リリィの歌が世界を包む。',
            creativePoints: [
                { label: 'リリィの結末の解釈', current: '精霊と一体化', alternatives: [
                    { summary: '生き残る', consequence: '自己犠牲が弱まる' },
                ] },
                { label: 'カイとの関係性', current: '精神的な絆', alternatives: [
                    { summary: '恋愛に発展', consequence: '焦点が個人の幸福に寄る' },
                ] },
            ],
        })}`;
        const res = extract(raw);
        expect(res).not.toBeNull();
        expect(res!.ki).toContain('水晶の森');
        expect(res!.creativePoints).toHaveLength(2);
        expect(res!.creativePoints[0].label).toBe('リリィの結末の解釈');
    });

    it('creativePoints キーが無くても構成は取得でき、ポイントは空', () => {
        const raw = JSON.stringify({ '起（導入）': '本文', '結（結末）': '結末' });
        const res = extract(raw);
        expect(res!.ki).toBe('本文');
        expect(res!.creativePoints).toEqual([]);
    });
});
