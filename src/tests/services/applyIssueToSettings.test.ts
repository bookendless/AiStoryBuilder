/**
 * 整合性指摘の設定書補記
 *
 * 補記先を誤ると、間違った人物の設定書に注意書きが入り、**以降の全生成に効いてしまう**。
 * そのため「迷ったら解決しない」を明示的に固定する。
 */

import { describe, it, expect } from 'vitest';
import {
    resolveIssueTarget,
    buildConsistencyNote,
    appendNote,
    CONSISTENCY_NOTE_PREFIX,
} from '../../services/consistency/applyIssueToSettings';
import { formatCharacter } from '../../services/context/formatCharacter';
import { Character } from '../../types/project/character';
import { Project } from '../../types/project';

const project = {
    characters: [
        { id: 'c1', name: '蒼真' },
        { id: 'c2', name: '灯' },
    ],
    glossary: [
        { id: 'g1', term: '銀の航跡' },
        { id: 'g2', term: '深層潮' },
    ],
} as unknown as Pick<Project, 'characters' | 'glossary'>;

describe('resolveIssueTarget', () => {
    it('完全一致するキャラクターを解決する', () => {
        const target = resolveIssueTarget({ targetType: 'character', targetName: '蒼真' }, project);
        expect(target).toEqual({ type: 'character', id: 'c1', name: '蒼真' });
    });

    it('用語も解決する', () => {
        const target = resolveIssueTarget({ targetType: 'term', targetName: '深層潮' }, project);
        expect(target?.id).toBe('g2');
    });

    it('部分一致でも一意なら解決する', () => {
        const target = resolveIssueTarget({ targetType: 'character', targetName: '蒼真さん' }, project);
        expect(target?.id).toBe('c1');
    });

    it('実在しない名前は解決しない', () => {
        expect(resolveIssueTarget({ targetType: 'character', targetName: '存在しない人' }, project)).toBeNull();
    });

    it('候補が複数あるときは解決しない（誤った設定書に書き込まないため）', () => {
        const ambiguous = {
            characters: [
                { id: 'a', name: '蒼真' },
                { id: 'b', name: '蒼真' },
            ],
            glossary: [],
        } as unknown as Pick<Project, 'characters' | 'glossary'>;
        expect(resolveIssueTarget({ targetType: 'character', targetName: '蒼真' }, ambiguous)).toBeNull();
    });

    it('部分一致の候補が複数あるときも解決しない', () => {
        const ambiguous = {
            characters: [
                { id: 'a', name: '蒼真' },
                { id: 'b', name: '蒼真の父' },
            ],
            glossary: [],
        } as unknown as Pick<Project, 'characters' | 'glossary'>;
        // 「蒼真」は両方に部分一致するが、完全一致が1件だけなのでそちらを採る
        expect(resolveIssueTarget({ targetType: 'character', targetName: '蒼真' }, ambiguous)?.id).toBe('a');
        // 「蒼真の」は完全一致が無く、「蒼真」「蒼真の父」の両方に部分一致するため解決しない
        expect(resolveIssueTarget({ targetType: 'character', targetName: '蒼真の' }, ambiguous)).toBeNull();
    });

    it('種別または名前が欠けていれば解決しない', () => {
        expect(resolveIssueTarget({ targetName: '蒼真' }, project)).toBeNull();
        expect(resolveIssueTarget({ targetType: 'character' }, project)).toBeNull();
        expect(resolveIssueTarget({ targetType: 'character', targetName: '  ' }, project)).toBeNull();
    });

    it('用語集が未設定でも落ちない', () => {
        const empty = { characters: [], glossary: undefined } as unknown as Pick<Project, 'characters' | 'glossary'>;
        expect(resolveIssueTarget({ targetType: 'term', targetName: '何か' }, empty)).toBeNull();
    });
});

describe('buildConsistencyNote', () => {
    const issue = { quote: '彼の瞳は青かった', description: '設定では黒', suggestion: '黒に統一する' };

    it('日付・引用・指摘・対処を定型で並べる', () => {
        const note = buildConsistencyNote(issue, new Date(2026, 7, 17));
        expect(note).toBe(
            `${CONSISTENCY_NOTE_PREFIX} 2026-08-17】\n引用: 彼の瞳は青かった\n指摘: 設定では黒\n対処: 黒に統一する`
        );
    });

    it('修正案が無ければ対処の行を出さない', () => {
        const note = buildConsistencyNote({ quote: 'あ', description: 'い' }, new Date(2026, 7, 17));
        expect(note).not.toContain('対処:');
    });
});

describe('appendNote', () => {
    it('空欄なら補記だけになる', () => {
        expect(appendNote(undefined, 'メモ')).toBe('メモ');
        expect(appendNote('', 'メモ')).toBe('メモ');
    });

    it('既存文の末尾に空行を挟んで足す', () => {
        expect(appendNote('既存の設定', 'メモ')).toBe('既存の設定\n\nメモ');
    });

    it('同じ補記は二度足さない（同じ指摘を連打しても増殖させない）', () => {
        const once = appendNote('既存', 'メモ');
        expect(appendNote(once, 'メモ')).toBe(once);
    });
});

describe('補記が生成プロンプトに載ること', () => {
    it('formatCharacter が補記を含める（載らなければ再発防止にならない）', () => {
        const character = { id: 'c', name: '蒼真', notes: '一人称は「僕」で固定' } as Character;
        expect(formatCharacter(character)).toContain('補記: 一人称は「僕」で固定');
    });

    it('補記が空なら行ごと出さない', () => {
        expect(formatCharacter({ id: 'c', name: '蒼真', notes: '   ' } as Character)).toBe('蒼真');
    });
});
