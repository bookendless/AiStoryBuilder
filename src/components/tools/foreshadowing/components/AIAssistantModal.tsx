import React from 'react';
import {
  Sparkles,
  AlertCircle,
  Lightbulb,
  Shield,
  Loader2,
} from 'lucide-react';
import { Modal } from '../../../common/Modal';
import { categoryConfig, importanceConfig } from '../config';
import type { AISuggestion } from '../types';

interface AIAssistantModalProps {
  isOpen: boolean;
  isConfigured: boolean;
  isAILoading: boolean;
  aiMode: 'suggest' | 'check';
  setAiMode: (mode: 'suggest' | 'check') => void;
  aiSuggestions: AISuggestion[];
  aiError: string | null;
  setAiError: (error: string | null) => void;
  setAiSuggestions: (suggestions: AISuggestion[]) => void;
  foreshadowingsCount: number;
  onAISuggest: () => void;
  onConsistencyCheck: () => void;
  onAddFromSuggestion: (suggestion: AISuggestion) => void;
  onClose: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  isConfigured,
  isAILoading,
  aiMode,
  setAiMode,
  aiSuggestions,
  aiError,
  setAiError,
  setAiSuggestions,
  foreshadowingsCount,
  onAISuggest,
  onConsistencyCheck,
  onAddFromSuggestion,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              AIアシスタント
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              伏線の提案・整合性チェック
            </p>
          </div>
        </div>
      }
      size="lg"
      className="z-[70]"
    >
      <div className="space-y-6">
        {!isConfigured ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 font-['Noto_Sans_JP']">
                  AI設定が必要です
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1 font-['Noto_Sans_JP']">
                  設定画面でAPIキーを設定してください。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* モード選択 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setAiMode('suggest');
                  setAiSuggestions([]);
                  setAiError(null);
                }}
                className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'suggest'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Lightbulb className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">伏線提案</div>
                <div className="text-xs mt-1 opacity-80">新しい伏線を提案</div>
              </button>
              <button
                onClick={() => {
                  setAiMode('check');
                  setAiSuggestions([]);
                  setAiError(null);
                }}
                className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'check'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Shield className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">整合性チェック</div>
                <div className="text-xs mt-1 opacity-80">伏線の矛盾を検出</div>
              </button>
            </div>

            {/* 伏線提案モード */}
            {aiMode === 'suggest' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                    <strong>伏線提案機能</strong><br />
                    プロジェクトのあらすじや章の内容を分析し、物語を豊かにする伏線を提案します。設置場所と回収場所も含めて提案されます。
                  </p>
                </div>
                <button
                  onClick={onAISuggest}
                  disabled={isAILoading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAILoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-['Noto_Sans_JP']">提案中...</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-5 w-5" />
                      <span className="font-['Noto_Sans_JP']">伏線を提案</span>
                    </>
                  )}
                </button>

                {/* AI提案リスト */}
                {aiSuggestions.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-semibold text-purple-800 dark:text-purple-200 font-['Noto_Sans_JP']">
                      💡 AI提案（{aiSuggestions.length}件）
                    </h5>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {aiSuggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                  {suggestion.title}
                                </span>
                                <span className={`px-2 py-0.5 text-xs text-white rounded-full ${categoryConfig[suggestion.category]?.color || 'bg-gray-500'}`}>
                                  {categoryConfig[suggestion.category]?.label || suggestion.category}
                                </span>
                                <span className={`text-xs ${importanceConfig[suggestion.importance]?.color || 'text-gray-500'}`}>
                                  {importanceConfig[suggestion.importance]?.stars || ''}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                                {suggestion.description}
                              </p>
                              <div className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP'] space-y-1">
                                <p>📍 設置: {suggestion.plantChapter} - {suggestion.plantDescription}</p>
                                <p>🎯 回収: {suggestion.payoffChapter} - {suggestion.payoffDescription}</p>
                                <p>✨ 効果: {suggestion.effect}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => onAddFromSuggestion(suggestion)}
                              className="ml-2 px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP']"
                            >
                              採用
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 整合性チェックモード */}
            {aiMode === 'check' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                    <strong>整合性チェック機能</strong><br />
                    登録されている伏線を分析し、未回収の伏線、矛盾、バランスの問題を検出します。
                  </p>
                </div>
                <button
                  onClick={onConsistencyCheck}
                  disabled={isAILoading || foreshadowingsCount === 0}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAILoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-['Noto_Sans_JP']">チェック中...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      <span className="font-['Noto_Sans_JP']">整合性をチェック</span>
                    </>
                  )}
                </button>
                {foreshadowingsCount === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center font-['Noto_Sans_JP']">
                    伏線が登録されていません。先に伏線を追加してください。
                  </p>
                )}
              </div>
            )}

            {/* AIエラー表示 */}
            {aiError && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">{aiError}</p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
