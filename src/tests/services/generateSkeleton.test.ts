import { describe, it, expect } from 'vitest';
import { generateSkeleton } from '../../services/skeleton/generateSkeleton';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';
import { SkeletonSeed } from '../../types/skeleton';

/**
 * generateSkeleton のオーケストレーション（plot → characters → structure）を、
 * 実APIを使わず注入したフェイク AIRunner で検証する。
 * - 日本語キーJSON → SkeletonPlot へのマップ
 * - キャラJSON配列 → Character[]（最大3人にクランプ・id付与・名前なし除外）
 * - 構成推定の流用と parseStructureInference 連携
 * - signal.aborted での中断（AbortError）
 * - 部分欠落（パース失敗）が致命にならずフォールバックする
 */

const settings: AISettings = {
    provider: 'local',
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 2000,
};

const seed: SkeletonSeed = {
    title: 'テスト作品',
    description: '記憶を失った少女が街を探索する物語',
    mainGenre: 'ファンタジー',
    targetReader: '全年齢',
};

const PLOT_JSON = JSON.stringify({
    メインテーマ: '記憶と自己',
    舞台設定: '霧に包まれた港町',
    フック要素: '少女は自分の名前すら思い出せない',
    主人公の目標: '失われた記憶を取り戻す',
    主要な障害: '街の住人が真実を隠している',
    物語の結末: '少女は記憶と引き換えに新しい居場所を得る',
});

const CHARACTERS_JSON = JSON.stringify([
    { name: 'ミナ', role: '16歳・主人公', appearance: '銀髪', personality: '芯が強い', background: '記憶喪失' },
    { name: '老人ハル', role: '案内人', appearance: '白髭', personality: '穏やか', background: '港町の長老' },
    { name: '', role: '無名', appearance: '', personality: '', background: '' },
    { name: 'カイ', role: '少年', appearance: '', personality: '', background: '' },
    { name: 'ソラ', role: '4人目（クランプで除外）', appearance: '', personality: '', background: '' },
]);

const STRUCTURE_JSON = JSON.stringify({
    structure: 'kishotenketsu',
    reason: '導入から結末まで明快なため',
    fields: { ki: '港町に少女が現れる', sho: '探索が進む', ten: '真実が明かされる', ketsu: '新たな居場所', unknownKey: '無視される' },
});

function makeRunner(overrides: { plot?: string; characters?: string; structureThrows?: boolean } = {}) {
    const calls = { plot: 0, characters: 0, structure: 0 };
    const run: AIRunner = async (prompt) => {
        if (prompt.includes('物語プロット生成の専門AI')) {
            calls.plot++;
            return overrides.plot ?? PLOT_JSON;
        }
        if (prompt.includes('キャラクター設定の専門AI')) {
            calls.characters++;
            return overrides.characters ?? CHARACTERS_JSON;
        }
        if (prompt.includes('構成を分析する編集者')) {
            calls.structure++;
            if (overrides.structureThrows) throw new Error('structure failed');
            return STRUCTURE_JSON;
        }
        throw new Error(`未知のプロンプト: ${prompt.slice(0, 30)}`);
    };
    return { run, calls };
}

describe('generateSkeleton', () => {
    it('3段（plot/characters/structure）を順に1回ずつ呼ぶ', async () => {
        const { run, calls } = makeRunner();
        await generateSkeleton(seed, { settings, run });
        expect(calls).toEqual({ plot: 1, characters: 1, structure: 1 });
    });

    it('日本語キーJSONを plot にマップする', async () => {
        const { run } = makeRunner();
        const result = await generateSkeleton(seed, { settings, run });
        expect(result.plot.theme).toBe('記憶と自己');
        expect(result.plot.setting).toBe('霧に包まれた港町');
        expect(result.plot.protagonistGoal).toBe('失われた記憶を取り戻す');
        expect(result.plot.ending).toBe('少女は記憶と引き換えに新しい居場所を得る');
    });

    it('キャラJSONを最大3人にクランプし、名前なしを除外し、idを付与する', async () => {
        const { run } = makeRunner();
        const result = await generateSkeleton(seed, { settings, run });
        expect(result.characters).toHaveLength(3);
        expect(result.characters.map((c) => c.name)).toEqual(['ミナ', '老人ハル', 'カイ']);
        expect(result.characters.every((c) => c.id.length > 0)).toBe(true);
    });

    it('構成推定を流用し、許可キーのみ採用する（未知キーは破棄）', async () => {
        const { run } = makeRunner();
        const result = await generateSkeleton(seed, { settings, run });
        expect(result.structure?.structure).toBe('kishotenketsu');
        expect(result.structure?.fields.ki).toBe('港町に少女が現れる');
        expect(result.structure?.fields.unknownKey).toBeUndefined();
    });

    it('plot のJSONが壊れていても空文字にフォールバックして続行する', async () => {
        const { run } = makeRunner({ plot: 'これはJSONではありません' });
        const result = await generateSkeleton(seed, { settings, run });
        expect(result.plot.theme).toBe('');
        // 後続のキャラ・構成は通常どおり取得できる
        expect(result.characters.length).toBeGreaterThan(0);
        expect(result.structure?.structure).toBe('kishotenketsu');
    });

    it('構成推定が失敗しても plot / characters は返す（structure は undefined）', async () => {
        const { run } = makeRunner({ structureThrows: true });
        const result = await generateSkeleton(seed, { settings, run });
        expect(result.structure).toBeUndefined();
        expect(result.plot.theme).toBe('記憶と自己');
        expect(result.characters).toHaveLength(3);
    });

    it('signal が中断済みなら AbortError を投げる', async () => {
        const { run } = makeRunner();
        const controller = new AbortController();
        controller.abort();
        await expect(
            generateSkeleton(seed, { settings, run, signal: controller.signal })
        ).rejects.toMatchObject({ name: 'AbortError' });
    });
});
