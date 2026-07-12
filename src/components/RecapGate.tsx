import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useAI } from '../contexts/AIContext';
import { useGeneration } from '../contexts/GenerationContext';
import { useOverlayBackHandler } from '../contexts/BackButtonContext';
import { Project } from '../types/project';
import { RecapAIContent, RecapAIState } from '../types/recap';
import { RecapModal } from './RecapModal';
import { computeRecapSignature } from '../services/recap/computeRecapSignature';
import { createRecapRunner } from '../services/recap/createRecapRunner';
import { generateRecap } from '../services/recap/generateRecap';
import {
    loadRecapCache,
    saveRecapCache,
    snoozeRecapToday,
    isRecapSnoozedToday,
} from '../services/recap/recapCache';
import { hasRecapContent, RECAP_GAP_THRESHOLD_MS } from '../services/recap/recapLocal';

/**
 * RecapGate - リキャップの表示判定とAI生成状態を管理するゲート
 *
 * App直下（ProjectProvider配下）に常駐し、プロジェクトが開かれたタイミングで
 * 「前回アクセスからの経過時間」「表示設定」「スヌーズ」「コンテンツ有無」を判定して
 * RecapModal を表示する。AIナレーションはシグネチャ一致のキャッシュがあれば再生成しない。
 */
export const RecapGate: React.FC = () => {
    const { currentProject, getPreviousAccess } = useProject();
    const { settings, isConfigured } = useAI();
    const { startTask, completeTask } = useGeneration();

    const [isOpen, setIsOpen] = useState(false);
    const [daysSince, setDaysSince] = useState<number | null>(null);
    const [aiContent, setAiContent] = useState<RecapAIContent | null>(null);
    const [aiState, setAiState] = useState<RecapAIState>('idle');
    // 同一プロジェクトの表示判定を1回に抑える（updateProjectによるオブジェクト再生成で再発火しない）
    const evaluatedProjectRef = useRef<string | null>(null);

    // 表示判定effectの依存を projectId に絞るため、設定類は ref で最新値を参照する
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const isConfiguredRef = useRef(isConfigured);
    isConfiguredRef.current = isConfigured;

    const runNarrative = useCallback((project: Project) => {
        const signature = computeRecapSignature(project);
        setAiState('running');
        const { id, signal } = startTask({
            key: `${project.id}:recap`,
            label: '「前回までのあらすじ」を生成中',
            step: 'home',
        });
        const run = createRecapRunner(settingsRef.current, signal);
        generateRecap(project, { settings: settingsRef.current, run, signal })
            .then((content) => {
                saveRecapCache({
                    projectId: project.id,
                    signature,
                    generatedAt: Date.now(),
                    content,
                });
                setAiContent(content);
                setAiState('done');
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    setAiState('idle');
                } else {
                    console.error('リキャップ生成エラー:', error);
                    setAiState('error');
                }
            })
            .finally(() => completeTask(id));
    }, [startTask, completeTask]);

    const projectId = currentProject?.id ?? null;

    useEffect(() => {
        if (!projectId || !currentProject) {
            evaluatedProjectRef.current = null;
            setIsOpen(false);
            return;
        }
        if (evaluatedProjectRef.current === projectId) return;
        evaluatedProjectRef.current = projectId;

        const mode = settingsRef.current.recapMode ?? 'gap';
        if (mode === 'off') return;
        if (isRecapSnoozedToday(projectId)) return;
        if (!hasRecapContent(currentProject)) return;

        const previous = getPreviousAccess(projectId);
        if (mode === 'gap' && (!previous || Date.now() - previous.getTime() < RECAP_GAP_THRESHOLD_MS)) {
            return;
        }

        setDaysSince(
            previous ? Math.floor((Date.now() - previous.getTime()) / (24 * 60 * 60 * 1000)) : null
        );

        // シグネチャ一致のキャッシュがあればAI呼び出しなしで表示
        const cache = loadRecapCache(projectId);
        const signature = computeRecapSignature(currentProject);
        if (cache && cache.signature === signature) {
            setAiContent(cache.content);
            setAiState('done');
        } else {
            setAiContent(null);
            if (!isConfiguredRef.current) {
                setAiState('unconfigured');
            } else if (settingsRef.current.recapAutoNarrative === true) {
                runNarrative(currentProject);
            } else {
                setAiState('idle');
            }
        }
        setIsOpen(true);
    }, [projectId, currentProject, getPreviousAccess, runNarrative]);

    const handleClose = useCallback(() => setIsOpen(false), []);
    const handleSnooze = useCallback(() => {
        if (projectId) snoozeRecapToday(projectId);
        setIsOpen(false);
    }, [projectId]);
    const handleGenerate = useCallback(() => {
        if (currentProject) runNarrative(currentProject);
    }, [currentProject, runNarrative]);

    // Android戻るボタン対応
    useOverlayBackHandler(isOpen, handleClose, 'recap-modal', 50);

    if (!currentProject || !isOpen) return null;

    return (
        <RecapModal
            isOpen={isOpen}
            onClose={handleClose}
            project={currentProject}
            daysSince={daysSince}
            aiContent={aiContent}
            aiState={aiState}
            onGenerateNarrative={handleGenerate}
            onSnoozeToday={handleSnooze}
        />
    );
};
