import { describe, it, expect } from 'vitest';
import { parseJsonLoose } from '../../services/summarization/parseJson';

describe('parseJsonLoose', () => {
    it('プレーンなJSONオブジェクトをパースする', () => {
        expect(parseJsonLoose('{"a": 1, "b": "x"}')).toEqual({ a: 1, b: 'x' });
    });

    it('JSON配列をパースする', () => {
        expect(parseJsonLoose('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('コードフェンスで囲まれたJSONを抽出する', () => {
        const text = '```json\n{"synopsis": "あらすじ"}\n```';
        expect(parseJsonLoose(text)).toEqual({ synopsis: 'あらすじ' });
    });

    it('前後にテキストがあっても最初のJSONを抽出する', () => {
        const text = 'はい、結果です:\n{"theme": "再会"}\n以上です。';
        expect(parseJsonLoose(text)).toEqual({ theme: '再会' });
    });

    it('ネストしたオブジェクトを正しくパースする', () => {
        const text = '{"plot": {"theme": "t", "hook": "h"}, "n": 2}';
        expect(parseJsonLoose(text)).toEqual({ plot: { theme: 't', hook: 'h' }, n: 2 });
    });

    it('文字列値に } や ] が含まれていても壊れない', () => {
        const text = '{"note": "閉じ括弧 } と ] を含む"}';
        expect(parseJsonLoose<{ note: string }>(text)?.note).toBe('閉じ括弧 } と ] を含む');
    });

    it('エスケープされた引用符を含む文字列を扱える', () => {
        const text = '{"q": "彼は\\"やあ\\"と言った"}';
        expect(parseJsonLoose<{ q: string }>(text)?.q).toBe('彼は"やあ"と言った');
    });

    it('JSONが含まれない場合はnullを返す', () => {
        expect(parseJsonLoose('これはただのテキストです')).toBeNull();
    });

    it('空文字列はnullを返す', () => {
        expect(parseJsonLoose('')).toBeNull();
    });

    it('壊れたJSON（閉じ括弧なし）はnullを返す', () => {
        expect(parseJsonLoose('{"a": 1, "b":')).toBeNull();
    });
});
