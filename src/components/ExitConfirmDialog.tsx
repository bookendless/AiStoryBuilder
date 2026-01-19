import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ExitConfirmDialogProps {
    /** ダイアログが開いているか */
    isOpen: boolean;
    /** キャンセルボタン押下時のコールバック */
    onCancel: () => void;
    /** 終了ボタン押下時のコールバック */
    onConfirm: () => void;
}

/**
 * アプリ終了確認ダイアログ
 * Android戻るボタンでアプリを終了しようとした際に表示される
 */
export const ExitConfirmDialog: React.FC<ExitConfirmDialogProps> = ({
    isOpen,
    onCancel,
    onConfirm,
}) => {
    if (!isOpen) return null;

    return (
        <>
            {/* バックドロップ */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-fadeIn"
                onClick={onCancel}
                aria-hidden="true"
            />

            {/* ダイアログ本体 */}
            <div
                className="fixed inset-0 flex items-center justify-center z-[101] p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="exit-confirm-title"
                aria-describedby="exit-confirm-description"
            >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full animate-scaleIn overflow-hidden">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30">
                                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h2
                                id="exit-confirm-title"
                                className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']"
                            >
                                終了確認
                            </h2>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            aria-label="閉じる"
                        >
                            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* コンテンツ */}
                    <div className="p-6">
                        <p
                            id="exit-confirm-description"
                            className="text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP'] text-center"
                        >
                            アプリを終了しますか？
                            <br />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                未保存のデータがある場合は保存されません
                            </span>
                        </p>
                    </div>

                    {/* ボタン */}
                    <div className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-800/50">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium font-['Noto_Sans_JP'] hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium font-['Noto_Sans_JP'] hover:from-red-600 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                            終了する
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
