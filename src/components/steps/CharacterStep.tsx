import React, { useState, useRef } from 'react';
import { Plus, User, Sparkles, Edit3, Trash2, Loader, Upload, X, FileImage, GripVertical, ZoomIn } from 'lucide-react';
import { useProject, Character } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';

// 画像拡大表示モーダルコンポーネント
interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  characterName: string;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  characterName
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-2"
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={imageUrl}
          alt={characterName}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-pointer"
          onDoubleClick={onClose}
        />
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <p className="text-white text-lg font-semibold bg-black bg-opacity-50 rounded-lg px-4 py-2 font-['Noto_Sans_JP']">
            {characterName}
          </p>
        </div>
      </div>
    </div>
  );
};

// キャラクター入力モーダルコンポーネント
interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (character: Character) => void;
  editingCharacter?: Character | null;
  onUpdate?: (character: Character) => void;
}

const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingCharacter,
  onUpdate
}) => {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    appearance: '',
    personality: '',
    background: '',
    image: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // モーダルが開かれた時にフォームデータを初期化
  React.useEffect(() => {
    if (isOpen) {
      if (editingCharacter) {
        setFormData({
          name: editingCharacter.name,
          role: editingCharacter.role,
          appearance: editingCharacter.appearance,
          personality: editingCharacter.personality,
          background: editingCharacter.background,
          image: editingCharacter.image || '',
        });
        setPreviewUrl(editingCharacter.image || '');
      } else {
        setFormData({ name: '', role: '', appearance: '', personality: '', background: '', image: '' });
        setPreviewUrl('');
      }
      setSelectedFile(null);
    }
  }, [isOpen, editingCharacter]);

  // ファイルをBase64に変換する関数
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // ファイル選択ハンドラー
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルタイプの検証
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    // ファイルサイズの検証（5MB制限）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('ファイルサイズが大きすぎます。5MB以下の画像を選択してください。');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      const base64 = await fileToBase64(file);
      setPreviewUrl(base64);
      setFormData(prev => ({ ...prev, image: base64 }));
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      alert('ファイルの読み込みに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  // ファイル選択ダイアログを開く
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // ファイルをクリア
  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setFormData(prev => ({ ...prev, image: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 画像拡大表示を開く
  const handleOpenImageViewer = () => {
    if (previewUrl) {
      setIsImageViewerOpen(true);
    }
  };

  // フォーム送信
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const character: Character = {
      id: editingCharacter?.id || Date.now().toString(),
      name: formData.name.trim(),
      role: formData.role.trim(),
      appearance: formData.appearance.trim(),
      personality: formData.personality.trim(),
      background: formData.background.trim(),
      image: formData.image,
    };

    if (editingCharacter && onUpdate) {
      onUpdate(character);
    } else {
      onSubmit(character);
    }

    // フォームをリセット
    setFormData({ name: '', role: '', appearance: '', personality: '', background: '', image: '' });
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // キャンセル
  const handleCancel = () => {
    setFormData({ name: '', role: '', appearance: '', personality: '', background: '', image: '' });
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleCancel}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              {editingCharacter ? 'キャラクターを編集' : '新しいキャラクター'}
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
      </div>

          <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        名前 *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="キャラクターの名前"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        役割・立場
                      </label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        placeholder="主人公、ヒロイン、悪役など"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        外見・特徴
                      </label>
                      <div className="relative">
                        <textarea
                          value={formData.appearance}
                          onChange={(e) => {
                            const value = e.target.value;
                            const truncatedValue = value.length > 200 ? value.substring(0, 200) : value;
                            setFormData({ ...formData, appearance: truncatedValue });
                          }}
                          placeholder="キャラクターの外見や特徴を簡潔に（150文字程度推奨）"
                          rows={3}
                          className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] ${
                            formData.appearance.length > 150 
                              ? 'border-yellow-300 dark:border-yellow-600' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                        <div className="absolute bottom-2 right-2 text-xs">
                          <span className={`font-['Noto_Sans_JP'] ${
                            formData.appearance.length > 200 
                              ? 'text-red-500' 
                              : formData.appearance.length > 150 
                                ? 'text-yellow-500' 
                                : 'text-gray-400'
                          }`}>
                            {formData.appearance.length}/200
                          </span>
                        </div>
                      </div>
                      {formData.appearance.length > 150 && formData.appearance.length <= 200 && (
                        <p className="text-xs text-yellow-600 mt-1 font-['Noto_Sans_JP']">
                          文字数が多めです（150文字程度推奨）
                        </p>
                      )}
                      {formData.appearance.length > 200 && (
                        <p className="text-xs text-red-500 mt-1 font-['Noto_Sans_JP']">
                          200文字を超えたため切り捨てられました
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        性格
                      </label>
                      <div className="relative">
                        <textarea
                          value={formData.personality}
                          onChange={(e) => {
                            const value = e.target.value;
                            const truncatedValue = value.length > 200 ? value.substring(0, 200) : value;
                            setFormData({ ...formData, personality: truncatedValue });
                          }}
                          placeholder="キャラクターの性格や特徴を簡潔に（150文字程度推奨）"
                          rows={3}
                          className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] ${
                            formData.personality.length > 150 
                              ? 'border-yellow-300 dark:border-yellow-600' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                        <div className="absolute bottom-2 right-2 text-xs">
                          <span className={`font-['Noto_Sans_JP'] ${
                            formData.personality.length > 200 
                              ? 'text-red-500' 
                              : formData.personality.length > 150 
                                ? 'text-yellow-500' 
                                : 'text-gray-400'
                          }`}>
                            {formData.personality.length}/200
                          </span>
                        </div>
                      </div>
                      {formData.personality.length > 150 && formData.personality.length <= 200 && (
                        <p className="text-xs text-yellow-600 mt-1 font-['Noto_Sans_JP']">
                          文字数が多めです（150文字程度推奨）
                        </p>
                      )}
                      {formData.personality.length > 200 && (
                        <p className="text-xs text-red-500 mt-1 font-['Noto_Sans_JP']">
                          200文字を超えたため切り捨てられました
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        背景・過去
                      </label>
                      <div className="relative">
                        <textarea
                          value={formData.background}
                          onChange={(e) => {
                            const value = e.target.value;
                            const truncatedValue = value.length > 200 ? value.substring(0, 200) : value;
                            setFormData({ ...formData, background: truncatedValue });
                          }}
                          placeholder="キャラクターの背景や過去について（150文字程度推奨）"
                          rows={3}
                          className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] ${
                            formData.background.length > 150 
                              ? 'border-yellow-300 dark:border-yellow-600' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                        <div className="absolute bottom-2 right-2 text-xs">
                          <span className={`font-['Noto_Sans_JP'] ${
                            formData.background.length > 200 
                              ? 'text-red-500' 
                              : formData.background.length > 150 
                                ? 'text-yellow-500' 
                                : 'text-gray-400'
                          }`}>
                            {formData.background.length}/200
                          </span>
                        </div>
                      </div>
                      {formData.background.length > 150 && formData.background.length <= 200 && (
                        <p className="text-xs text-yellow-600 mt-1 font-['Noto_Sans_JP']">
                          文字数が多めです（150文字程度推奨）
                        </p>
                      )}
                      {formData.background.length > 200 && (
                        <p className="text-xs text-red-500 mt-1 font-['Noto_Sans_JP']">
                          200文字を超えたため切り捨てられました
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        キャラクター画像
                      </label>
                      
                      {/* ファイル選択エリア */}
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={handleSelectFile}
                          disabled={isUploading}
                          className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-center">
                            {isUploading ? (
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                            ) : (
                              <Upload className="h-6 w-6 text-gray-400 group-hover:text-indigo-500 mx-auto mb-2" />
                            )}
                            <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-indigo-500 font-['Noto_Sans_JP']">
                              {isUploading ? '読み込み中...' : '画像を選択'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-['Noto_Sans_JP']">
                              JPG, PNG, GIF, WebP (最大5MB)
                            </p>
                          </div>
                        </button>
                        
                        {/* 選択されたファイル情報 */}
                        {selectedFile && (
                          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <FileImage className="h-4 w-4 text-indigo-600" />
                              <div>
                                <p className="text-xs font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                  {selectedFile.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                      type="button"
                              onClick={handleClearFile}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* プレビュー */}
                        {previewUrl && (
                          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 relative group">
                            <div 
                              className="relative cursor-pointer"
                              onClick={handleOpenImageViewer}
                            >
                              <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-24 h-32 object-cover rounded mx-auto"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded flex items-center justify-center">
                                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 font-['Noto_Sans_JP']">
                              クリックで拡大表示
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* 隠しファイル入力 */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                type="button"
                onClick={handleCancel}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                      >
                        キャンセル
                      </button>
                      <button
                type="submit"
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP']"
                      >
                {editingCharacter ? '更新' : '追加'}
                      </button>
                    </div>
          </form>
                  </div>
                </div>
      
      {/* 画像拡大表示モーダル */}
      <ImageViewerModal
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        imageUrl={previewUrl}
        characterName={formData.name || 'プレビュー'}
      />
    </div>
  );
};

export const CharacterStep: React.FC = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [imageViewerState, setImageViewerState] = useState<{
    isOpen: boolean;
    imageUrl: string;
    characterName: string;
  }>({
    isOpen: false,
    imageUrl: '',
    characterName: ''
  });

  // モーダルを開く（新規追加）
  const handleOpenAddModal = () => {
    setEditingCharacter(null);
    setIsModalOpen(true);
  };

  // モーダルを開く（編集）
  const handleOpenEditModal = (character: Character) => {
    setEditingCharacter(character);
    setIsModalOpen(true);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCharacter(null);
  };

  // キャラクター追加
  const handleAddCharacter = (character: Character) => {
    if (!currentProject) return;

    updateProject({
      characters: [...currentProject.characters, character],
    });
  };

  // キャラクター更新
  const handleUpdateCharacter = (character: Character) => {
    if (!currentProject) return;

    const updatedCharacters = currentProject.characters.map(c => 
      c.id === character.id ? character : c
    );

    updateProject({ characters: updatedCharacters });
  };

  // ドラッグ開始
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // ドラッグ中
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // ドロップ
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex || !currentProject) return;

    const characters = [...currentProject.characters];
    const draggedCharacter = characters[draggedIndex];
    
    // ドラッグされたキャラクターを削除
    characters.splice(draggedIndex, 1);
    
    // 新しい位置に挿入
    characters.splice(dropIndex, 0, draggedCharacter);
    
    updateProject({ characters });
    setDraggedIndex(null);
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // キャラクター画像を拡大表示
  const handleOpenCharacterImageViewer = (character: Character) => {
    if (character.image) {
      setImageViewerState({
        isOpen: true,
        imageUrl: character.image,
        characterName: character.name
      });
    }
  };

  const handleDeleteCharacter = (id: string) => {
    if (!currentProject) return;
    updateProject({
      characters: currentProject.characters.filter(c => c.id !== id),
    });
  };

  const handleAIEnhance = async (character: Character) => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setEnhancingId(character.id);
    
    try {
      const prompt = aiService.buildPrompt('character', 'enhance', {
        name: character.name,
        role: character.role,
        appearance: character.appearance || '未設定',
        personality: character.personality || '未設定',
        background: character.background || '未設定',
      });

      console.log('AI Request:', {
        provider: settings.provider,
        model: settings.model,
        prompt: prompt.substring(0, 100) + '...',
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'character',
        settings,
      });

      console.log('AI Response:', {
        success: !response.error,
        contentLength: response.content?.length || 0,
        error: response.error,
        usage: response.usage,
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}\n\n詳細はブラウザのコンソールを確認してください。`);
        return;
      }

      // AIの回答を解析して既存のキャラクター情報を更新
      const updatedCharacters = currentProject!.characters.map(c => {
        if (c.id === character.id) {
          const content = response.content;
          let updatedAppearance = c.appearance;
          let updatedPersonality = c.personality;
          let updatedBackground = c.background;
          
          // 【外見の詳細】セクションを抽出
          const appearanceMatch = content.match(/【外見の詳細】\s*([\s\S]*?)(?=【性格の詳細】|$)/);
          if (appearanceMatch) {
            updatedAppearance = appearanceMatch[1].trim();
          }
          
          // 【性格の詳細】セクションを抽出（簡潔な形式に対応）
          const personalityMatch = content.match(/【性格の詳細】\s*([\s\S]*?)(?=【背景の補完】|$)/);
          if (personalityMatch) {
            updatedPersonality = personalityMatch[1].trim();
          }
          
          // 【背景の補完】セクションを抽出（簡潔な形式に対応）
          const backgroundMatch = content.match(/【背景の補完】\s*([\s\S]*?)(?=【|$)/);
          if (backgroundMatch) {
            updatedBackground = backgroundMatch[1].trim();
          }
          
          return {
            ...c,
            appearance: updatedAppearance,
            personality: updatedPersonality,
            background: updatedBackground,
          };
        }
        return c;
      });

      updateProject({ characters: updatedCharacters });
      
    } catch (error) {
      alert('AI生成中にエラーが発生しました');
    } finally {
      setEnhancingId(null);
    }
  };

  const handleAIGenerateCharacters = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    if (!currentProject) return;

    setIsGenerating(true);
    
    try {
      // プロジェクト設定から情報を取得
      const projectInfo = {
        title: currentProject.title || '未設定',
        theme: currentProject.theme || currentProject.projectTheme || '未設定',
        genre: currentProject.genre || '未設定',
        mainGenre: currentProject.mainGenre || currentProject.genre || '未設定',
        subGenre: currentProject.subGenre || '未設定',
        targetReader: currentProject.targetReader || '未設定',
        description: currentProject.description || '未設定',
      };

      const prompt = aiService.buildPrompt('character', 'create', {
        title: projectInfo.title,
        theme: projectInfo.theme,
        mainGenre: projectInfo.mainGenre,
        subGenre: projectInfo.subGenre,
        targetReader: projectInfo.targetReader,
        role: '主要キャラクター',
      });

      console.log('AI Character Generation Request:', {
        provider: settings.provider,
        model: settings.model,
        projectInfo,
        prompt: prompt.substring(0, 100) + '...',
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'character',
        settings,
      });

      console.log('AI Character Generation Response:', {
        success: !response.error,
        contentLength: response.content?.length || 0,
        error: response.error,
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}\n\n詳細はブラウザのコンソールを確認してください。`);
        return;
      }

      // AIの回答を解析して複数のキャラクターを作成
      const content = response.content;
      
      const newCharacters: Character[] = [];
      
      // キャラクター1を抽出
      const character1Match = content.match(/【キャラクター1】\s*([\s\S]*?)(?=【キャラクター2】|$)/);
      if (character1Match) {
        const char1Content = character1Match[1];
        const name1 = char1Content.match(/名前:\s*([^\n]+)/)?.[1]?.trim() || 'AI生成キャラクター1';
        const basic1 = char1Content.match(/基本設定:\s*([^\n]+)/)?.[1]?.trim() || '';
        const appearance1 = char1Content.match(/外見:\s*([\s\S]*?)(?=性格:|$)/)?.[1]?.trim() || '';
        const personality1 = char1Content.match(/性格:\s*([\s\S]*?)(?=背景:|$)/)?.[1]?.trim() || '';
        const background1 = char1Content.match(/背景:\s*([\s\S]*?)$/)?.[1]?.trim() || '';

        newCharacters.push({
          id: Date.now().toString(),
          name: name1,
          role: basic1 || '主要キャラクター',
          appearance: appearance1.substring(0, 200),
          personality: personality1.substring(0, 200),
          background: background1.substring(0, 200),
          image: '',
        });
      }

      // キャラクター2を抽出
      const character2Match = content.match(/【キャラクター2】\s*([\s\S]*?)(?=【キャラクター3】|$)/);
      if (character2Match) {
        const char2Content = character2Match[1];
        const name2 = char2Content.match(/名前:\s*([^\n]+)/)?.[1]?.trim() || 'AI生成キャラクター2';
        const basic2 = char2Content.match(/基本設定:\s*([^\n]+)/)?.[1]?.trim() || '';
        const appearance2 = char2Content.match(/外見:\s*([\s\S]*?)(?=性格:|$)/)?.[1]?.trim() || '';
        const personality2 = char2Content.match(/性格:\s*([\s\S]*?)(?=背景:|$)/)?.[1]?.trim() || '';
        const background2 = char2Content.match(/背景:\s*([\s\S]*?)$/)?.[1]?.trim() || '';

        newCharacters.push({
          id: (Date.now() + 1).toString(),
          name: name2,
          role: basic2 || '主要キャラクター',
          appearance: appearance2.substring(0, 200),
          personality: personality2.substring(0, 200),
          background: background2.substring(0, 200),
          image: '',
        });
      }

      // キャラクター3を抽出
      const character3Match = content.match(/【キャラクター3】\s*([\s\S]*?)$/);
      if (character3Match) {
        const char3Content = character3Match[1];
        const name3 = char3Content.match(/名前:\s*([^\n]+)/)?.[1]?.trim() || 'AI生成キャラクター3';
        const basic3 = char3Content.match(/基本設定:\s*([^\n]+)/)?.[1]?.trim() || '';
        const appearance3 = char3Content.match(/外見:\s*([\s\S]*?)(?=性格:|$)/)?.[1]?.trim() || '';
        const personality3 = char3Content.match(/性格:\s*([\s\S]*?)(?=背景:|$)/)?.[1]?.trim() || '';
        const background3 = char3Content.match(/背景:\s*([\s\S]*?)$/)?.[1]?.trim() || '';

        newCharacters.push({
          id: (Date.now() + 2).toString(),
          name: name3,
          role: basic3 || '主要キャラクター',
          appearance: appearance3.substring(0, 200),
          personality: personality3.substring(0, 200),
          background: background3.substring(0, 200),
          image: '',
        });
      }

      // 既存のキャラクターに追加
      if (newCharacters.length > 0) {
        updateProject({
          characters: [...currentProject.characters, ...newCharacters],
        });

        const characterNames = newCharacters.map(c => c.name).join('、');
        alert(`${newCharacters.length}人のキャラクター（${characterNames}）を生成しました！`);
      } else {
        alert('キャラクターの生成に失敗しました。もう一度お試しください。');
      }
      
    } catch (error) {
      console.error('AI生成エラー:', error);
      alert('AI生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              キャラクター設計
            </h1>
            <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-2">
              物語の核となるキャラクターを作成しましょう。AIが背景や関係性を補完します。
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP'] mt-1">
              💡 キャラクターカードをドラッグ&ドロップで並び順を変更できます
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] shadow-lg"
          >
            <Plus className="h-5 w-5" />
            <span>新しいキャラクターを追加</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Characters List */}
        <div className="lg:col-span-2 space-y-4">
          {currentProject.characters.map((character, index) => (
            <div 
              key={character.id} 
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onDoubleClick={() => handleOpenEditModal(character)}
              className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 cursor-move transition-all duration-200 ${
                draggedIndex === index 
                  ? 'opacity-50 scale-95 shadow-2xl' 
                  : 'hover:shadow-xl hover:scale-[1.02]'
              }`}
            >
                  <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="w-16 h-24 rounded-lg flex items-center justify-center overflow-hidden relative group">
                      {character.image ? (
                        <div 
                          className="relative cursor-pointer w-full h-full"
                          onClick={() => handleOpenCharacterImageViewer(character)}
                        >
                          <img
                            src={character.image}
                            alt={character.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                            <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-pink-500 to-purple-600 w-full h-full rounded-lg flex items-center justify-center">
                          <User className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {character.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {character.role}
                      </p>
                    </div>
                  </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAIEnhance(character)}
                        disabled={enhancingId === character.id || !isConfigured}
                        className="p-2 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="AI支援で詳細を補完"
                      >
                        {enhancingId === character.id ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </button>
                      <button
                    onClick={() => handleOpenEditModal(character)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="キャラクターを編集"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCharacter(character.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="キャラクターを削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {character.appearance && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">外見</h4>
                        <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.appearance}</p>
                      </div>
                    )}
                    
                    {character.personality && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">性格</h4>
                        <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.personality}</p>
                      </div>
                    )}
                    
                    {character.background && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">背景</h4>
                        <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.background}</p>
                      </div>
                    )}
                  </div>
            </div>
          ))}

          {/* Add Character Button */}
            <button
            onClick={handleOpenAddModal}
              className="w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors group"
            >
              <div className="text-center">
                <Plus className="h-8 w-8 text-gray-400 group-hover:text-indigo-500 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400 group-hover:text-indigo-500 font-['Noto_Sans_JP']">
                  新しいキャラクターを追加
                </p>
              </div>
            </button>
        </div>

        {/* AI Assistant Panel */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 p-6 rounded-2xl border border-pink-200 dark:border-pink-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 w-10 h-10 rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AI支援アシスタント
              </h3>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4 font-['Noto_Sans_JP']">
              キャラクターの詳細設定でお困りですか？
              AIがお手伝いします
            </p>
            
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              <li>• 性格の詳細な設定</li>
              <li>• 背景設定の補完</li>
              <li>• 行動パターンの提案</li>
            </ul>

            <button 
              onClick={handleAIGenerateCharacters}
              disabled={!isConfigured || isGenerating}
              className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>生成中...</span>
                </div>
              ) : !isConfigured ? (
                'AI設定が必要'
              ) : (
                'AIキャラクター提案'
              )}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
              進捗状況
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">作成済みキャラクター</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {currentProject.characters.length} 人
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min((currentProject.characters.length / 10) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                推奨: 3-10人程度
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Character Modal */}
      <CharacterModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddCharacter}
        editingCharacter={editingCharacter}
        onUpdate={handleUpdateCharacter}
      />

      {/* 画像拡大表示モーダル */}
      <ImageViewerModal
        isOpen={imageViewerState.isOpen}
        onClose={() => setImageViewerState({ isOpen: false, imageUrl: '', characterName: '' })}
        imageUrl={imageViewerState.imageUrl}
        characterName={imageViewerState.characterName}
      />
    </div>
  );
};