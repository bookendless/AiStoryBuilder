import React, { useState, useRef } from 'react';
import { Mic, Upload, X, Sparkles } from 'lucide-react';
import { Modal } from './common/Modal';
import { useToast } from './Toast';
import { useAI } from '../contexts/AIContext';
import { aiService } from '../services/aiService';
import { parseStoryProposal, validateStoryProposal, StoryProposal } from '../utils/storyProposalParser';
import { AILoadingIndicator } from './common/AILoadingIndicator';

interface AudioToStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProposalGenerated: (proposal: StoryProposal) => void;
}

export const AudioToStoryModal: React.FC<AudioToStoryModalProps> = ({
  isOpen,
  onClose,
  onProposalGenerated,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // ファイル選択処理
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setSelectedFile(file);
  };

  // ファイル選択ボタンクリック
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // ファイルクリア
  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 音声解析と物語生成
  const handleAnalyze = async () => {
    if (!selectedFile) {
      showError('音声ファイルを選択してください。', 5000, {
        title: '音声未選択',
      });
      return;
    }

    // 対応プロバイダーとモデルの確認
    const isGeminiSupported = settings.provider === 'gemini' && settings.model.includes('gemini-3');
    // OpenAIの場合は、GPT-5.1系だけでなく、音声入力に対応しているモデルを広くサポート
    // 実際のモデル名は動的に確認するため、OpenAIプロバイダーの場合は試行を許可
    const isOpenAISupported = settings.provider === 'openai';

    if (!isGeminiSupported && !isOpenAISupported) {
      showError('音声解析にはGemini 3.0 ProまたはOpenAI（GPT-5.1系など）が必要です。AI設定で対応モデルを選択してください。', 7000, {
        title: '対応モデルエラー',
        details: '音声解析機能はGemini 3.0 Pro（gemini-3-pro-preview）またはOpenAI（gpt-5.1、gpt-5.1-mini、gpt-4o、gpt-4-turboなど）に対応しています。',
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress('音声を分析中...');

    try {
      // AI設定の確認（apiKeysから、またはapiKeyから取得）
      const apiKeyForProvider = settings.provider !== 'local' 
        ? (settings.apiKeys?.[settings.provider] || settings.apiKey)
        : '';
      if (!apiKeyForProvider && settings.provider !== 'local') {
        throw new Error('AI設定でAPIキーを設定してください。');
      }

      let transcriptionText = '';
      let prompt = '';

      // OpenAIの場合：Whisper APIで音声をテキストに変換
      if (isOpenAISupported) {
        if (!apiKeyForProvider) {
          throw new Error('OpenAI APIキーが設定されていません');
        }

        setAnalysisProgress('音声をテキストに変換中...');
        
        try {
          // Whisper APIで音声をテキストに変換
          transcriptionText = await aiService.transcribeAudio(selectedFile, apiKeyForProvider);
        } catch (whisperError) {
          // Whisper APIのエラーをそのまま再スロー
          throw whisperError;
        }
        
        if (!transcriptionText || transcriptionText.trim().length === 0) {
          throw new Error('音声の文字起こしに失敗しました');
        }

        setAnalysisProgress('物語を生成中...');

        // 変換されたテキストをプロンプトに含めてOpenAIモデルに送信
        // audioToStory.analyzeプロンプトに文字起こしテキストを含める
        prompt = aiService.buildPrompt('audioToStory', 'analyze', {
          transcription: transcriptionText,
        });

        // AIサービスにリクエスト（テキストのみ）
        const response = await aiService.generateContent({
          prompt,
          settings,
          type: 'audioToStory',
          timeout: 180000, // 3分のタイムアウト
        });

        if (response.error) {
          // モデルが存在しない場合のエラーメッセージを改善
          if (response.error.includes('does not exist') || response.error.includes('not have access')) {
            throw new Error(`選択されたモデル「${settings.model}」にアクセスできません。\n\n【対処法】\n- AI設定で別のモデル（例：gpt-4o、gpt-4-turbo、gpt-4o-mini）を選択してください\n- モデルが利用可能か、APIキーに適切な権限があるか確認してください`);
          }
          throw new Error(response.error);
        }

        if (!response.content) {
          throw new Error('AIからの応答が空です');
        }

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
      } 
      // Gemini 3.0 Proの場合：既存の実装（音声を直接送信）
      else if (isGeminiSupported) {
        // 音声ファイルをBase64に変換
        const audioBase64 = await fileToBase64(selectedFile);

        // MIMEタイプを決定
        let mimeType = 'audio/mpeg';
        if (selectedFile.type) {
          mimeType = selectedFile.type;
        } else if (selectedFile.name.match(/\.wav$/i)) {
          mimeType = 'audio/wav';
        } else if (selectedFile.name.match(/\.m4a$/i)) {
          mimeType = 'audio/mp4';
        }

        // data:形式のURLに変換
        const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
        const audioDataUrl = `data:${mimeType};base64,${base64Data}`;

        // プロンプトを構築
        prompt = aiService.buildPrompt('audioToStory', 'analyze', {});

        // AIサービスにリクエスト
        const response = await aiService.generateContent({
          prompt,
          settings,
          type: 'audioToStory',
          audio: audioDataUrl,
          timeout: 180000, // 3分のタイムアウト（音声解析は時間がかかる可能性がある）
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
      }
    } catch (error) {
      console.error('音声解析エラー:', error);
      
      let errorMessage = '音声の解析に失敗しました';
      let errorDetails = '音声の解析中にエラーが発生しました。別の音声ファイルを試すか、しばらく待ってから再試行してください。';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Whisper API関連のエラー
        if (error.message.includes('Whisper API')) {
          errorDetails = '音声の文字起こし中にエラーが発生しました。\n\n【考えられる原因】\n- APIキーが無効または期限切れ\n- 音声ファイルの形式が対応していない\n- ファイルサイズが大きすぎる（10MB以下推奨）\n- ネットワーク接続の問題\n\n【対処法】\n- AI設定でAPIキーを確認してください\n- 別の音声ファイルを試してください\n- ファイルサイズを確認してください';
        }
        // GPT-5.1関連のエラー
        else if (error.message.includes('OpenAI API') || error.message.includes('GPT')) {
          errorDetails = '物語生成中にエラーが発生しました。\n\n【考えられる原因】\n- APIキーが無効または期限切れ\n- レート制限に達している\n- ネットワーク接続の問題\n\n【対処法】\n- AI設定でAPIキーを確認してください\n- しばらく待ってから再試行してください';
        }
        // 文字起こし関連のエラー
        else if (error.message.includes('文字起こし')) {
          errorDetails = '音声の文字起こしに失敗しました。\n\n【考えられる原因】\n- 音声ファイルに音声が含まれていない\n- 音声ファイルの形式が対応していない\n- ファイルが破損している\n\n【対処法】\n- 別の音声ファイルを試してください\n- ファイル形式を確認してください（MP3、WAV、M4A推奨）';
        }
        // プロジェクト提案関連のエラー
        else if (error.message.includes('プロジェクト提案')) {
          errorDetails = 'プロジェクト提案の生成に失敗しました。\n\n【考えられる原因】\n- AIからの応答が期待される形式と異なる\n- 音声の内容が不十分\n\n【対処法】\n- より明確な内容の音声ファイルを試してください\n- 再試行してください';
        }
        // ネットワークエラー
        else if (error.message.includes('ネットワーク') || error.message.includes('接続')) {
          errorDetails = 'ネットワーク接続に問題があります。\n\n【対処法】\n- インターネット接続を確認してください\n- しばらく待ってから再試行してください';
        }
        // タイムアウトエラー
        else if (error.message.includes('タイムアウト')) {
          errorDetails = '処理がタイムアウトしました。\n\n【考えられる原因】\n- 音声ファイルが大きすぎる\n- ネットワークが遅い\n\n【対処法】\n- より小さい音声ファイルを試してください\n- ネットワーク接続を確認してください';
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
      setSelectedFile(null);
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
          <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
            <Mic className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <span>音声から物語を作る</span>
        </div>
      }
      size="md"
    >
      <div className="space-y-6">
        {/* 説明 */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200 font-['Noto_Sans_JP']">
            音声ファイルをアップロードすると、AIが音声を分析して物語プロジェクトの提案を生成します。
            <br />
            <span className="text-xs mt-2 block">
              ※ 音声解析にはGemini 3.0 ProまたはGPT-5.1系（gpt-5.1、gpt-5.1-mini）が必要です。
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
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/m4a"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isAnalyzing}
            />

            {selectedFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mic className="h-8 w-8 text-purple-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
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
                <Mic className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <button
                    type="button"
                    onClick={handleSelectFile}
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

        {/* 解析ボタン */}
        {selectedFile && (
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
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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

