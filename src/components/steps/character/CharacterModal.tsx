import React, { useState, useRef } from 'react';
import { Upload, X, FileImage, ZoomIn } from 'lucide-react';
import { Character } from '../../../contexts/ProjectContext';
import { useToast } from '../../Toast';
import { useModalNavigation } from '../../../hooks/useKeyboardNavigation';
import { Modal } from '../../common/Modal';
import { OptimizedImage } from '../../OptimizedImage';
import { compressImage } from '../../../utils/performanceUtils';
import { generateUUID } from '../../../utils/securityUtils';
import { IMAGE_CONFIG, TEXT_LIMITS } from '../../../constants/character';
import { ImageViewerModal } from './ImageViewerModal';

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (character: Character) => void;
  editingCharacter?: Character | null;
  onUpdate?: (character: Character) => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingCharacter,
  onUpdate
}) => {
  const { showError, showSuccess } = useToast();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });
  const [activeTab, setActiveTab] = useState<'basic' | 'details'>('basic');
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    appearance: '',
    personality: '',
    background: '',
    image: '',
    speechStyle: '',
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
          speechStyle: editingCharacter.speechStyle || '',
        });
        setPreviewUrl(editingCharacter.image || '');
      } else {
        setFormData({ name: '', role: '', appearance: '', personality: '', background: '', image: '', speechStyle: '' });
        setPreviewUrl('');
      }
      setSelectedFile(null);
      setActiveTab('basic'); // タブをリセット
    }
  }, [isOpen, editingCharacter]);

  // ファイルをBase64に変換する関数
  const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file instanceof File ? file : new File([file], 'image', { type: file.type }));
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // 画像ファイルの実際の検証（マジックナンバーチェック）
  const validateImageFile = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(true);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };
      
      img.src = objectUrl;
    });
  };

  // Base64文字列のサイズをバイト単位で計算
  const getBase64Size = (base64: string): number => {
    // Base64文字列のサイズ = (文字列長 * 3) / 4 - パディング
    const padding = base64.match(/=*$/)?.[0].length || 0;
    return (base64.length * 3) / 4 - padding;
  };

  // ファイル選択ハンドラー
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルタイプの検証
    if (!file.type.startsWith('image/') || !IMAGE_CONFIG.ALLOWED_TYPES.includes(file.type as typeof IMAGE_CONFIG.ALLOWED_TYPES[number])) {
      showError('サポートされている画像形式（JPEG、PNG、GIF、WebP）を選択してください。');
      return;
    }

    // ファイルサイズの検証
    if (file.size > IMAGE_CONFIG.MAX_SIZE_BYTES) {
      showError(`ファイルサイズが大きすぎます。${IMAGE_CONFIG.MAX_SIZE_MB}MB以下の画像を選択してください。`);
      return;
    }

    // 画像ファイルの実際の検証
    const isValidImage = await validateImageFile(file);
    if (!isValidImage) {
      showError('有効な画像ファイルではありません。別のファイルを選択してください。');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      // 画像を圧縮
      const compressedBlob = await compressImage(
        file,
        IMAGE_CONFIG.MAX_WIDTH,
        IMAGE_CONFIG.MAX_HEIGHT,
        IMAGE_CONFIG.QUALITY
      );
      
      // 圧縮されたBlobをBase64に変換
      const base64 = await fileToBase64(compressedBlob);
      
      // Base64サイズの検証
      const base64Size = getBase64Size(base64);
      if (base64Size > IMAGE_CONFIG.MAX_SIZE_BYTES) {
        showError('画像サイズが大きすぎます。別の画像を選択してください。');
        setIsUploading(false);
        return;
      }
      
      setPreviewUrl(base64);
      setFormData(prev => ({ ...prev, image: base64 }));
    } catch (error) {
      console.error('画像の圧縮エラー:', error);
      // エラーの場合は元のファイルをBase64に変換
      try {
        const base64 = await fileToBase64(file);
        
        // Base64サイズの検証
        const base64Size = getBase64Size(base64);
        if (base64Size > IMAGE_CONFIG.MAX_SIZE_BYTES) {
          showError('画像サイズが大きすぎます。別の画像を選択してください。');
          setIsUploading(false);
          return;
        }
        
        setPreviewUrl(base64);
        setFormData(prev => ({ ...prev, image: base64 }));
      } catch (readError) {
        console.error('ファイル読み込みエラー:', readError);
        showError('ファイルの読み込みに失敗しました。');
      }
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
      id: editingCharacter?.id || generateUUID(),
      name: formData.name.trim(),
      role: formData.role.trim(),
      appearance: formData.appearance.trim(),
      personality: formData.personality.trim(),
      background: formData.background.trim(),
      image: formData.image,
      speechStyle: formData.speechStyle.trim() || undefined,
    };

    if (editingCharacter && onUpdate) {
      onUpdate(character);
      showSuccess('キャラクターを更新しました');
    } else {
      onSubmit(character);
      showSuccess('キャラクターを追加しました');
    }

    // フォームをリセット
    setFormData({ name: '', role: '', appearance: '', personality: '', background: '', image: '', speechStyle: '' });
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // キャンセル
  const handleCancel = () => {
    setFormData({ name: '', role: '', appearance: '', personality: '', background: '', image: '', speechStyle: '' });
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title={editingCharacter ? 'キャラクターを編集' : '新しいキャラクター'}
        size="md"
        ref={modalRef}
      >
        <div className="space-y-6">
          {/* タブナビゲーション */}
          <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${activeTab === 'basic'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              基本情報
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${activeTab === 'details'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              詳細情報
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本情報タブ */}
            {activeTab === 'basic' && (
              <>
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
                          JPG, PNG, GIF, WebP (最大{IMAGE_CONFIG.MAX_SIZE_MB}MB)
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
                          <OptimizedImage
                            src={previewUrl}
                            alt="Preview"
                            className="w-24 h-32 rounded mx-auto"
                            lazy={true}
                            quality={IMAGE_CONFIG.QUALITY}
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
              </>
            )}

            {/* 詳細情報タブ */}
            {activeTab === 'details' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    外見・特徴
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.appearance}
                      onChange={(e) => {
                        const value = e.target.value;
                        const truncatedValue = value.length > TEXT_LIMITS.APPEARANCE_MAX ? value.substring(0, TEXT_LIMITS.APPEARANCE_MAX) : value;
                        setFormData({ ...formData, appearance: truncatedValue });
                      }}
                      placeholder={`キャラクターの外見や特徴を簡潔に（${TEXT_LIMITS.APPEARANCE_WARNING}文字程度推奨）`}
                      rows={3}
                      className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] ${formData.appearance.length > TEXT_LIMITS.APPEARANCE_WARNING
                        ? 'border-yellow-300 dark:border-yellow-600'
                        : 'border-gray-300 dark:border-gray-600'
                        }`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs">
                      <span className={`font-['Noto_Sans_JP'] ${formData.appearance.length > TEXT_LIMITS.APPEARANCE_MAX
                        ? 'text-red-500'
                        : formData.appearance.length > TEXT_LIMITS.APPEARANCE_WARNING
                          ? 'text-yellow-500'
                          : 'text-gray-400'
                        }`}>
                        {formData.appearance.length}/{TEXT_LIMITS.APPEARANCE_MAX}
                      </span>
                    </div>
                  </div>
                  {formData.appearance.length > TEXT_LIMITS.APPEARANCE_WARNING && formData.appearance.length <= TEXT_LIMITS.APPEARANCE_MAX && (
                    <p className="text-xs text-yellow-600 mt-1 font-['Noto_Sans_JP']">
                      文字数が多めです（{TEXT_LIMITS.APPEARANCE_WARNING}文字程度推奨）
                    </p>
                  )}
                  {formData.appearance.length > TEXT_LIMITS.APPEARANCE_MAX && (
                    <p className="text-xs text-red-500 mt-1 font-['Noto_Sans_JP']">
                      {TEXT_LIMITS.APPEARANCE_MAX}文字を超えたため切り捨てられました
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
                        const truncatedValue = value.length > TEXT_LIMITS.PERSONALITY_MAX ? value.substring(0, TEXT_LIMITS.PERSONALITY_MAX) : value;
                        setFormData({ ...formData, personality: truncatedValue });
                      }}
                      placeholder={`キャラクターの性格や特徴を簡潔に（${TEXT_LIMITS.PERSONALITY_WARNING}文字程度推奨）`}
                      rows={3}
                      className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] ${formData.personality.length > TEXT_LIMITS.PERSONALITY_WARNING
                        ? 'border-yellow-300 dark:border-yellow-600'
                        : 'border-gray-300 dark:border-gray-600'
                        }`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs">
                      <span className={`font-['Noto_Sans_JP'] ${formData.personality.length > TEXT_LIMITS.PERSONALITY_MAX
                        ? 'text-red-500'
                        : formData.personality.length > TEXT_LIMITS.PERSONALITY_WARNING
                          ? 'text-yellow-500'
                          : 'text-gray-400'
                        }`}>
                        {formData.personality.length}/{TEXT_LIMITS.PERSONALITY_MAX}
                      </span>
                    </div>
                  </div>
                  {formData.personality.length > TEXT_LIMITS.PERSONALITY_WARNING && formData.personality.length <= TEXT_LIMITS.PERSONALITY_MAX && (
                    <p className="text-xs text-yellow-600 mt-1 font-['Noto_Sans_JP']">
                      文字数が多めです（{TEXT_LIMITS.PERSONALITY_WARNING}文字程度推奨）
                    </p>
                  )}
                  {formData.personality.length > TEXT_LIMITS.PERSONALITY_MAX && (
                    <p className="text-xs text-red-500 mt-1 font-['Noto_Sans_JP']">
                      {TEXT_LIMITS.PERSONALITY_MAX}文字を超えたため切り捨てられました
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
                        const truncatedValue = value.length > TEXT_LIMITS.BACKGROUND_MAX ? value.substring(0, TEXT_LIMITS.BACKGROUND_MAX) : value;
                        setFormData({ ...formData, background: truncatedValue });
                      }}
                      placeholder={`キャラクターの背景や過去について（${TEXT_LIMITS.BACKGROUND_WARNING}文字程度推奨）`}
                      rows={3}
                      className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] ${formData.background.length > TEXT_LIMITS.BACKGROUND_WARNING
                        ? 'border-yellow-300 dark:border-yellow-600'
                        : 'border-gray-300 dark:border-gray-600'
                        }`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs">
                      <span className={`font-['Noto_Sans_JP'] ${formData.background.length > TEXT_LIMITS.BACKGROUND_MAX
                        ? 'text-red-500'
                        : formData.background.length > TEXT_LIMITS.BACKGROUND_WARNING
                          ? 'text-yellow-500'
                          : 'text-gray-400'
                        }`}>
                        {formData.background.length}/{TEXT_LIMITS.BACKGROUND_MAX}
                      </span>
                    </div>
                  </div>
                  {formData.background.length > TEXT_LIMITS.BACKGROUND_WARNING && formData.background.length <= TEXT_LIMITS.BACKGROUND_MAX && (
                    <p className="text-xs text-yellow-600 mt-1 font-['Noto_Sans_JP']">
                      文字数が多めです（{TEXT_LIMITS.BACKGROUND_WARNING}文字程度推奨）
                    </p>
                  )}
                  {formData.background.length > TEXT_LIMITS.BACKGROUND_MAX && (
                    <p className="text-xs text-red-500 mt-1 font-['Noto_Sans_JP']">
                      {TEXT_LIMITS.BACKGROUND_MAX}文字を超えたため切り捨てられました
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    口調・話し方
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.speechStyle}
                      onChange={(e) => {
                        const value = e.target.value;
                        const truncatedValue = value.length > TEXT_LIMITS.SPEECH_STYLE_MAX ? value.substring(0, TEXT_LIMITS.SPEECH_STYLE_MAX) : value;
                        setFormData({ ...formData, speechStyle: truncatedValue });
                      }}
                      placeholder={`例：丁寧語で話す、関西弁、語尾に「〜だぜ」をつける、敬語を使わないなど（${TEXT_LIMITS.SPEECH_STYLE_WARNING}文字程度推奨）`}
                      rows={3}
                      className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] ${formData.speechStyle.length > TEXT_LIMITS.SPEECH_STYLE_WARNING
                        ? 'border-yellow-300 dark:border-yellow-600'
                        : 'border-gray-300 dark:border-gray-600'
                        }`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs">
                      <span className={`font-['Noto_Sans_JP'] ${formData.speechStyle.length > TEXT_LIMITS.SPEECH_STYLE_MAX
                        ? 'text-red-500'
                        : formData.speechStyle.length > TEXT_LIMITS.SPEECH_STYLE_WARNING
                          ? 'text-yellow-500'
                          : 'text-gray-400'
                        }`}>
                        {formData.speechStyle.length}/{TEXT_LIMITS.SPEECH_STYLE_MAX}
                      </span>
                    </div>
                  </div>
                  {formData.speechStyle.length > TEXT_LIMITS.SPEECH_STYLE_WARNING && formData.speechStyle.length <= TEXT_LIMITS.SPEECH_STYLE_MAX && (
                    <p className="text-xs text-yellow-600 mt-1 font-['Noto_Sans_JP']">
                      文字数が多めです（{TEXT_LIMITS.SPEECH_STYLE_WARNING}文字程度推奨）
                    </p>
                  )}
                  {formData.speechStyle.length > TEXT_LIMITS.SPEECH_STYLE_MAX && (
                    <p className="text-xs text-red-500 mt-1 font-['Noto_Sans_JP']">
                      {TEXT_LIMITS.SPEECH_STYLE_MAX}文字を超えたため切り捨てられました
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
                    💡 この口調設定は、AIアシストでの会話生成や草案作成時に反映されます
                  </p>
                </div>
              </>
            )}

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
      </Modal>

      {/* 画像拡大表示モーダル */}
      <ImageViewerModal
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        imageUrl={previewUrl}
        characterName={formData.name || 'プレビュー'}
      />
    </>
  );
};


























