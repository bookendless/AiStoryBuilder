/**
 * 章立ての「知識の変化」「伏線」属性
 *
 * ここはプロンプトの出力形式とパーサが1対1で噛み合っていないと成立しない。
 * 片方だけ直すと、AIは項目を出しているのに保存されない（あるいは逆）という
 * 表に出ない欠落になるため、両端を同じテストで固定する。
 */

import { describe, it, expect } from 'vitest';
import { parseChapterList } from '../../services/chapter/parseChapterList';
import { CHAPTER_PROMPTS } from '../../services/prompts/chapter';
import { DRAFT_PROMPTS } from '../../services/prompts/draft';
import { getChapterDetails } from '../../utils/chapterUtils';

const NEW_FORMAT = `第1章: 出発
概要: 主人公が港町を離れる。
設定・場所: 港町の埠頭、早朝
雰囲気・ムード: 静かで不安げ
重要な出来事: 別れ、出航、嵐の予兆
登場キャラクター: 蒼真、灯
知識の変化: 蒼真は父の借金を知るが、灯には伏せたまま
伏線: 張る＝船長が隠している古い海図

第2章: 漂流
概要: 嵐で船が流される。
設定・場所: 外洋
雰囲気・ムード: 緊迫
重要な出来事: 嵐、遭難、救助
登場キャラクター: 蒼真、船長
知識の変化: 灯は蒼真の不在に気づくが理由を知らない
伏線: 回収＝海図が示す島に漂着する`;

const OLD_FORMAT = `第1章: 出発
概要: 主人公が港町を離れる。
設定・場所: 港町の埠頭、早朝
雰囲気・ムード: 静かで不安げ
重要な出来事: 別れ、出航、嵐の予兆
登場キャラクター: 蒼真、灯`;

describe('プロンプトとパーサの契約', () => {
    it('章立てプロンプトが2項目を出力形式に含んでいる', () => {
        expect(CHAPTER_PROMPTS.generateBasic).toContain('知識の変化:');
        expect(CHAPTER_PROMPTS.generateBasic).toContain('伏線:');
    });

    it('項目数の記載が実際の項目数と合っている', () => {
        // 出力形式だけ増やして「6項目」と書き続けると、モデルが数に合わせて項目を落とす
        expect(CHAPTER_PROMPTS.generateBasic).toContain('上記の8項目');
        expect(CHAPTER_PROMPTS.generateBasic).not.toContain('上記の6項目');
    });

    it('草案プロンプトに章の計画メモの差し込み口がある', () => {
        expect(DRAFT_PROMPTS.generateSingle).toContain('{chapterPlanNotes}');
    });
});

describe('parseChapterList（新形式）', () => {
    it('知識の変化と伏線を取り出す', () => {
        const chapters = parseChapterList(NEW_FORMAT);
        expect(chapters).toHaveLength(2);
        expect(chapters[0].knowledge).toBe('蒼真は父の借金を知るが、灯には伏せたまま');
        expect(chapters[0].foreshadowing).toBe('張る＝船長が隠している古い海図');
        expect(chapters[1].knowledge).toBe('灯は蒼真の不在に気づくが理由を知らない');
    });

    it('既存の項目を壊さない', () => {
        const chapters = parseChapterList(NEW_FORMAT);
        expect(chapters[0].title).toBe('出発');
        expect(chapters[0].summary).toBe('主人公が港町を離れる。');
        expect(chapters[0].setting).toBe('港町の埠頭、早朝');
        expect(chapters[0].mood).toBe('静かで不安げ');
        expect(chapters[0].keyEvents).toEqual(['別れ', '出航', '嵐の予兆']);
        expect(chapters[0].characters).toEqual(['蒼真', '灯']);
    });
});

describe('parseChapterList（旧形式との互換）', () => {
    it('2項目が無い応答でも解析できる', () => {
        const chapters = parseChapterList(OLD_FORMAT);
        expect(chapters).toHaveLength(1);
        expect(chapters[0].title).toBe('出発');
        expect(chapters[0].keyEvents).toEqual(['別れ', '出航', '嵐の予兆']);
    });

    it('未出力の項目は空文字でなく undefined（章に空欄を書き込まない）', () => {
        const chapters = parseChapterList(OLD_FORMAT);
        expect(chapters[0].knowledge).toBeUndefined();
        expect(chapters[0].foreshadowing).toBeUndefined();
    });

    it('「なし」だけの値は undefined にする（プロンプトに「伏線: なし」と載せない）', () => {
        // 出力形式が「無ければ『なし』」と書かせるため、モデルは高頻度でこの語を返す。
        // 保存すると草案プロンプトに載り、「未設定の項目は行ごと出さない」方針が崩れる
        const chapters = parseChapterList(`第1章: 日常
概要: 何も起きない。
知識の変化: なし
伏線: なし。`);
        expect(chapters[0].knowledge).toBeUndefined();
        expect(chapters[0].foreshadowing).toBeUndefined();
    });

    it('「なし」を含むだけの本物の記述は残す', () => {
        const chapters = parseChapterList(`第1章: 日常
概要: 何も起きない。
伏線: 回収＝手紙がなしのつぶてだった理由が判明する`);
        expect(chapters[0].foreshadowing).toBe('回収＝手紙がなしのつぶてだった理由が判明する');
    });

    it('「重要な出来事」の中に伏線の語があっても横取りしない', () => {
        // 伏線パターンは行頭に限定していないため、判定順序で守っている
        const chapters = parseChapterList(`第1章: 罠
概要: 罠にかかる。
重要な出来事: 伏線: 消えた鍵、追跡、逃走`);
        expect(chapters[0].keyEvents).toEqual(['伏線: 消えた鍵', '追跡', '逃走']);
        expect(chapters[0].foreshadowing).toBeUndefined();
    });
});

describe('getChapterDetails の計画メモ', () => {
    it('両方あれば2行にまとめる', () => {
        const details = getChapterDetails(
            { knowledge: '主人公が真相を知る', foreshadowing: '回収＝古い海図' },
            []
        );
        expect(details.planNotes).toBe(
            'この章での知識の変化: 主人公が真相を知る\nこの章で扱う伏線: 回収＝古い海図'
        );
    });

    it('片方だけなら1行だけ出す', () => {
        expect(getChapterDetails({ knowledge: '真相を知る' }, []).planNotes)
            .toBe('この章での知識の変化: 真相を知る');
        expect(getChapterDetails({ foreshadowing: '張る＝海図' }, []).planNotes)
            .toBe('この章で扱う伏線: 張る＝海図');
    });

    it('未設定なら空文字（「未設定」と書かない）', () => {
        // 「未設定」と入れると、AIがその語に反応して「まだ何も分かっていない」描写を足す
        expect(getChapterDetails({}, []).planNotes).toBe('');
        expect(getChapterDetails({ knowledge: '   ' }, []).planNotes).toBe('');
        expect(getChapterDetails(null, []).planNotes).toBe('');
    });

    it('既存の項目の挙動は変わらない', () => {
        const details = getChapterDetails({ setting: '港町', mood: '静か' }, []);
        expect(details.setting).toBe('港町');
        expect(details.mood).toBe('静か');
        expect(details.characters).toBe('未設定');
        expect(details.keyEvents).toBe('未設定');
    });
});
