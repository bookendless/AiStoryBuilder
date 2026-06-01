/**
 * 続編構成のAIパイプライン（抽出・生成フェーズ）
 *
 * - extractElements: 全体要約 + 構造化データから続編向け分析を抽出
 * - generateSequelElements: 分析結果から続編のあらすじ・プロット・更新キャラを生成
 */

import { Project } from '../../types/project';
import {
    SequelExtraction,
    SequelElements,
    AIRunner,
} from '../../types/sequel';
import { parseJsonLoose } from './parseJson';
import {
    buildExtractPrompt,
    buildGenerateSynopsisPlotPrompt,
    buildUpdateCharactersPrompt,
} from '../prompts/sequel';

// ---- シリアライズヘルパー ----

function formatCharacters(project: Project): string {
    if (!project.characters || project.characters.length === 0) return '（登場キャラクター情報なし）';
    return project.characters
        .map(c => `- [${c.id}] ${c.name}（${c.role}）: 性格=${c.personality || '不明'} / 背景=${c.background || '不明'}`)
        .join('\n');
}

function formatWorldSettings(project: Project): string {
    const ws = project.worldSettings;
    if (!ws || ws.length === 0) return '（世界観設定なし）';
    return ws.map(w => `- [${w.category}] ${w.title}: ${w.content}`).join('\n');
}

function formatRelationships(project: Project): string {
    const rels = project.relationships;
    if (!rels || rels.length === 0) return '（相関情報なし）';
    const nameOf = (id: string) => project.characters?.find(c => c.id === id)?.name || id;
    return rels
        .map(r => `- ${nameOf(r.from)} → ${nameOf(r.to)}（${r.type}, 強度${r.strength}）${r.description ? ': ' + r.description : ''}`)
        .join('\n');
}

// ---- 抽出フェーズ ----

interface ExtractOptions {
    run: AIRunner;
    signal?: AbortSignal;
}

/**
 * 全体要約と元プロジェクトの構造化データから、続編向けの分析を抽出する。
 */
export async function extractElements(
    project: Project,
    storyDigest: string,
    options: ExtractOptions
): Promise<SequelExtraction> {
    const { run, signal } = options;

    const prompt = buildExtractPrompt(
        storyDigest,
        formatCharacters(project),
        formatWorldSettings(project),
        formatRelationships(project)
    );

    const raw = await run(prompt, { signal, temperature: 0.5 });
    const parsed = parseJsonLoose<Partial<SequelExtraction>>(raw);

    return {
        storyDigest,
        characterGrowth: parsed?.characterGrowth?.trim() || '',
        relationshipChanges: parsed?.relationshipChanges?.trim() || '',
        worldChanges: parsed?.worldChanges?.trim() || '',
        openThreads: parsed?.openThreads?.trim() || '',
    };
}

// ---- 生成フェーズ ----

interface GenerateOptions {
    run: AIRunner;
    signal?: AbortSignal;
}

interface SynopsisPlotResult {
    synopsis: string;
    plot: {
        theme: string;
        setting: string;
        hook: string;
        protagonistGoal: string;
        mainObstacle: string;
    };
}

interface CharacterUpdate {
    id: string;
    personality?: string;
    background?: string;
}

/**
 * 抽出結果（ユーザー編集後）から続編プロジェクト要素を生成する。
 */
export async function generateSequelElements(
    project: Project,
    extraction: SequelExtraction,
    options: GenerateOptions
): Promise<SequelElements> {
    const { run, signal } = options;

    // 1. あらすじ + プロット
    const spRaw = await run(
        buildGenerateSynopsisPlotPrompt(
            project.title,
            extraction.storyDigest,
            extraction.characterGrowth,
            extraction.worldChanges,
            extraction.openThreads
        ),
        { signal, temperature: 0.8 }
    );
    const sp = parseJsonLoose<SynopsisPlotResult>(spRaw);

    const synopsis = sp?.synopsis?.trim() || '';
    const plot = {
        theme: sp?.plot?.theme?.trim() || '',
        setting: sp?.plot?.setting?.trim() || '',
        hook: sp?.plot?.hook?.trim() || '',
        protagonistGoal: sp?.plot?.protagonistGoal?.trim() || '',
        mainObstacle: sp?.plot?.mainObstacle?.trim() || '',
    };

    // 2. キャラクター更新（失敗時は元キャラをそのまま引き継ぎ）
    let characters = project.characters ? [...project.characters] : [];
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    if (characters.length > 0) {
        try {
            const cuRaw = await run(
                buildUpdateCharactersPrompt(formatCharacters(project), extraction.characterGrowth, synopsis),
                { signal, temperature: 0.6 }
            );
            const cu = parseJsonLoose<{ characters: CharacterUpdate[] }>(cuRaw);
            if (cu?.characters && Array.isArray(cu.characters)) {
                const updateMap = new Map(cu.characters.map(u => [u.id, u]));
                characters = characters.map(c => {
                    const u = updateMap.get(c.id);
                    if (!u) return c;
                    return {
                        ...c,
                        personality: u.personality?.trim() || c.personality,
                        background: u.background?.trim() || c.background,
                    };
                });
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            // フォールバック: 元キャラをそのまま使用
        }
    }

    // 3. 世界観設定: 元設定を引き継ぎ、変化点ノートを1件追加
    const now = new Date();
    const worldSettings = project.worldSettings ? [...project.worldSettings] : [];
    if (extraction.worldChanges.trim()) {
        worldSettings.push({
            id: `ws-sequel-${Date.now()}`,
            category: 'history',
            title: '前作からの変化',
            content: extraction.worldChanges.trim(),
            createdAt: now,
            updatedAt: now,
            aiGenerated: true,
        });
    }

    return { synopsis, plot, characters, worldSettings };
}
