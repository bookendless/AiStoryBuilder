/**
 * 続編構成ウィザードの状態とAIパイプラインを管理するフック
 *
 * - 抽出フェーズ: 章要約 → 全体集約 → 要素抽出
 * - 生成フェーズ: 続編のあらすじ・プロット・更新キャラ生成
 * - 中断/再開: sessionStorage に状態を保存し、次回起動時に再開可能
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAI } from '../../../contexts/AIContext';
import { aiService } from '../../../services/aiService';
import { Project } from '../../../types/project';
import {
    SequelExtraction,
    SequelElements,
    SequelWizardStep,
    SequelWizardSnapshot,
    SequelProgress,
    AIRunner,
} from '../../../types/sequel';
import { summarizeChapters } from '../../../services/summarization/summarizeChapters';
import { aggregateStory } from '../../../services/summarization/aggregateStory';
import { extractElements, generateSequelElements } from '../../../services/summarization/extractElements';

const SNAPSHOT_KEY = 'sequel-wizard-state';

function loadSnapshot(): SequelWizardSnapshot | null {
    try {
        const raw = sessionStorage.getItem(SNAPSHOT_KEY);
        return raw ? (JSON.parse(raw) as SequelWizardSnapshot) : null;
    } catch {
        return null;
    }
}

export function useSequelComposer() {
    const { settings } = useAI();

    const [step, setStep] = useState<SequelWizardStep>('select');
    const [sourceProjectId, setSourceProjectId] = useState<string | null>(null);
    const [isDetailedMode, setIsDetailedMode] = useState(false);
    const [extraction, setExtraction] = useState<SequelExtraction | null>(null);
    const [elements, setElements] = useState<SequelElements | null>(null);
    const [progress, setProgress] = useState<SequelProgress | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    // AIランナー（services層をReactから切り離す）
    const makeRunner = useCallback((signal: AbortSignal): AIRunner => {
        return async (prompt, opts) => {
            const response = await aiService.generateContent({
                prompt,
                type: 'synopsis',
                settings: {
                    ...settings,
                    temperature: opts?.temperature ?? settings.temperature,
                },
                signal: opts?.signal ?? signal,
                timeout: opts?.timeout ?? 180000,
                maxPromptLength: opts?.maxPromptLength,
            });
            // generateContent はエラー時に content='' / error=メッセージ を返す。
            // 黙って空文字を流すと抽出結果が空になるため、明示的に例外化してパイプラインを止める。
            if (response.error || !response.content?.trim()) {
                throw new Error(response.error || 'AIの応答が空でした');
            }
            return response.content;
        };
    }, [settings]);

    // 抽出フェーズ実行
    const runExtraction = useCallback(async (project: Project) => {
        const controller = new AbortController();
        abortRef.current = controller;
        setIsRunning(true);
        setError(null);
        setStep('extracting');

        try {
            const run = makeRunner(controller.signal);

            const digests = await summarizeChapters(project.chapters, {
                detailed: isDetailedMode,
                settings,
                run,
                signal: controller.signal,
                onProgress: setProgress,
            });

            const storyDigest = await aggregateStory(digests, {
                settings,
                run,
                signal: controller.signal,
                onProgress: setProgress,
            });

            setProgress({ phase: '要素の抽出', current: 1, total: 1 });
            const result = await extractElements(project, storyDigest, {
                run,
                signal: controller.signal,
            });

            setExtraction(result);
            setStep('reviewExtract');
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                setStep('select');
            } else {
                setError(err instanceof Error ? err.message : '抽出処理に失敗しました');
                setStep('select');
            }
        } finally {
            setIsRunning(false);
            setProgress(null);
            abortRef.current = null;
        }
    }, [isDetailedMode, settings, makeRunner]);

    // 生成フェーズ実行
    const runGeneration = useCallback(async (project: Project, editedExtraction: SequelExtraction) => {
        const controller = new AbortController();
        abortRef.current = controller;
        setIsRunning(true);
        setError(null);
        setStep('extracting');

        try {
            const run = makeRunner(controller.signal);
            setProgress({ phase: '続編要素の生成', current: 1, total: 1 });

            const result = await generateSequelElements(project, editedExtraction, {
                run,
                signal: controller.signal,
            });

            setElements(result);
            setStep('reviewSequel');
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                setStep('reviewExtract');
            } else {
                setError(err instanceof Error ? err.message : '続編要素の生成に失敗しました');
                setStep('reviewExtract');
            }
        } finally {
            setIsRunning(false);
            setProgress(null);
            abortRef.current = null;
        }
    }, [makeRunner]);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setStep('select');
        setSourceProjectId(null);
        setIsDetailedMode(false);
        setExtraction(null);
        setElements(null);
        setProgress(null);
        setIsRunning(false);
        setError(null);
        try {
            sessionStorage.removeItem(SNAPSHOT_KEY);
        } catch {
            // ignore
        }
    }, []);

    // 中断状態の復元
    const restoreSnapshot = useCallback((snapshot: SequelWizardSnapshot) => {
        setSourceProjectId(snapshot.sourceProjectId);
        setIsDetailedMode(snapshot.isDetailedMode);
        setExtraction(snapshot.extraction);
        setElements(snapshot.elements);
        // 進行中のフェーズで中断していた場合は、直前の確認画面に戻す
        const safeStep: SequelWizardStep =
            snapshot.step === 'extracting'
                ? (snapshot.extraction ? 'reviewExtract' : 'select')
                : snapshot.step;
        setStep(safeStep);
    }, []);

    // 編集可能な確認ステップに到達したら sessionStorage に保存
    useEffect(() => {
        if (!sourceProjectId) return;
        if (step !== 'reviewExtract' && step !== 'reviewSequel' && step !== 'finalize') return;

        const snapshot: SequelWizardSnapshot = {
            sourceProjectId,
            isDetailedMode,
            step,
            extraction,
            elements,
            savedAt: Date.now(),
        };
        try {
            sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
        } catch {
            // ストレージ満杯などは無視（次回再開できないだけ）
        }
    }, [step, sourceProjectId, isDetailedMode, extraction, elements]);

    return {
        // state
        step,
        sourceProjectId,
        isDetailedMode,
        extraction,
        elements,
        progress,
        isRunning,
        error,
        // setters
        setStep,
        setSourceProjectId,
        setIsDetailedMode,
        setExtraction,
        setElements,
        setError,
        // actions
        runExtraction,
        runGeneration,
        cancel,
        reset,
        restoreSnapshot,
    };
}

/** モーダル外から中断状態の有無を確認する */
export function getSequelSnapshot(): SequelWizardSnapshot | null {
    return loadSnapshot();
}
