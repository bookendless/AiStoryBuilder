import React, { useState, useRef } from 'react';
import { Mic, Image, Upload, X, Sparkles } from 'lucide-react';
import { Modal } from './common/Modal';
import { OptimizedImage } from './OptimizedImage';
import { compressImage } from '../utils/performanceUtils';
import { useToast } from './Toast';
import { useAI } from '../contexts/AIContext';
import { aiService } from '../services/aiService';
import { parseStoryProposal, validateStoryProposal, StoryProposal } from '../utils/storyProposalParser';
import { AILoadingIndicator } from './common/AILoadingIndicator';

interface AudioImageToStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProposalGenerated: (proposal: StoryProposal) => void;
}

export const AudioImageToStoryModal: React.FC<AudioImageToStoryModalProps> = ({
  isOpen,
  onClose,
  onProposalGenerated,
}) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAI();
  const { showError, showSuccess } = useToast();

  // ファイルをBase64に変換
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // 音声ファイル選択処理
  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプの検証
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];
    if (!validAudioTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a)$/i)) {
      showError('音声ファイルを選択してください（.mp3, .wav, .m4a）。', 5000, {
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

    setAudioFile(file);
  };

  // 画像ファイル選択処理
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setImagePreviewUrl(base64);
      setImageFile(file);
    } catch (error) {
      console.error('画像の圧縮エラー:', error);
      showError('画像の処理に失敗しました。', 5000, {
        title: '画像処理エラー',
      });
    }
  };

  // 音声ファイル選択ボタンクリック
  const handleSelectAudio = () => {
    audioInputRef.current?.click();
  };

  // 画像ファイル選択ボタンクリック
  const handleSelectImage = () => {
    imageInputRef.current?.click();
  };

  // 音声ファイルクリア
  const handleClearAudio = () => {
    setAudioFile(null);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  // 画像ファイルクリア
  const handleClearImage = () => {
    setImagePreviewUrl(null);
    setImageFile(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // 音声と画像解析と物語生成
  const handleAnalyze = async () => {
    if (!audioFile || !imagePreviewUrl) {
      showError('音声ファイルと画像ファイルの両方を選択してください。', 5000, {
        title: 'ファイル未選択',
      });
      return;
    }

    // 対応プロバイダーとモデルの確認（Gemini 3.0 Proのみ）
    const isGeminiSupported = settings.provider === 'gemini' && settings.model.includes('gemini-3');

    if (!isGeminiSupported) {
      showError('音声と画像の同時解析にはGemini 3.0 Proが必要です。AI設定でGemini 3.0 Pro（gemini-3-pro-preview）を選択してください。', 7000, {
        title: '対応モデルエラー',
        details: '音声と画像の同時解析機能はGemini 3.0 Pro（gemini-3-pro-preview）のみに対応しています。',
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress('音声と画像を分析中...');

    try {
      // AI設定の確認（apiKeysから、またはapiKeyから取得）
      const apiKeyForProvider = settings.provider !== 'local' 
        ? (settings.apiKeys?.[settings.provider] || settings.apiKey)
        : '';
      if (!apiKeyForProvider && settings.provider !== 'local') {
        throw new Error('AI設定でAPIキーを設定してください。');
      }

      // 音声ファイルをBase64に変換
      const audioBase64 = await fileToBase64(audioFile);

      // MIMEタイプを決定
      let audioMimeType = 'audio/mpeg';
      if (audioFile.type) {
        audioMimeType = audioFile.type;
      } else if (audioFile.name.match(/\.wav$/i)) {
        audioMimeType = 'audio/wav';
      } else if (audioFile.name.match(/\.m4a$/i)) {
        audioMimeType = 'audio/mp4';
      }

      // data:形式のURLに変換
      const audioBase64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
      const audioDataUrl = `data:${audioMimeType};base64,${audioBase64Data}`;

      // プロンプトを構築
      const prompt = aiService.buildPrompt('audioImageToStory', 'analyze', {});

      // AIサービスにリクエスト（音声と画像の両方を送信）
      const response = await aiService.generateContent({
        prompt,
        settings,
        type: 'audioImageToStory',
        image: imagePreviewUrl,
        audio: audioDataUrl,
        timeout: 180000, // 3分のタイムアウト（音声と画像の解析は時間がかかる可能性がある）
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
      console.error('音声と画像解析エラー:', error);
      
      let errorMessage = '音声と画像の解析に失敗しました';
      let errorDetails = '音声と画像の解析中にエラーが発生しました。別のファイルを試すか、しばらく待ってから再試行してください。';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // プロジェクト提案関連のエラー
        if (error.message.includes('プロジェクト提案')) {
          errorDetails = 'プロジェクト提案の生成に失敗しました。\n\n【考えられる原因】\n- AIからの応答が期待される形式と異なる\n- 音声や画像の内容が不十分\n\n【対処法】\n- より明確な内容のファイルを試してください\n- 再試行してください';
        }
        // ネットワークエラー
        else if (error.message.includes('ネットワーク') || error.message.includes('接続')) {
          errorDetails = 'ネットワーク接続に問題があります。\n\n【対処法】\n- インターネット接続を確認してください\n- しばらく待ってから再試行してください';
        }
        // タイムアウトエラー
        else if (error.message.includes('タイムアウト')) {
          errorDetails = '処理がタイムアウトしました。\n\n【考えられる原因】\n- ファイルが大きすぎる\n- ネットワークが遅い\n\n【対処法】\n- より小さいファイルを試してください\n- ネットワーク接続を確認してください';
        }
      }
      
      showError(errorMessage, 10000, {
        title: '解析エラー',
        details: errorDetails,
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  // モーダルが閉じられたときに状態をリセット
  React.useEffect(() => {
    if (!isOpen) {
      setAudioFile(null);
      setImagePreviewUrl(null);
      setImageFile(null);
      setIsAnalyzing(false);
      setAnalysisProgress('');
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
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
          <div className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 p-2 rounded-lg">
            <div className="flex items-center space-x-1">
              <Mic className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <Image className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <span>音声と画像から物語を作る</span>
        </div>
      }
      size="md"
    >
      <div className="space-y-6">
        {/* 説明 */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200 font-['Noto_Sans_JP']">
            音声ファイルと画像ファイルの両方をアップロードすると、AIが音声と画像を統合的に分析して物語プロジェクトの提案を生成します。
            <br />
            <span className="text-xs mt-2 block">
              ※ 音声と画像の同時解析にはGemini 3.0 Pro（gemini-3-pro-preview）が必要です。
            </span>
          </p>
        </div>

        {/* 音声ファイルアップロードエリア */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            音声ファイルを選択
          </label>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/m4a"
              onChange={handleAudioSelect}
              className="hidden"
              disabled={isAnalyzing}
            />

            {audioFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mic className="h-8 w-8 text-purple-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {audioFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2 justify-center">
                  <button
                    type="button"
                    onClick={handleSelectAudio}
                    disabled={isAnalyzing}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 inline mr-1" />
                    変更
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAudio}
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
                <Mic className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <button
                    type="button"
                    onClick={handleSelectAudio}
                    disabled={isAnalyzing}
                    className="px-4 py-2 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 inline mr-2" />
                    音声ファイルを選択
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  MP3, WAV, M4A (最大10MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 画像ファイルアップロードエリア */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
            画像を選択
          </label>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isAnalyzing}
            />

            {imagePreviewUrl ? (
              <div className="space-y-3">
                <OptimizedImage
                  src={imagePreviewUrl}
                  alt="プレビュー"
                  className="w-full h-64 rounded-lg mx-auto"
                  lazy={false}
                  quality={0.8}
                />
                <div className="flex space-x-2 justify-center">
                  <button
                    type="button"
                    onClick={handleSelectImage}
                    disabled={isAnalyzing}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 inline mr-1" />
                    変更
                  </button>
                  <button
                    type="button"
                    onClick={handleClearImage}
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
                    onClick={handleSelectImage}
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
        {audioFile && imagePreviewUrl && (
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
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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


