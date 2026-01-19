import React, { useState, useRef } from 'react';
import { Image, Upload, X, Sparkles } from 'lucide-react';
import { Modal } from './common/Modal';
import { useOverlayBackHandler } from '../contexts/BackButtonContext';
import { OptimizedImage } from './OptimizedImage';
import { compressImage } from '../utils/performanceUtils';
import { useToast } from './Toast';
import { useAI } from '../contexts/AIContext';
import { aiService } from '../services/aiService';
import { parseStoryProposal, validateStoryProposal, StoryProposal } from '../utils/storyProposalParser';
import { AILoadingIndicator } from './common/AILoadingIndicator';

interface ImageToStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProposalGenerated: (proposal: StoryProposal) => void;
}

export const ImageToStoryModal: React.FC<ImageToStoryModalProps> = ({
  isOpen,
  onClose,
  onProposalGenerated,
}) => {
  // Android戻るボタン対応
  useOverlayBackHandler(isOpen, onClose, 'image-to-story-modal', 90);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAI();
  const { showError, showSuccess } = useToast();

  // ファイルをBase64に変換
  const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file instanceof File ? file : new File([file], 'image', { type: file.type }));
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // ファイル選択処理
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプとサイズの検証
    if (!file.type.startsWith('image/')) {
      showError('画像ファイルを選択してください。', 5000, {
        title: 'ファイル形式エラー',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB制限
      showError('ファイルサイズは10MB以下にしてください。', 5000, {
        title: 'ファイルサイズエラー',
      });
      return;
    }

    try {
      // 画像を圧縮（1920x1080、quality 0.8）
      const compressedBlob = await compressImage(file, 1920, 1080, 0.8);

      // 圧縮されたBlobをBase64に変換
      const base64 = await fileToBase64(new File([compressedBlob], file.name, { type: file.type }));
      setPreviewUrl(base64);
    } catch (error) {
      console.error('画像の圧縮エラー:', error);
      showError('画像の処理に失敗しました。', 5000, {
        title: '画像処理エラー',
      });
    }
  };

  // ファイル選択ボタンクリック
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // ファイルクリア
  const handleClearFile = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 画像解析と物語生成
  const handleAnalyze = async () => {
    if (!previewUrl) {
      showError('画像を選択してください。', 5000, {
        title: '画像未選択',
      });
      return;
    }

    // AI設定の確認（apiKeysから、またはapiKeyから取得）
    const apiKeyForProvider = settings.provider !== 'local'
      ? (settings.apiKeys?.[settings.provider] || settings.apiKey)
      : '';
    if (!apiKeyForProvider && settings.provider !== 'local') {
      showError('AI設定でAPIキーを設定してください。', 7000, {
        title: 'AI設定エラー',
        details: '画像解析にはAI設定でAPIキーが必要です。設定画面からAPIキーを設定してください。',
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress('画像を分析中...');

    try {
      // プロンプトを構築
      const prompt = aiService.buildPrompt('imageToStory', 'analyze', {});

      // AIサービスにリクエスト
      const response = await aiService.generateContent({
        prompt,
        settings,
        type: 'imageToStory',
        image: previewUrl,
        timeout: 120000, // 2分のタイムアウト
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.content) {
        throw new Error('AIからの応答が空です');
      }

      setAnalysisProgress('物語を生成中...');

      // プロジェクト提案をパース
      const proposal = parseStoryProposal(response.content);

      if (!proposal) {
        throw new Error('プロジェクト提案の解析に失敗しました');
      }

      // バリデーション
      const validation = validateStoryProposal(proposal);
      if (!validation.valid) {
        throw new Error(`プロジェクト提案の検証に失敗しました: ${validation.errors.join(', ')}`);
      }

      showSuccess('物語プロジェクトの提案が生成されました！', 3000);
      onProposalGenerated(proposal);
      onClose();
    } catch (error) {
      console.error('画像解析エラー:', error);
      const errorMessage = error instanceof Error ? error.message : '画像の解析に失敗しました';
      showError(errorMessage, 7000, {
        title: '解析エラー',
        details: '画像の解析中にエラーが発生しました。別の画像を試すか、しばらく待ってから再試行してください。',
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  // モーダルが閉じられたときに状態をリセット
  React.useEffect(() => {
    if (!isOpen) {
      setPreviewUrl(null);
      setIsAnalyzing(false);
      setAnalysisProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
            <Image className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span>画像から物語を作る</span>
        </div>
      }
      size="md"
    >
      <div className="space-y-6">
        {/* 説明 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">
            画像をアップロードすると、AIが画像を分析して物語プロジェクトの提案を生成します。
            <br />
            <span className="text-xs mt-2 block">
              ※ 画像解析にはクラウドAI（OpenAI/Claude/Gemini/Grok）または画像解析対応のローカルLLM（Ollama、LM Studioなど）が必要です。
            </span>
          </p>
        </div>

        {/* 画像アップロードエリア */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            画像を選択
          </label>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isAnalyzing}
            />

            {previewUrl ? (
              <div className="space-y-3">
                <OptimizedImage
                  src={previewUrl}
                  alt="プレビュー"
                  className="w-full h-64 rounded-lg mx-auto"
                  lazy={false}
                  quality={0.8}
                />
                <div className="flex space-x-2 justify-center">
                  <button
                    type="button"
                    onClick={handleSelectFile}
                    disabled={isAnalyzing}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 inline mr-1" />
                    変更
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    disabled={isAnalyzing}
                    className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4 inline mr-1" />
                    削除
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Image className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <button
                    type="button"
                    onClick={handleSelectFile}
                    disabled={isAnalyzing}
                    className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 inline mr-2" />
                    画像を選択
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  JPG, PNG, GIF (最大10MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 解析ボタン */}
        {previewUrl && (
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isAnalyzing}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isAnalyzing ? (
                <>
                  <AILoadingIndicator message={analysisProgress} variant="inline" />
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>物語を生成</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

