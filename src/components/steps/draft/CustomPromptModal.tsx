import React from 'react';
import { PenTool, X } from 'lucide-react';

interface CustomPromptModalProps {
  isOpen: boolean;
  customPrompt: string;
  useCustomPrompt: boolean;
  onClose: () => void;
  onCustomPromptChange: (value: string) => void;
  onUseCustomPromptChange: (value: boolean) => void;
  onReset: () => void;
}

export const CustomPromptModal: React.FC<CustomPromptModalProps> = ({
  isOpen,
  customPrompt,
  useCustomPrompt,
  onClose,
  onCustomPromptChange,
  onUseCustomPromptChange,
  onReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* オーバーレイ */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* モーダルコンテンツ */}
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          {/* モーダルヘッダー */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 w-8 h-8 rounded-full flex items-center justify-center">
                <PenTool className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  カスタムプロンプト設定
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  執筆スタイルをカスタマイズできます
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* モーダルボディ */}
          <div className="p-6">
            <div className="space-y-6">
              {/* カスタムプロンプト使用の切り替え */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="useCustomPrompt"
                  checked={useCustomPrompt}
                  onChange={(e) => onUseCustomPromptChange(e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="useCustomPrompt"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']"
                >
                  カスタムプロンプトを使用する
                </label>
              </div>

              {/* カスタムプロンプト入力エリア */}
              {useCustomPrompt && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      カスタム執筆指示
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
                      基本のプロンプトに追加したい執筆指示を記述してください。例：「詩的な表現を多用する」「一人称視点で執筆する」「短編小説風の文体にする」など
                    </p>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => onCustomPromptChange(e.target.value)}
                      placeholder={'例：\n• 詩的な表現を多用し、美しい情景描写を心がける\n• 一人称視点で主人公の内面を深く描写する\n• 短編小説風の簡潔で印象的な文体にする\n• 会話は最小限に抑え、心理描写を重視する\n• ミステリー要素を織り交ぜ、読者の興味を引く展開にする'}
                      className="w-full h-40 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-['Noto_Sans_JP'] leading-relaxed"
                      style={{ lineHeight: '1.6' }}
                    />
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    文字数: {customPrompt.length.toLocaleString()}
                  </div>
                </div>
              )}

              {/* プレビューエリア */}
              {useCustomPrompt && customPrompt.trim() && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    プロンプトプレビュー
                  </h4>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] whitespace-pre-wrap">
                      【基本プロンプト】<br />
                      以下の章の情報を基に、会話を重視し、読者に臨場感のある魅力的な小説の章を執筆してください。<br /><br />
                      【章情報・プロジェクト情報・キャラクター情報・執筆指示】<br />
                      （省略）<br /><br />
                      【カスタム執筆指示】<br />
                      {customPrompt}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* モーダルフッター */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              {useCustomPrompt ? 'カスタムプロンプトが有効です' : 'デフォルトプロンプトを使用します'}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={onReset}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
              >
                リセット
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP']"
              >
                保存して閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

