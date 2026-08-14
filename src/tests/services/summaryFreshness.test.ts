/**
 * 章あらすじの鮮度判定
 *
 * 誤判定の代償が非対称なので、真偽表を固定する。
 * 「古いのに古くないと言う」＝陳腐化したあらすじが次章生成の文脈に入り続ける（機能が無いのと同じ）。
 * 「古くないのに古いと言う」＝不要なAI呼び出しを促してしまう（課金）。
 */

import { describe, it, expect } from 'vitest';
import {
    isSummaryStale,
    computeSummarySourceHash,
    extractProvisionalSummary,
    SUMMARY_SOURCE_UNVERIFIED,
} from '../../services/summary/freshness';

const DRAFT = '第一章の本文。主人公は街を出た。夜になり、彼は森の入口で足を止めた。';

describe('computeSummarySourceHash', () => {
    it('同じ本文なら同じハッシュになる', () => {
        expect(computeSummarySourceHash(DRAFT)).toBe(computeSummarySourceHash(DRAFT));
    });

    it('本文が変われば違うハッシュになる', () => {
        expect(computeSummarySourceHash(DRAFT)).not.toBe(computeSummarySourceHash(DRAFT + '追記。'));
    });

    it('前後の空白だけの差では変化しない（自動保存で末尾に改行が付いても古い判定にしないため）', () => {
        expect(computeSummarySourceHash(`\n  ${DRAFT}  \n`)).toBe(computeSummarySourceHash(DRAFT));
    });

    it('実ハッシュは UNVERIFIED と衝突しない', () => {
        expect(computeSummarySourceHash(DRAFT)).not.toBe(SUMMARY_SOURCE_UNVERIFIED);
    });
});

describe('isSummaryStale', () => {
    it('本文が無ければ古くない（章立てだけ作った段階でバッジを出さない）', () => {
        expect(isSummaryStale({ summary: 'あらすじ' })).toBe(false);
        expect(isSummaryStale({ summary: 'あらすじ', draft: '' })).toBe(false);
        expect(isSummaryStale({ summary: '', draft: '   ' })).toBe(false);
    });

    it('本文があるのにあらすじが空なら古い', () => {
        expect(isSummaryStale({ summary: '', draft: DRAFT })).toBe(true);
        expect(isSummaryStale({ summary: '   ', draft: DRAFT })).toBe(true);
    });

    it('あらすじが空なら、ハッシュ未設定でも古い（判定順序）', () => {
        // ハッシュ未設定を先に見てしまうと、旧データの空あらすじが「判定不能」で見逃される
        expect(isSummaryStale({ summary: '', draft: DRAFT, summarySourceHash: undefined })).toBe(true);
    });

    it('ハッシュ未設定は判定不能として古くない（旧データが一斉にバッジ表示されるのを防ぐ）', () => {
        expect(isSummaryStale({ summary: 'あらすじ', draft: DRAFT })).toBe(false);
    });

    it('ハッシュが現在の本文と一致すれば古くない', () => {
        expect(isSummaryStale({
            summary: 'あらすじ',
            draft: DRAFT,
            summarySourceHash: computeSummarySourceHash(DRAFT),
        })).toBe(false);
    });

    it('本文が書き換えられていれば古い', () => {
        expect(isSummaryStale({
            summary: 'あらすじ',
            draft: DRAFT + '\n翌朝、彼は森を抜けた。',
            summarySourceHash: computeSummarySourceHash(DRAFT),
        })).toBe(true);
    });

    it('UNVERIFIED は常に古い（機械抽出・履歴復元・AI強化の印）', () => {
        expect(isSummaryStale({
            summary: '冒頭の抜粋',
            draft: DRAFT,
            summarySourceHash: SUMMARY_SOURCE_UNVERIFIED,
        })).toBe(true);
    });

    it('UNVERIFIED でも本文が無ければ古くない（本文なしの規則が優先）', () => {
        expect(isSummaryStale({
            summary: 'あらすじ',
            summarySourceHash: SUMMARY_SOURCE_UNVERIFIED,
        })).toBe(false);
    });
});

describe('extractProvisionalSummary', () => {
    it('文境界で切る', () => {
        const summary = extractProvisionalSummary(DRAFT, 30);
        expect(summary.endsWith('。')).toBe(true);
        expect(summary.length).toBeLessThanOrEqual(30);
    });

    it('改行を潰して1行にする（あらすじ欄は1行で表示されるため）', () => {
        expect(extractProvisionalSummary('一行目。\n\n二行目。')).toBe('一行目。 二行目。');
    });

    it('短い本文はそのまま返す', () => {
        expect(extractProvisionalSummary('短い本文。')).toBe('短い本文。');
    });

    it('空の本文では空文字を返す（あらすじ空＝古い、として拾われる）', () => {
        expect(extractProvisionalSummary('   \n  ')).toBe('');
    });
});
