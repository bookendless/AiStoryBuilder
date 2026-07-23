import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../services/rag/tokenize';

describe('tokenize', () => {
    it('日本語をバイグラムに分解する', () => {
        expect(tokenize('魔法学院')).toEqual(['魔法', '法学', '学院']);
    });

    it('1文字のCJK連続はユニグラムになる', () => {
        expect(tokenize('あ')).toEqual(['あ']);
    });

    it('英数字の連続は1語トークンになる', () => {
        expect(tokenize('LM Studio v2')).toEqual(['lm', 'studio', 'v2']);
    });

    it('NFKC正規化で全角英数が半角に統一される', () => {
        expect(tokenize('ＡＢＣ１２３')).toEqual(['abc123']);
    });

    it('句読点・記号で分割される', () => {
        expect(tokenize('魔法、学院')).toEqual(['魔法', '学院']);
    });

    it('日英混在テキストを処理できる', () => {
        const tokens = tokenize('主人公のAliceは魔法を使う');
        expect(tokens).toContain('alice');
        expect(tokens).toContain('主人');
        expect(tokens).toContain('魔法');
    });

    it('空文字列は空配列を返す', () => {
        expect(tokenize('')).toEqual([]);
    });
});
