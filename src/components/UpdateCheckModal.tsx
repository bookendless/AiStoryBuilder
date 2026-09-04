import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { Modal } from './common/Modal';
import { isTauriEnvironment } from '../utils/platformUtils';
import { getUserFriendlyError } from '../utils/errorHandler';

/**
 * アップデート確認モーダル
 *
 * 通信するのは利用者がこのモーダルで「アップデートを確認」を押したときだけ。
 * 起動時の自動確認は行わない（プライバシーポリシーで自動通信をしないと明示しているため）。
 */

// 静的importを避けるため、型だけを動的importの戻り値から取り出す
type UpdateInfo = NonNullable<
    Awaited<ReturnType<typeof import('@tauri-apps/plugin-updater').check>>
>;

const toErrorInfo = (error: unknown): { message: string; solution: string } => {
    const info = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
    return { message: info.message, solution: info.solution };
};

type Phase = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'installed' | 'error';

interface UpdateCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpdateCheckModal: React.FC<UpdateCheckModalProps> = ({ isOpen, onClose }) => {
    const [phase, setPhase] = useState<Phase>('idle');
    const [currentVersion, setCurrentVersion] = useState<string>('');
    const [update, setUpdate] = useState<UpdateInfo | null>(null);
    const [errorInfo, setErrorInfo] = useState<{ message: string; solution: string } | null>(null);
    const [downloaded, setDownloaded] = useState(0);
    const [totalBytes, setTotalBytes] = useState(0);

    // 現在のバージョンは開いた時点で表示する（通信は発生しない）
    useEffect(() => {
        if (!isOpen || !isTauriEnvironment()) return;
        let cancelled = false;
        void (async () => {
            try {
                const { getVersion } = await import('@tauri-apps/api/app');
                const version = await getVersion();
                if (!cancelled) setCurrentVersion(version);
            } catch {
                // バージョンが取れなくても確認操作自体は行えるため、無視する
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    // 閉じたら状態を戻す（ダウンロード完了後だけは再起動待ちなので保持する）
    useEffect(() => {
        if (isOpen) return;
        setPhase((prev) => (prev === 'installed' ? prev : 'idle'));
    }, [isOpen]);

    const handleCheck = useCallback(async () => {
        setPhase('checking');
        setErrorInfo(null);
        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const result = await check();
            if (result) {
                setUpdate(result);
                setPhase('available');
            } else {
                setPhase('latest');
            }
        } catch (error) {
            setErrorInfo(toErrorInfo(error));
            setPhase('error');
        }
    }, []);

    const handleInstall = useCallback(async () => {
        if (!update) return;
        setPhase('downloading');
        setDownloaded(0);
        setTotalBytes(0);
        try {
            await update.downloadAndInstall((event) => {
                if (event.event === 'Started') {
                    setTotalBytes(event.data.contentLength ?? 0);
                } else if (event.event === 'Progress') {
                    setDownloaded((prev) => prev + event.data.chunkLength);
                }
            });
            setPhase('installed');
        } catch (error) {
            setErrorInfo(toErrorInfo(error));
            setPhase('error');
        }
    }, [update]);

    const handleRelaunch = useCallback(async () => {
        try {
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (error) {
            setErrorInfo(toErrorInfo(error));
            setPhase('error');
        }
    }, []);

    const progressPercent =
        totalBytes > 0 ? Math.min(100, Math.round((downloaded / totalBytes) * 100)) : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="アップデート" size="md">
            <div className="space-y-4 font-['Noto_Sans_JP']">
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-usuzumi-50 dark:bg-sumi-800 border border-usuzumi-200 dark:border-usuzumi-700">
                    <span className="text-sm text-sumi-600 dark:text-usuzumi-400">
                        現在のバージョン
                    </span>
                    <span className="text-sm font-bold text-sumi-800 dark:text-usuzumi-200">
                        {currentVersion || '—'}
                    </span>
                </div>

                {phase === 'idle' && (
                    <p className="text-sm text-sumi-600 dark:text-usuzumi-400">
                        最新版が出ているかを確認します。確認したときだけ通信し、それ以外にアプリが自動で外部へ接続することはありません。
                    </p>
                )}

                {phase === 'checking' && (
                    <div className="flex items-center gap-2 text-sm text-sumi-600 dark:text-usuzumi-400">
                        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                        確認しています…
                    </div>
                )}

                {phase === 'latest' && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-wakagusa-50 dark:bg-wakagusa-900/20 border border-wakagusa-200 dark:border-wakagusa-800">
                        <CheckCircle2 className="h-4 w-4 text-wakagusa-600 dark:text-wakagusa-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="text-sm text-wakagusa-800 dark:text-wakagusa-300">
                            お使いのバージョンは最新です。
                        </p>
                    </div>
                )}

                {phase === 'available' && update && (
                    <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-ai-50 dark:bg-ai-900/20 border border-ai-200 dark:border-ai-800">
                            <ArrowUpCircle className="h-4 w-4 text-ai-600 dark:text-ai-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="text-sm text-ai-800 dark:text-ai-300">
                                新しいバージョン <strong>{update.version}</strong> が公開されています。
                            </p>
                        </div>
                        {update.body && (
                            <div className="max-h-48 overflow-y-auto p-3 rounded-lg bg-usuzumi-50 dark:bg-sumi-800 border border-usuzumi-200 dark:border-usuzumi-700">
                                <p className="text-xs whitespace-pre-wrap text-sumi-700 dark:text-usuzumi-300">
                                    {update.body}
                                </p>
                            </div>
                        )}
                        <p className="text-xs text-sumi-500 dark:text-usuzumi-500">
                            更新中にアプリが一度終了します。書きかけの内容は保存してから実行してください。
                        </p>
                    </div>
                )}

                {phase === 'downloading' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-sumi-600 dark:text-usuzumi-400">
                            <Download className="h-4 w-4 animate-pulse" aria-hidden="true" />
                            ダウンロードしています…
                        </div>
                        <div
                            className="h-2 w-full rounded-full bg-usuzumi-200 dark:bg-usuzumi-700 overflow-hidden"
                            role="progressbar"
                            aria-valuenow={progressPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className="h-full bg-ai-500 transition-all duration-200"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-xs text-sumi-500 dark:text-usuzumi-500 tabular-nums">
                            {totalBytes > 0 ? `${progressPercent}%` : '準備しています…'}
                        </p>
                    </div>
                )}

                {phase === 'installed' && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-wakagusa-50 dark:bg-wakagusa-900/20 border border-wakagusa-200 dark:border-wakagusa-800">
                        <CheckCircle2 className="h-4 w-4 text-wakagusa-600 dark:text-wakagusa-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="text-sm text-wakagusa-800 dark:text-wakagusa-300">
                            インストールが完了しました。アプリを再起動すると新しいバージョンになります。
                        </p>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="text-sm text-red-700 dark:text-red-300">
                            <p>{errorInfo?.message || 'アップデートの処理に失敗しました。'}</p>
                            {errorInfo?.solution && (
                                <p className="mt-1 text-xs">{errorInfo.solution}</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-sumi-700 dark:text-usuzumi-300 hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500"
                    >
                        閉じる
                    </button>

                    {phase === 'installed' ? (
                        <button
                            onClick={() => void handleRelaunch()}
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-wakagusa-600 hover:bg-wakagusa-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-wakagusa-500"
                        >
                            再起動する
                        </button>
                    ) : phase === 'available' ? (
                        <button
                            onClick={() => void handleInstall()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-ai-600 hover:bg-ai-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500"
                        >
                            <Download className="h-4 w-4" aria-hidden="true" />
                            更新する
                        </button>
                    ) : (
                        <button
                            onClick={() => void handleCheck()}
                            disabled={phase === 'checking' || phase === 'downloading'}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-ai-600 hover:bg-ai-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors focus:outline-none focus:ring-2 focus:ring-ai-500"
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            アップデートを確認
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
