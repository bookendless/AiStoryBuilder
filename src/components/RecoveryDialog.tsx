/**
 * クラッシュリカバリーダイアログ
 * 
 * アプリ起動時に未保存データが検出された場合に表示され、
 * ユーザーにデータ復元の選択肢を提供します。
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, RotateCcw, Trash2, Clock, FileText, X } from 'lucide-react';
import {
    getRecoveryData,
    clearRecoveryData,
    RecoveryData,
} from '../services/crashRecoveryService';

interface RecoveryDialogProps {
    /** ダイアログを表示するかどうか */
    isOpen: boolean;
    /** 復元時のコールバック */
    onRecover: (data: RecoveryData) => void;
    /** 破棄時のコールバック */
    onDiscard: () => void;
    /** ダイアログを閉じるコールバック */
    onClose: () => void;
}

/**
 * リカバリーダイアログコンポーネント
 */
export const RecoveryDialog: React.FC<RecoveryDialogProps> = ({
    isOpen,
    onRecover,
    onDiscard,
    onClose,
}) => {
    const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
    const [isRecovering, setIsRecovering] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const data = getRecoveryData();
            setRecoveryData(data);
        }
    }, [isOpen]);

    if (!isOpen || !recoveryData) return null;

    const handleRecover = () => {
        setIsRecovering(true);
        try {
            onRecover(recoveryData);
            clearRecoveryData();
            onClose();
        } finally {
            setIsRecovering(false);
        }
    };

    const handleDiscard = () => {
        clearRecoveryData();
        onDiscard();
        onClose();
    };

    // 時間をフォーマット
    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // 経過時間を計算
    const getElapsedTime = (timestamp: number): string => {
        const elapsed = Date.now() - timestamp;
        const minutes = Math.floor(elapsed / 60000);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}時間${minutes % 60}分前`;
        }
        return `${minutes}分前`;
    };

    // 章数をカウント
    const chapterCount = recoveryData.projectData.chapters?.length || 0;
    const characterCount = recoveryData.projectData.characters?.length || 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-dialog-title"
        >
            <div className="bg-white dark:bg-sumi-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h2
                            id="recovery-dialog-title"
                            className="text-lg font-bold text-white font-['Noto_Sans_JP']"
                        >
                            未保存データを検出しました
                        </h2>
                        <p className="text-white/80 text-sm">
                            前回のセッションからデータを復元できます
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                        aria-label="閉じる"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-6 space-y-4">
                    {/* リカバリーデータ情報 */}
                    <div className="bg-sumi-50 dark:bg-sumi-900 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sumi-600 dark:text-usuzumi-300">
                            <FileText className="w-4 h-4" />
                            <span className="font-medium">
                                {recoveryData.projectData.title || '無題のプロジェクト'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 text-sumi-500 dark:text-usuzumi-400 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>
                                {formatTime(recoveryData.timestamp)}
                                <span className="ml-2 text-sumi-400">
                                    ({getElapsedTime(recoveryData.timestamp)})
                                </span>
                            </span>
                        </div>

                        <div className="flex gap-4 text-sm text-sumi-500 dark:text-usuzumi-400">
                            <span>章: {chapterCount}件</span>
                            <span>キャラクター: {characterCount}人</span>
                        </div>
                    </div>

                    {/* 説明 */}
                    <p className="text-sm text-sumi-600 dark:text-usuzumi-300">
                        データを復元すると、現在のプロジェクトにリカバリーデータがマージされます。
                        破棄を選択すると、リカバリーデータは完全に削除されます。
                    </p>
                </div>

                {/* アクション */}
                <div className="p-4 bg-sumi-50 dark:bg-sumi-900 flex gap-3">
                    <button
                        onClick={handleDiscard}
                        className="flex-1 px-4 py-3 rounded-lg border border-sumi-300 dark:border-sumi-600 
                       text-sumi-700 dark:text-usuzumi-200 hover:bg-sumi-100 dark:hover:bg-sumi-800 
                       transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        破棄する
                    </button>
                    <button
                        onClick={handleRecover}
                        disabled={isRecovering}
                        className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-ai-500 to-ai-600 
                       text-white hover:from-ai-600 hover:to-ai-700 
                       transition-colors flex items-center justify-center gap-2 font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RotateCcw className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
                        {isRecovering ? '復元中...' : '復元する'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecoveryDialog;
