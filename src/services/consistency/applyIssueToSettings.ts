/**
 * 整合性指摘を設定書へ補記する
 *
 * 指摘をその場で直すだけでは、次の生成でまた同じ矛盾が出る。設定書側に
 * 「この点は確定済み」という記述を残すことで、以降の生成プロンプトに乗せて再発を抑える。
 *
 * 補記はAIを使わない定型文。文面が毎回同じであることが重要で、
 * 後から人間が読んで「いつ・何を根拠に確定したか」を追えるようにする。
 */

import { Project } from '../../types/project';
import { ConsistencyIssue } from '../../types/consistency';

export interface ResolvedTarget {
    type: 'character' | 'term';
    id: string;
    /** 設定書に登録されている正式な表記（AIが返した表記ではない） */
    name: string;
}

/**
 * 指摘の targetName を設定台帳の実在項目に解決する。
 *
 * 完全一致 → 部分一致の順で探し、**候補が複数あるときは解決しない**。
 * 誤った人物の設定書に注意書きを足すと、その後の全生成に効いてしまうため、
 * 迷ったら何もしない（指摘自体はそのまま残る）。
 */
export function resolveIssueTarget(
    issue: Pick<ConsistencyIssue, 'targetType' | 'targetName'>,
    project: Pick<Project, 'characters' | 'glossary'>
): ResolvedTarget | null {
    const { targetType, targetName } = issue;
    if (!targetType || !targetName?.trim()) return null;
    const name = targetName.trim();

    const candidates: { id: string; name: string }[] =
        targetType === 'character'
            ? project.characters.map(c => ({ id: c.id, name: c.name }))
            : (project.glossary ?? []).map(g => ({ id: g.id, name: g.term }));

    const exact = candidates.filter(c => c.name === name);
    if (exact.length === 1) return { type: targetType, id: exact[0].id, name: exact[0].name };
    // 同名が複数ある台帳では、どれを指しているか決められない
    if (exact.length > 1) return null;

    const partial = candidates.filter(c => c.name.includes(name) || name.includes(c.name));
    if (partial.length === 1) return { type: targetType, id: partial[0].id, name: partial[0].name };

    return null;
}

/** 補記の見出し。既に補記済みかの判定にも使う */
export const CONSISTENCY_NOTE_PREFIX = '【整合性メモ';

const formatDate = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * 補記する定型文を組み立てる。
 * 引用・指摘・対処の3点だけに絞り、生成プロンプトを不必要に膨らませない。
 */
export function buildConsistencyNote(
    issue: Pick<ConsistencyIssue, 'quote' | 'description' | 'suggestion'>,
    date: Date = new Date()
): string {
    const lines = [
        `${CONSISTENCY_NOTE_PREFIX} ${formatDate(date)}】`,
        `引用: ${issue.quote}`,
        `指摘: ${issue.description}`,
    ];
    if (issue.suggestion?.trim()) lines.push(`対処: ${issue.suggestion.trim()}`);
    return lines.join('\n');
}

/**
 * 既存テキストの末尾へ補記を追加する。
 * 同じ補記が既にあれば追加しない（同じ指摘を二度押しても増殖させない）。
 */
export function appendNote(existing: string | undefined, note: string): string {
    const base = (existing ?? '').trimEnd();
    if (base.includes(note)) return base;
    return base ? `${base}\n\n${note}` : note;
}
