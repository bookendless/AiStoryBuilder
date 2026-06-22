/**
 * 小説断片インポートウィザードの状態とAIパイプラインを管理するフック
 *
 * - 解析フェーズ: 本文要約 → 全体集約 → 概要抽出 ＋ 本文全体からキャラ抽出（名寄せ）
 * - 中断/再開: sessionStorage に状態を保存し、次回起動時に再開可能
 *
 * 続編構成（useSequelComposer）と同型の AIRunner / AbortController / スナップショット基盤を用いる。
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAI } from '../../../contexts/AIContext';
import { AIRunner } from '../../../types/sequel';
import {
    ImportResult,
    ImportWizardStep,
    ImportWizardSnapshot,
    ImportProgress,
} from '../../../types/import';
import { analyzeProse } from '../../../services/import/analyzeProse';
import { createImportRunner } from '../../../services/import/createImportRunner';

const SNAPSHOT_KEY = 'story-importer-state';
/** スナップショット保存の上限（文字数）。sessionStorage クォータ(~5MB)に対する安全マージン。 */
const SNAPSHOT_MAX_BYTES = 2_000_000;

function loadSnapshot(): ImportWizardSnapshot | null {
    try {
        const raw = sessionStorage.getItem(SNAPSHOT_KEY);
        return raw ? (JSON.parse(raw) as ImportWizardSnapshot) : null;
    } catch {
        return null;
    }
}

export function useStoryImporter() {
    const { settings } = useAI();

    const [step, setStep] = useState<ImportWizardStep>('input');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    // AIランナー（services層をReactから切り離す。分析用システムプロンプトは createImportRunner 内で付与）
    const makeRunner = useCallback((signal: AbortSignal): AIRunner => {
        return createImportRunner(settings, signal);
    }, [settings]);

    // 解析フェーズ実行
    const runAnalysis = useCallback(async (prose: string) => {
        const controller = new AbortController();
        abortRef.current = controller;
        setIsRunning(true);
        setError(null);
        setStep('analyzing');

        try {
            const run = makeRunner(controller.signal);
            const res = await analyzeProse(prose, {
                settings,
                run,
                signal: controller.signal,
                onProgress: setProgress,
            });
            setResult(res);
            setStep('review');
        } catch (err) {
            // AbortErrorはDOMExceptionに限らずname判定で拾う（Tauri WebView等は通常Errorを投げる）
            if ((err as Error)?.name === 'AbortError') {
                setStep('input');
            } else {
                setError(err instanceof Error ? err.message : '解析処理に失敗しました');
                setStep('input');
            }
        } finally {
            setIsRunning(false);
            setProgress(null);
            abortRef.current = null;
        }
    }, [settings, makeRunner]);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setStep('input');
        setResult(null);
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
    const restoreSnapshot = useCallback((snapshot: ImportWizardSnapshot) => {
        setResult(snapshot.result);
        // 解析途中で中断していた場合は入力に戻す。結果があれば確認画面へ。
        const safeStep: ImportWizardStep =
            snapshot.step === 'analyzing'
                ? (snapshot.result ? 'review' : 'input')
                : snapshot.step;
        setStep(safeStep);
    }, []);

    // 編集可能な確認ステップに到達したら sessionStorage に保存
    useEffect(() => {
        if (step !== 'review' && step !== 'finalize') return;
        if (!result) return;

        const snapshot: ImportWizardSnapshot = {
            step,
            result,
            savedAt: Date.now(),
        };
        try {
            const serialized = JSON.stringify(snapshot);
            // 巨大な原文を含む場合 sessionStorage のクォータ(~5MB)を超えるため、
            // 例外で黙って失敗するのではなく、明示的に保存をスキップする（大規模インポートでは再開不可）。
            if (serialized.length > SNAPSHOT_MAX_BYTES) {
                sessionStorage.removeItem(SNAPSHOT_KEY); // 古い小さなスナップショットの誤再開を防ぐ
                return;
            }
            sessionStorage.setItem(SNAPSHOT_KEY, serialized);
        } catch {
            // ストレージ満杯などは無視（次回再開できないだけ）
        }
    }, [step, result]);

    return {
        // state
        step,
        result,
        progress,
        isRunning,
        error,
        // setters
        setStep,
        setResult,
        setError,
        // actions
        runAnalysis,
        cancel,
        reset,
        restoreSnapshot,
    };
}

/** モーダル外から中断状態の有無を確認する */
export function getImportSnapshot(): ImportWizardSnapshot | null {
    return loadSnapshot();
}
