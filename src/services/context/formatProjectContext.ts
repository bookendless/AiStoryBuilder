/**
 * 設定資料・用語集・相関図・タイムラインのプロンプト向け整形
 *
 * 同じ整形が3箇所（草案パネルの本体・同パネルの文字数計算・先回り生成）に写されており、
 * **先回り生成の相関図だけが呼び方（fromCallsTo / toCallsFrom）を落としていた**。
 * 呼称は口調の一貫性に直結するため、落ちると先回り生成だけ呼び方がぶれる。
 *
 * 文字数計算がここを共有するのが重要な点。別実装で数えていると、
 * 表示される「この設定を含めると何文字増えるか」が実際の増分とずれていく。
 */

import { Project } from '../../types/project';

/** 各項目の本文をこの文字数で切り詰める（従来の挙動を維持） */
const ITEM_CLIP = 100;

const clip = (text: string): string => `${text.substring(0, ITEM_CLIP)}...`;

export const formatRelationships = (project: Project): string =>
    (project.relationships || [])
        .map(r => {
            const fromChar = project.characters.find(c => c.id === r.from)?.name || '不明';
            const toChar = project.characters.find(c => c.id === r.to)?.name || '不明';
            const callNote = (r.fromCallsTo || r.toCallsFrom)
                ? ` / 呼び方: ${fromChar}は${toChar}を「${r.fromCallsTo || '未設定'}」、${toChar}は${fromChar}を「${r.toCallsFrom || '未設定'}」と呼ぶ`
                : '';
            return `・${fromChar} → ${toChar}: ${r.type} (${r.description || ''})${callNote}`;
        })
        .join('\n');

export const formatWorldSettings = (project: Project): string =>
    (project.worldSettings || [])
        .map(w => `・${w.title}: ${clip(w.content)}`)
        .join('\n');

export const formatGlossary = (project: Project): string =>
    (project.glossary || [])
        .map(g => `・${g.term}: ${clip(g.definition)}`)
        .join('\n');

export const formatTimeline = (project: Project): string =>
    [...(project.timeline || [])]
        .sort((a, b) => a.order - b.order)
        .map(t => {
            let entry = `・${t.title}`;
            if (t.date) entry += ` (${t.date})`;
            if (t.description) entry += `: ${clip(t.description)}`;
            return entry;
        })
        .join('\n');
