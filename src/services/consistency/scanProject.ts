/**
 * プロジェクト全体（対象章）の整合性スキャンのオーケストレーション
 *
 * 章ごとに1回（長章は分割で複数回）AIを呼び、結果を ConsistencyReport に統合する。
 * 個別章の失敗はスキャン全体を止めず、その章をスキップして続行する（キャンセルは即時中断）。
 */

import { Project } from '../../types/project';
import { AISettings } from '../../types/ai';
import { AIRunner } from '../../types/sequel';
import {
    ConsistencyCategory,
    ConsistencyIssue,
    ConsistencyReport,
} from '../../types/consistency';
import { buildFactSheet } from './buildFactSheet';
import { scanChapter } from './scanChapter';

export interface ConsistencyScanProgress {
    current: number;
    total: number;
    chapterId: string;
    chapterTitle: string;
}

interface ScanProjectOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
    categories: ConsistencyCategory[];
    /** 対象章ID。未指定なら草案のある全章 */
    targetChapterIds?: string[];
    onProgress?: (progress: ConsistencyScanProgress) => void;
    /** 章単位の失敗通知（スキャンは続行される） */
    onChapterError?: (chapterId: string, error: unknown) => void;
}

const genIssueId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export async function scanProject(
    project: Project,
    options: ScanProjectOptions
): Promise<ConsistencyReport> {
    const { settings, run, signal, categories, targetChapterIds, onProgress, onChapterError } = options;

    const targets = project.chapters.filter(c => {
        if (!(c.draft ?? '').trim()) return false;
        return !targetChapterIds || targetChapterIds.includes(c.id);
    });

    const factSheet = buildFactSheet(project);
    const issues: ConsistencyIssue[] = [];

    for (let i = 0; i < targets.length; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const chapter = targets[i];
        onProgress?.({
            current: i + 1,
            total: targets.length,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
        });

        try {
            const scanned = await scanChapter(chapter, factSheet, categories, {
                settings,
                run,
                signal,
            });
            for (const issue of scanned) {
                issues.push({
                    ...issue,
                    id: genIssueId(),
                    chapterId: chapter.id,
                    chapterTitle: chapter.title,
                    status: 'open',
                });
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            // 個別章の失敗は記録して続行（プロバイダの一時エラーで全章の結果を失わない）
            console.error(`整合性スキャン失敗（章: ${chapter.title}）:`, error);
            onChapterError?.(chapter.id, error);
        }
    }

    return {
        id: genIssueId(),
        createdAt: new Date(),
        targetChapterIds: targets.map(c => c.id),
        categories,
        issues,
    };
}
