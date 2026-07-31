import { describe, it, expect } from 'vitest';
import { modelSupportsTemperature, isOpenAIReasoningModel } from '../../utils/modelCapabilities';

/**
 * temperature 非対応モデルに temperature を送ると 400 になる。
 * 接続テスト（AISettings）と生成（aiService）で判定がずれると
 * 「テストは通るのに生成で400」が起きるため、判定は共通化してここで検証する。
 */
describe('isOpenAIReasoningModel', () => {
    it.each(['gpt-5', 'gpt-5.1', 'gpt-5.6-sol', 'o1-preview', 'o3-mini', 'o4-mini'])(
        '%s をリーズニングモデルと判定する',
        (model) => {
            expect(isOpenAIReasoningModel(model)).toBe(true);
        }
    );

    it.each(['gpt-4o', 'gpt-4.1', 'gpt-3.5-turbo', 'claude-opus-4-5', 'local-model', ''])(
        '%s はリーズニングモデルではない',
        (model) => {
            expect(isOpenAIReasoningModel(model)).toBe(false);
        }
    );

    it('o で始まるだけの無関係なモデル名を巻き込まない', () => {
        // 以前の判定は model.startsWith('o') だったため、o系以外まで該当していた
        expect(isOpenAIReasoningModel('omni-test')).toBe(false);
    });
});

describe('modelSupportsTemperature', () => {
    it.each(['gpt-5.6-sol', 'gpt-5', 'o3-mini', 'o4-mini'])(
        'OpenAIリーズニングモデル %s では temperature を送らない',
        (model) => {
            expect(modelSupportsTemperature(model)).toBe(false);
        }
    );

    it.each(['claude-opus-4-7', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-fable-5', 'claude-mythos-5'])(
        'temperature 非対応のClaudeモデル %s では送らない',
        (model) => {
            expect(modelSupportsTemperature(model)).toBe(false);
        }
    );

    it.each(['gpt-4o', 'gpt-4.1', 'claude-opus-4-5', 'claude-3-5-sonnet', 'gemini-3.5-flash', 'local-model'])(
        '%s では temperature を送る',
        (model) => {
            expect(modelSupportsTemperature(model)).toBe(true);
        }
    );

    it('モデル未指定の場合は送る（従来動作を維持）', () => {
        expect(modelSupportsTemperature('')).toBe(true);
    });
});
