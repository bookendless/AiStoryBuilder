import { describe, it, expect } from 'vitest';
import { parseTimelineAIResponse, parseConsistencyCheckResponse } from '../../utils/timelineParser';
import { extractCharactersFromContent } from '../../utils/characterParser';
import { parseStoryProposal } from '../../utils/storyProposalParser';

/**
 * 共通JSON抽出（jsonExtract）へ移行した各パーサーの回帰テスト。
 * 旧実装は貪欲な正規表現で、JSONの後ろに波括弧・角括弧を含む補足文があると壊れていた。
 */

describe('parseTimelineAIResponse（JSON経路）', () => {
    it('イベント配列を解析する', () => {
        const res = parseTimelineAIResponse('[{"title": "出会い", "description": "二人が出会う"}]');
        expect(res.success).toBe(true);
        expect(res.format).toBe('json');
        expect(res.events[0].title).toBe('出会い');
    });

    it('{"events": [...]} 形式の内側の配列を解析する', () => {
        const res = parseTimelineAIResponse('{"events": [{"title": "別れ", "description": "d"}]}');
        expect(res.success).toBe(true);
        expect(res.events.map((e) => e.title)).toEqual(['別れ']);
    });

    it('単一オブジェクトを1件のイベントとして解析する', () => {
        const res = parseTimelineAIResponse('結果です:\n{"title": "決戦", "description": "d"}');
        expect(res.success).toBe(true);
        expect(res.events.map((e) => e.title)).toEqual(['決戦']);
    });

    it('後ろに角括弧を含む補足文があっても解析する', () => {
        const res = parseTimelineAIResponse('[{"title": "旅立ち", "description": "d"}]\n\n※[注] 日付は推定です');
        expect(res.success).toBe(true);
        expect(res.events.map((e) => e.title)).toEqual(['旅立ち']);
    });
});

describe('parseConsistencyCheckResponse', () => {
    it('後ろに波括弧を含む補足文があってもJSONとして解析する', () => {
        const res = parseConsistencyCheckResponse(
            '{"hasIssues": true, "issues": ["矛盾"], "suggestions": []}\n補足: {詳細は本文参照}'
        );
        expect(res).toEqual({ hasIssues: true, issues: ['矛盾'], suggestions: [] });
    });
});

describe('extractCharactersFromContent（JSON経路）', () => {
    it('{"characters": [...]} 形式を解析する', () => {
        const content = '```json\n{"characters": [{"name": "リリィ", "role": "主人公"}]}\n```';
        const res = extractCharactersFromContent(content, 5, 'json');
        expect(res.parseMethod).toBe('json');
        expect(res.characters.map((c) => c.name)).toEqual(['リリィ']);
    });

    it('配列形式を解析する', () => {
        const res = extractCharactersFromContent('[{"name": "カイ", "role": "相棒"}]', 5, 'json');
        expect(res.characters.map((c) => c.name)).toEqual(['カイ']);
    });
});

describe('parseStoryProposal', () => {
    it('後ろに波括弧を含む補足文があっても提案を解析する', () => {
        const json = JSON.stringify({
            title: '題',
            theme: 'テーマ',
            mainGenre: 'ファンタジー',
            description: '説明',
            synopsis: 'あらすじ',
        });
        const res = parseStoryProposal(`${json}\n\n補足: {必要に応じて調整}`);
        expect(res?.title).toBe('題');
    });
});
