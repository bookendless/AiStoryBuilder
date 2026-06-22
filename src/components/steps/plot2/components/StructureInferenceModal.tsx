import React from 'react';
import { X, Wand2, Check, AlertTriangle } from 'lucide-react';
import { useOverlayBackHandler } from '../../../../contexts/BackButtonContext';
import { PLOT_STRUCTURE_CONFIGS } from '../constants';
import type { StructureInference } from '../../../../services/plotStructure/inferStructure';

interface StructureInferenceModalProps {
    isOpen: boolean;
    result: StructureInference;
    onClose: () => void;
    onApply: (result: StructureInference) => void;
}

/**
 * AIによる構成推定結果の確認モーダル。
 * 推定された構成・選定理由・各段階の下書きを表示し、ユーザーの確認後にのみ適用する
 * （AI推定は解釈的であり、確認なしの自動適用はしない）。
 */
export const StructureInferenceModal: React.FC<StructureInferenceModalProps> = ({
    isOpen,
    result,
    onClose,
    onApply,
}) => {
    // Android戻るボタン対応
    useOverlayBackHandler(isOpen, onClose, 'structure-inference-modal', 96);

    if (!isOpen) return null;

    const config = PLOT_STRUCTURE_CONFIGS[result.structure];
    const filledCount = config.fields.filter(f => (result.fields[f.key] || '').trim()).length;

    return (
        <div
            className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="glass-strong glass-shimmer rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* ヘッダー */}
                <div className="p-6 border-b border-white/20 dark:border-white/10 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
                                <Wand2 className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                    構成の推定結果
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                    AIが作品情報から構成を推定しました（適用前に内容を確認してください）
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* 推定構成と理由 */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-200 font-['Noto_Sans_JP']">
                            推定構成: {config.label}
                            <span className="ml-2 text-xs font-normal text-purple-600 dark:text-purple-400">
                                （{filledCount} / {config.fields.length} 段階に内容あり）
                            </span>
                        </p>
                        {result.reason && (
                            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1 font-['Noto_Sans_JP']">
                                {result.reason}
                            </p>
                        )}
                    </div>

                    {/* 各段階の下書き */}
                    <div className="space-y-3">
                        {config.fields.map(field => {
                            const value = (result.fields[field.key] || '').trim();
                            return (
                                <div
                                    key={field.key}
                                    className={`rounded-lg border p-3 bg-gradient-to-r ${field.color.bg} ${field.color.border}`}
                                >
                                    <p className={`text-sm font-semibold ${field.color.text} font-['Noto_Sans_JP']`}>
                                        {field.label}
                                    </p>
                                    {value ? (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap font-['Noto_Sans_JP']">
                                            {value}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-['Noto_Sans_JP']">
                                            （作品情報から読み取れなかったため空欄。適用後に手動で記入できます）
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 上書き警告 */}
                    <div className="flex items-start space-x-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                            適用すると、構成の選択と「{config.label}」の各段階の内容が上書きされます。
                            AIの推定は解釈を含むため、適用後も内容を確認・編集してください。
                        </p>
                    </div>
                </div>

                {/* フッター */}
                <div className="p-6 border-t border-white/20 dark:border-white/10 shrink-0">
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/20 transition-colors font-['Noto_Sans_JP']"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={() => {
                                onApply(result);
                                onClose();
                            }}
                            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all font-['Noto_Sans_JP']"
                        >
                            <Check className="h-5 w-5" />
                            <span>この構成を適用</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
