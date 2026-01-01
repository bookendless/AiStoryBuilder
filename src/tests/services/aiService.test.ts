/**
 * AI Service のユニットテスト
 * 
 * AIサービスのコア機能（プロンプト生成、リクエスト構築など）をテスト
 */

import { describe, it, expect } from 'vitest';

// プロンプトテンプレートのインポート
import { PROMPTS } from '../../services/prompts';

describe('PROMPTS オブジェクト', () => {
    describe('構造の検証', () => {
        it('character プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('character');
            expect(PROMPTS.character).toHaveProperty('enhance');
            expect(PROMPTS.character).toHaveProperty('create');
        });

        it('plot プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('plot');
        });

        it('synopsis プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('synopsis');
        });

        it('evaluation プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('evaluation');
        });

        it('chapter プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('chapter');
        });

        it('draft プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('draft');
        });

        it('world プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('world');
        });

        it('foreshadowing プロンプトが存在する', () => {
            expect(PROMPTS).toHaveProperty('foreshadowing');
        });
    });

    describe('プロンプトテンプレートの内容検証', () => {
        it('character.enhance にプレースホルダーが含まれる', () => {
            const enhancePrompt = PROMPTS.character.enhance;
            expect(enhancePrompt).toContain('{title}');
            expect(enhancePrompt).toContain('{theme}');
            expect(enhancePrompt).toContain('{name}');
        });

        it('character.create に出力形式の指示が含まれる', () => {
            const createPrompt = PROMPTS.character.create;
            expect(createPrompt).toContain('キャラクター');
            expect(createPrompt).toContain('名前');
        });

        it('すべてのプロンプトが文字列である', () => {
            const checkAllStrings = (obj: Record<string, unknown>, path = '') => {
                for (const [key, value] of Object.entries(obj)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    if (typeof value === 'object' && value !== null) {
                        checkAllStrings(value as Record<string, unknown>, currentPath);
                    } else {
                        expect(typeof value).toBe('string');
                    }
                }
            };

            checkAllStrings(PROMPTS);
        });
    });
});

describe('プロンプトテンプレートの置換', () => {
    it('単一のプレースホルダーを置換できる', () => {
        const template = 'タイトル: {title}';
        const result = template.replace('{title}', 'テスト作品');

        expect(result).toBe('タイトル: テスト作品');
    });

    it('複数のプレースホルダーを置換できる', () => {
        const template = 'タイトル: {title}, テーマ: {theme}';
        let result = template;
        result = result.replace('{title}', 'テスト作品');
        result = result.replace('{theme}', '友情');

        expect(result).toBe('タイトル: テスト作品, テーマ: 友情');
    });

    it('同じプレースホルダーが複数回出現する場合', () => {
        const template = '{name}は{name}です';
        const result = template.replace(/{name}/g, '太郎');

        expect(result).toBe('太郎は太郎です');
    });

    it('存在しないプレースホルダーは変更されない', () => {
        const template = 'テーマ: {theme}';
        const result = template.replace('{nonexistent}', '値');

        expect(result).toBe('テーマ: {theme}');
    });
});

describe('プロンプト長の検証', () => {
    it('各プロンプトが空でない', () => {
        const checkNonEmpty = (obj: Record<string, unknown>, path = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                if (typeof value === 'object' && value !== null) {
                    checkNonEmpty(value as Record<string, unknown>, currentPath);
                } else if (typeof value === 'string') {
                    expect(value.length, `${currentPath} should not be empty`).toBeGreaterThan(0);
                }
            }
        };

        checkNonEmpty(PROMPTS);
    });

    it('プロンプトに日本語が含まれる', () => {
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

        const checkJapanese = (obj: Record<string, unknown>, path = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                if (typeof value === 'object' && value !== null) {
                    checkJapanese(value as Record<string, unknown>, currentPath);
                } else if (typeof value === 'string') {
                    expect(
                        japaneseRegex.test(value),
                        `${currentPath} should contain Japanese characters`
                    ).toBe(true);
                }
            }
        };

        checkJapanese(PROMPTS);
    });
});
