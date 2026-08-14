/**
 * 講評（evaluateStory）の応答パースの検証
 *
 * 貪欲な正規表現から parseJsonLoose へ移行したため、どの応答がどう解釈されるかを固定する。
 * あわせて、引用つき改善点（weaknessDetails）の実在検証も確認する。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { aiService } from '../../services/aiService';
import { AISettings } from '../../types/ai';

const settings: AISettings = {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000,
};

const content = '彼女は窓の外をぼんやりと眺めていた。';

const mockAIResponse = (text: string) => {
    vi.spyOn(aiService, 'generateContent').mockResolvedValue({ content: text });
};

const validBody = {
    score: 4,
    summary: '総評です。',
    strengths: ['情景描写が丁寧'],
    weaknesses: ['心情描写が浅い'],
    improvements: ['内面を掘り下げる'],
    detailedAnalysis: '## 詳細',
};

describe('evaluateStory の応答パース', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('素のJSONをパースできる（従来動作の回帰）', async () => {
        mockAIResponse(JSON.stringify(validBody));

        const result = await aiService.evaluateStory({ mode: 'structure', content }, settings);

        expect(result.score).toBe(4);
        expect(result.summary).toBe('総評です。');
        expect(result.weaknesses).toEqual(['心情描写が浅い']);
    });

    it('前後に説明文やコードフェンスが付いていてもパースできる', async () => {
        mockAIResponse(`評価結果は以下のとおりです。\n\n\`\`\`json\n${JSON.stringify(validBody)}\n\`\`\`\n\n以上です。`);

        const result = await aiService.evaluateStory({ mode: 'structure', content }, settings);

        expect(result.score).toBe(4);
        expect(result.detailedAnalysis).toBe('## 詳細');
    });

    it('JSONでない応答は従来どおりスコア0のフォールバックを返す', async () => {
        mockAIResponse('この作品はとても良いと思います。特に描写が優れています。');

        const result = await aiService.evaluateStory({ mode: 'structure', content }, settings);

        expect(result.score).toBe(0);
        expect(result.summary).toBe('評価結果の解析に失敗しました。');
        expect(result.strengths).toEqual([]);
        expect(result.weaknesses).toEqual([]);
        expect(result.detailedAnalysis).toContain('この作品はとても良い');
    });

    it('実在する引用は weaknessDetails として保持する', async () => {
        mockAIResponse(JSON.stringify({
            ...validBody,
            weaknessDetails: [{ point: '心情描写が浅い', quote: '窓の外をぼんやりと眺めていた' }],
        }));

        const result = await aiService.evaluateStory({ mode: 'structure', content }, settings);

        expect(result.weaknessDetails).toEqual([
            { point: '心情描写が浅い', quote: '窓の外をぼんやりと眺めていた' },
        ]);
    });

    it('実在しない引用は落とすが、指摘自体は残す', async () => {
        mockAIResponse(JSON.stringify({
            ...validBody,
            weaknessDetails: [{ point: '心情描写が浅い', quote: '本文に無い一文' }],
        }));

        const result = await aiService.evaluateStory({ mode: 'structure', content }, settings);

        expect(result.weaknessDetails).toEqual([{ point: '心情描写が浅い' }]);
    });

    it('weaknessDetails が無い応答（旧形式）でも weaknesses は従来どおり返る', async () => {
        mockAIResponse(JSON.stringify(validBody));

        const result = await aiService.evaluateStory({ mode: 'structure', content }, settings);

        expect(result.weaknessDetails).toBeUndefined();
        expect(result.weaknesses).toEqual(['心情描写が浅い']);
    });
});
