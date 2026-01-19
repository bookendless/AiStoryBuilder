/**
 * クラッシュリカバリーサービス
 * 
 * 編集中のデータを定期的にsessionStorageに一時保存し、
 * クラッシュ後のリカバリーを可能にします。
 */

import { Project } from '../contexts/ProjectContext';

// リカバリーデータのキー
const RECOVERY_KEY = 'crash_recovery_data';
const RECOVERY_TIMESTAMP_KEY = 'crash_recovery_timestamp';
const RECOVERY_PROJECT_ID_KEY = 'crash_recovery_project_id';

// リカバリーデータの有効期限（24時間）
const RECOVERY_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// 自動保存間隔（30秒）
const AUTO_SAVE_INTERVAL_MS = 30 * 1000;

// リカバリーデータ
export interface RecoveryData {
    projectId: string;
    projectData: Partial<Project>;
    timestamp: number;
    version: number;
}

// サービスのインスタンス
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let currentProjectGetter: (() => Project | null) | null = null;

/**
 * リカバリーデータを保存
 */
export function saveRecoveryData(project: Project): void {
    if (!project || !project.id) return;

    try {
        const recoveryData: RecoveryData = {
            projectId: project.id,
            projectData: {
                // 重要なデータのみ保存（容量節約）
                id: project.id,
                title: project.title,
                chapters: project.chapters,
                characters: project.characters,
                plot: project.plot,
                synopsis: project.synopsis,
                worldSettings: project.worldSettings,
                foreshadowings: project.foreshadowings,
                glossary: project.glossary,
                updatedAt: project.updatedAt,
            },
            timestamp: Date.now(),
            version: 1,
        };

        // sessionStorageに保存（圧縮なし - sessionStorageは比較的小さい）
        const dataString = JSON.stringify(recoveryData);

        // サイズチェック（sessionStorageは通常5MB程度）
        if (dataString.length > 4 * 1024 * 1024) {
            console.warn('[CrashRecovery] データサイズが大きすぎます。章データのみを保存します。');
            // 章データのみに縮小
            recoveryData.projectData = {
                id: project.id,
                title: project.title,
                chapters: project.chapters,
                updatedAt: project.updatedAt,
            };
        }

        sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveryData));
        sessionStorage.setItem(RECOVERY_TIMESTAMP_KEY, Date.now().toString());
        sessionStorage.setItem(RECOVERY_PROJECT_ID_KEY, project.id);

        console.log('[CrashRecovery] リカバリーデータを保存しました');
    } catch (error) {
        // sessionStorageが一杯の場合はエラーを無視
        console.warn('[CrashRecovery] リカバリーデータの保存に失敗:', error);
    }
}

/**
 * リカバリーデータを取得
 */
export function getRecoveryData(): RecoveryData | null {
    try {
        const dataString = sessionStorage.getItem(RECOVERY_KEY);
        if (!dataString) return null;

        const recoveryData: RecoveryData = JSON.parse(dataString);

        // 有効期限チェック
        if (Date.now() - recoveryData.timestamp > RECOVERY_EXPIRATION_MS) {
            console.log('[CrashRecovery] リカバリーデータは期限切れです');
            clearRecoveryData();
            return null;
        }

        return recoveryData;
    } catch (error) {
        console.error('[CrashRecovery] リカバリーデータの取得に失敗:', error);
        return null;
    }
}

/**
 * リカバリーデータをクリア
 */
export function clearRecoveryData(): void {
    try {
        sessionStorage.removeItem(RECOVERY_KEY);
        sessionStorage.removeItem(RECOVERY_TIMESTAMP_KEY);
        sessionStorage.removeItem(RECOVERY_PROJECT_ID_KEY);
        console.log('[CrashRecovery] リカバリーデータをクリアしました');
    } catch (error) {
        console.warn('[CrashRecovery] リカバリーデータのクリアに失敗:', error);
    }
}

/**
 * リカバリーデータが存在するかチェック
 */
export function hasRecoveryData(): boolean {
    try {
        const dataString = sessionStorage.getItem(RECOVERY_KEY);
        if (!dataString) return false;

        const recoveryData: RecoveryData = JSON.parse(dataString);

        // 有効期限チェック
        if (Date.now() - recoveryData.timestamp > RECOVERY_EXPIRATION_MS) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * リカバリーデータのプロジェクトIDを取得
 */
export function getRecoveryProjectId(): string | null {
    try {
        return sessionStorage.getItem(RECOVERY_PROJECT_ID_KEY);
    } catch {
        return null;
    }
}

/**
 * リカバリーデータのタイムスタンプを取得
 */
export function getRecoveryTimestamp(): Date | null {
    try {
        const timestamp = sessionStorage.getItem(RECOVERY_TIMESTAMP_KEY);
        if (!timestamp) return null;
        return new Date(parseInt(timestamp, 10));
    } catch {
        return null;
    }
}

/**
 * 自動リカバリー保存を開始
 */
export function startAutoRecovery(getProject: () => Project | null): void {
    stopAutoRecovery();

    currentProjectGetter = getProject;

    autoSaveTimer = setInterval(() => {
        if (currentProjectGetter) {
            const project = currentProjectGetter();
            if (project) {
                saveRecoveryData(project);
            }
        }
    }, AUTO_SAVE_INTERVAL_MS);

    console.log('[CrashRecovery] 自動リカバリー保存を開始しました');
}

/**
 * 自動リカバリー保存を停止
 */
export function stopAutoRecovery(): void {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
    currentProjectGetter = null;
    console.log('[CrashRecovery] 自動リカバリー保存を停止しました');
}

/**
 * プロジェクトにリカバリーデータをマージ
 */
export function mergeRecoveryData(
    currentProject: Project,
    recoveryData: RecoveryData
): Project {
    if (!recoveryData.projectData) return currentProject;

    // リカバリーデータのタイムスタンプが新しい場合のみマージ
    const recoveryTime = recoveryData.timestamp;
    const currentTime = currentProject.updatedAt?.getTime() || 0;

    if (recoveryTime <= currentTime) {
        console.log('[CrashRecovery] リカバリーデータは現在のデータより古いためスキップ');
        return currentProject;
    }

    console.log('[CrashRecovery] リカバリーデータをマージします');

    return {
        ...currentProject,
        // リカバリーデータで上書き
        chapters: recoveryData.projectData.chapters || currentProject.chapters,
        characters: recoveryData.projectData.characters || currentProject.characters,
        plot: recoveryData.projectData.plot || currentProject.plot,
        synopsis: recoveryData.projectData.synopsis || currentProject.synopsis,
        worldSettings: recoveryData.projectData.worldSettings || currentProject.worldSettings,
        foreshadowings: recoveryData.projectData.foreshadowings || currentProject.foreshadowings,
        glossary: recoveryData.projectData.glossary || currentProject.glossary,
        updatedAt: new Date(),
    };
}

/**
 * ページアンロード時にリカバリーデータを保存
 */
export function setupBeforeUnloadHandler(getProject: () => Project | null): () => void {
    const handler = () => {
        const project = getProject();
        if (project) {
            saveRecoveryData(project);
        }
    };

    window.addEventListener('beforeunload', handler);

    // クリーンアップ関数を返す
    return () => {
        window.removeEventListener('beforeunload', handler);
    };
}

// デフォルトエクスポート
export default {
    saveRecoveryData,
    getRecoveryData,
    clearRecoveryData,
    hasRecoveryData,
    getRecoveryProjectId,
    getRecoveryTimestamp,
    startAutoRecovery,
    stopAutoRecovery,
    mergeRecoveryData,
    setupBeforeUnloadHandler,
};
