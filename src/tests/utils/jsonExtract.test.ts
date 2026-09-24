import { describe, it, expect } from 'vitest';
import { extractJson, parseJsonLoose, parseJsonObject } from '../../utils/jsonExtract';

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

    it('ネストしたオブジェクトで終わる（}} で終わる）JSONを壊さない', () => {
        expect(parseJsonLoose('{"a": {"b": 1}}')).toEqual({ a: { b: 1 } });
    });

    it('JSONの後ろに波括弧を含む補足文があっても抽出できる', () => {
        const text = '{"a": 1}\n\n補足: {必要に応じて調整}';
        expect(parseJsonLoose(text)).toEqual({ a: 1 });
    });

    it('二重波括弧（{{ ... }}）で包まれたJSONを抽出できる', () => {
        expect(parseJsonLoose('{{"a": 1, "b": {"c": 2}}}')).toEqual({ a: 1, b: { c: 2 } });
    });

    it('前置きに角括弧の注記があっても後続のJSONを抽出できる', () => {
        expect(parseJsonLoose('[注意] 以下が結果です\n{"a": 1}')).toEqual({ a: 1 });
    });

    it('文字列値の中の生の改行を修復してパースする', () => {
        const text = '{"text": "一行目\n二行目"}';
        expect(parseJsonLoose<{ text: string }>(text)?.text).toBe('一行目\n二行目');
    });

    it('壊れた外側JSONの内側にある断片を誤って返さない', () => {
        expect(parseJsonLoose('{"a": {"b": 1}, "c": }')).toBeNull();
    });

    it('プリミティブ値はJSONとして扱わない', () => {
        expect(parseJsonLoose('123')).toBeNull();
    });
});

describe('parseJsonObject', () => {
    it('配列ではなくオブジェクトを返す', () => {
        expect(parseJsonObject('[1, 2] {"a": 1}')).toEqual({ a: 1 });
    });

    it('オブジェクトが無ければnullを返す', () => {
        expect(parseJsonObject('[1, 2, 3]')).toBeNull();
    });
});

describe('extractJson', () => {
    it('パースに使った元文字列を返す', () => {
        const found = extractJson('前置き {"a": 1} 後置き', 'object');
        expect(found?.source).toBe('{"a": 1}');
    });

    it('accept で受理条件を絞り込める', () => {
        const text = '関係[1]の一覧: [{"from": "A"}]';
        const found = extractJson(text, 'array', {
            accept: (v) => Array.isArray(v) && v.every((e) => e !== null && typeof e === 'object'),
        });
        expect(found?.value).toEqual([{ from: 'A' }]);
    });

    it('受理条件で弾かれた外側オブジェクトの内側から候補を探す', () => {
        const text = '{"基本設定": {"メインテーマ": "再生", "舞台設定": "港町"}}';
        const found = extractJson(text, 'object', {
            accept: (v) => ['メインテーマ', '舞台設定'].every((k) => Object.prototype.hasOwnProperty.call(v, k)),
        });
        expect(found?.value).toEqual({ メインテーマ: '再生', 舞台設定: '港町' });
    });
});
