/**
 * Project からソース文書を抽出し、検索用チャンクへ分割する
 */

import { Project } from '../../contexts/ProjectContext';
import { Character } from '../../types/project/character';
import { chunkProse } from '../import/chunkProse';
import { fnv1a64 } from './hash';
import { RagChunk, SourceDoc } from './types';
import {
    CHUNKER_VERSION,
    DRAFT_CHUNK_BUDGET,
    DRAFT_CHUNK_OVERLAP,
    SINGLE_CHUNK_MAX,
} from './constants';

/**
 * キャラクター情報のプロンプト向け整形（インデックスと強制包含の両方で使う共通形式）。
 * 口調は既存の buildCharacterInfo と同様に100文字へ切り詰める。
 */
export const formatCharacter = (char: Character): string => {
    let info = char.name;
    if (char.role) info += ` (${char.role})`;
    if (char.personality) info += `\n  性格: ${char.personality}`;
    if (char.appearance) info += `\n  外見: ${char.appearance}`;
    if (char.background) info += `\n  背景: ${char.background}`;
    if (char.speechStyle) {
        const speechStyle = char.speechStyle.trim();
        info += `\n  口調: ${speechStyle.length > 100 ? speechStyle.substring(0, 100) + '...' : speechStyle}`;
    }
    return info;
};

const foreshadowingStatusLabel: Record<string, string> = {
    planted: '設置済み・未回収',
    hinted: 'ヒント提示済み・未回収',
    resolved: '回収済み',
    abandoned: '破棄',
};

/**
 * Project から検索対象のソース文書を抽出する。
 *
 * plot はテンプレート側で全文注入されるため Phase 1 では索引しない
 * （索引すると同一情報が二重にプロンプトへ入る）。
 */
export const extractSourceDocs = (project: Project): SourceDoc[] => {
    const docs: SourceDoc[] = [];
    const push = (doc: Omit<SourceDoc, 'sourceKey'>) => {
        const text = doc.text.trim();
        if (!text) return;
        docs.push({ ...doc, text, sourceKey: `${doc.sourceType}:${doc.sourceId}` });
    };

    project.chapters.forEach((chapter, index) => {
        const chapterNo = index + 1;
        if (chapter.draft) {
            push({
                sourceType: 'chapterDraft',
                sourceId: chapter.id,
                label: `第${chapterNo}章「${chapter.title}」(草案抜粋)`,
                text: chapter.draft,
            });
        }
        if (chapter.summary) {
            push({
                sourceType: 'chapterSummary',
                sourceId: chapter.id,
                label: `第${chapterNo}章「${chapter.title}」(あらすじ)`,
                text: chapter.summary,
            });
        }
    });

    project.characters.forEach((char) => {
        push({
            sourceType: 'character',
            sourceId: char.id,
            label: `キャラクター: ${char.name}`,
            text: formatCharacter(char),
        });
    });

    (project.worldSettings || []).forEach((setting) => {
        push({
            sourceType: 'worldSetting',
            sourceId: setting.id,
            label: `設定: ${setting.title}`,
            text: `${setting.title}\n${setting.content}`,
        });
    });

    (project.glossary || []).forEach((term) => {
        push({
            sourceType: 'glossary',
            sourceId: term.id,
            label: `用語: ${term.term}`,
            text: `${term.term}${term.reading ? `（${term.reading}）` : ''}: ${term.definition}${term.notes ? `\n${term.notes}` : ''}`,
        });
    });

    (project.foreshadowings || []).forEach((fs) => {
        const status = foreshadowingStatusLabel[fs.status] || fs.status;
        const parts = [
            `伏線「${fs.title}」（${status}）`,
            fs.description,
            fs.plannedPayoffDescription ? `回収計画: ${fs.plannedPayoffDescription}` : '',
            ...fs.points.map((p) => `- ${p.description}`),
        ].filter(Boolean);
        push({
            sourceType: 'foreshadowing',
            sourceId: fs.id,
            label: `伏線: ${fs.title}`,
            text: parts.join('\n'),
        });
    });

    return docs;
};

/** ソース全文のハッシュ（チャンカー版数込み。版数を上げると全ソースが変更扱いになる） */
export const hashSourceDoc = (doc: SourceDoc): string =>
    fnv1a64(`v${CHUNKER_VERSION}\n${doc.label}\n${doc.text}`);

/** 1ソース文書をチャンク列に変換する */
export const chunkSourceDoc = (projectId: string, doc: SourceDoc): RagChunk[] => {
    const contentHash = hashSourceDoc(doc);
    const now = Date.now();

    const pieces =
        doc.sourceType === 'chapterDraft'
            ? chunkProse(doc.text, DRAFT_CHUNK_BUDGET, DRAFT_CHUNK_OVERLAP)
            : doc.text.length > SINGLE_CHUNK_MAX
                ? chunkProse(doc.text, SINGLE_CHUNK_MAX, 0)
                : [{ index: 0, text: doc.text }];

    return pieces.map((piece) => ({
        id: `${projectId}:${doc.sourceType}:${doc.sourceId}:${piece.index}`,
        projectId,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        sourceKey: doc.sourceKey,
        chunkIndex: piece.index,
        label: doc.label,
        text: piece.text,
        contentHash,
        updatedAt: now,
    }));
};
