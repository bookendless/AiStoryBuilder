/**
 * 設定台帳ファクトシート生成
 *
 * キャラクター・用語集・世界観・時系列の各台帳から、整合性チェック用の
 * コンパクトなテキストを組み立てる。プロンプト全体を10k文字予算に収めるため、
 * 優先度順（キャラクター > 用語集 > 世界観 > 時系列）にセクションを詰め、
 * 上限を超えるセクションは切り詰める。
 */

import { Project } from '../../types/project';

/** ファクトシートの既定上限（プロンプト内で本文と指示文に予算を残すための安全枠） */
export const FACT_SHEET_MAX_CHARS = 3000;

const clip = (value: string | undefined, max: number): string => {
    const text = (value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > max ? `${text.substring(0, max)}…` : text;
};

/** セクションを優先度順に上限内へ詰める */
const packSections = (sections: string[], maxChars: number): string => {
    const packed: string[] = [];
    let total = 0;
    for (const section of sections) {
        if (!section) continue;
        const remaining = maxChars - total;
        if (remaining <= 0) break;
        const body = section.length > remaining ? `${section.substring(0, remaining)}…` : section;
        packed.push(body);
        total += body.length + 2; // 区切りの空行分
    }
    return packed.join('\n\n');
};

export function buildFactSheet(project: Project, maxChars: number = FACT_SHEET_MAX_CHARS): string {
    const sections: string[] = [];

    if (project.characters.length > 0) {
        const lines = project.characters.map(c => {
            const parts = [`- ${c.name}（${clip(c.role, 20) || '役割未設定'}）`];
            if (c.appearance?.trim()) parts.push(`外見: ${clip(c.appearance, 80)}`);
            if (c.personality?.trim()) parts.push(`性格: ${clip(c.personality, 50)}`);
            if (c.speechStyle?.trim()) parts.push(`口調: ${clip(c.speechStyle, 60)}`);
            return parts.join(' / ');
        });
        sections.push(`■キャラクター設定\n${lines.join('\n')}`);
    }

    const glossary = project.glossary ?? [];
    if (glossary.length > 0) {
        const lines = glossary.map(g =>
            `- ${g.term}${g.reading ? `（${g.reading}）` : ''}: ${clip(g.definition, 60)}`
        );
        sections.push(`■用語集（正しい表記）\n${lines.join('\n')}`);
    }

    const worldSettings = project.worldSettings ?? [];
    if (worldSettings.length > 0) {
        const lines = worldSettings.map(w => `- ${w.title}: ${clip(w.content, 80)}`);
        sections.push(`■世界観設定\n${lines.join('\n')}`);
    }

    const timeline = (project.timeline ?? []).slice().sort((a, b) => a.order - b.order);
    if (timeline.length > 0) {
        const lines = timeline.map(t =>
            `- ${t.order}. ${t.title}${t.date ? `（${t.date}）` : ''}: ${clip(t.description, 50)}`
        );
        sections.push(`■時系列（出来事の順序）\n${lines.join('\n')}`);
    }

    if (sections.length === 0) {
        return '（設定台帳は未登録。章内のブレのみをチェックする）';
    }

    return packSections(sections, maxChars);
}
