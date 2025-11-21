import React, { useState, useRef } from 'react';
import { X, BookOpen, Image, Upload } from 'lucide-react';
import { Step } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStep: (step: Step) => void;
}

// ジャンル選択オプション
const GENRES = [
  '一般小説', '恋愛小説', 'ミステリー', 'SF', 'ファンタジー', 'ホラー', '歴史小説', 
  '青春小説', 'ビジネス小説', 'スポーツ小説', 'コメディ', 'アクション', 'サスペンス', 'その他'
];

// ターゲット読者選択オプション
const TARGET_READERS = [
  '10代', '20代', '30代', '40代', '50代以上', '全年齢', 'その他'
];

// テーマ選択オプション
const THEMES = [
  '成長・自己発見', '友情・絆', '恋愛・愛', '家族・親子', '正義・道徳', 
  '復讐・救済', '冒険・探検', '戦争・平和', '死・生', '希望・夢', '孤独・疎外感', 'その他'
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onNavigateToStep }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainGenre, setMainGenre] = useState('');
  const [subGenre, setSubGenre] = useState('');
  const [targetReader, setTargetReader] = useState('');
  const [projectTheme, setProjectTheme] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customMainGenre, setCustomMainGenre] = useState('');
  const [customSubGenre, setCustomSubGenre] = useState('');
  const [customTargetReader, setCustomTargetReader] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createNewProject } = useProject();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

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

    // ファイルタイプとサイズの検証
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB制限
      alert('ファイルサイズは10MB以下にしてください。');
      return;
    }

    const base64 = await fileToBase64(file);
    setPreviewUrl(base64);
    setCoverImage(base64);
  };

  // ファイル選択ボタンクリック
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // ファイルクリア
  const handleClearFile = () => {
    setPreviewUrl(null);
    setCoverImage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && mainGenre) {
      const finalMainGenre = mainGenre === 'その他' ? customMainGenre : mainGenre;
      const finalSubGenre = subGenre === 'その他' ? customSubGenre : subGenre;
      const finalTargetReader = targetReader === 'その他' ? customTargetReader : targetReader;
      const finalTheme = projectTheme === 'その他' ? customTheme : projectTheme;
      
      createNewProject(title.trim(), description.trim(), finalMainGenre, finalSubGenre, coverImage, finalTargetReader, finalTheme);
      onNavigateToStep('character');
      onClose();
      setTitle('');
      setDescription('');
      setMainGenre('');
      setSubGenre('');
      setTargetReader('');
      setProjectTheme('');
      setCoverImage('');
      setPreviewUrl(null);
      setCustomMainGenre('');
      setCustomSubGenre('');
      setCustomTargetReader('');
      setCustomTheme('');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              新しいプロジェクト
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              プロジェクトタイトル *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：異世界転生物語"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-['Noto_Sans_JP']"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              プロジェクトの説明
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このプロジェクトの概要や目標を簡単に説明してください..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-['Noto_Sans_JP']"
            />
          </div>

          {/* メインジャンル選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              メインジャンル <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((genreOption) => (
                <button
                  key={genreOption}
                  type="button"
                  onClick={() => {
                    if (mainGenre !== genreOption) {
                      setMainGenre(genreOption);
                      setCustomMainGenre('');
                    }
                  }}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    mainGenre === genreOption
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                  }`}
                >
                  {genreOption}
                </button>
              ))}
            </div>
            {mainGenre === 'その他' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customMainGenre}
                  onChange={(e) => setCustomMainGenre(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="カスタムジャンルを入力してください"
                />
              </div>
            )}
          </div>

          {/* サブジャンル選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              サブジャンル <span className="text-gray-500">（任意）</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((genreOption) => (
                <button
                  key={genreOption}
                  type="button"
                  onClick={() => {
                    if (subGenre === genreOption) {
                      setSubGenre('');
                      setCustomSubGenre('');
                    } else {
                      setSubGenre(genreOption);
                      setCustomSubGenre('');
                    }
                  }}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    subGenre === genreOption
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/50'
                  }`}
                >
                  {genreOption}
                </button>
              ))}
            </div>
            {subGenre === 'その他' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customSubGenre}
                  onChange={(e) => setCustomSubGenre(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="カスタムサブジャンルを入力してください"
                />
              </div>
            )}
          </div>

          {/* ターゲット読者選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              ターゲット読者
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TARGET_READERS.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => {
                    if (targetReader === target) {
                      setTargetReader('');
                      setCustomTargetReader('');
                    } else {
                      setTargetReader(target);
                      setCustomTargetReader('');
                    }
                  }}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    targetReader === target
                      ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/50'
                  }`}
                >
                  {target}
                </button>
              ))}
            </div>
            {targetReader === 'その他' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customTargetReader}
                  onChange={(e) => setCustomTargetReader(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="カスタムターゲット読者を入力してください"
                />
              </div>
            )}
          </div>

          {/* テーマ選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              テーマ
            </label>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((themeOption) => (
                <button
                  key={themeOption}
                  type="button"
                  onClick={() => {
                    if (projectTheme === themeOption) {
                      setProjectTheme('');
                      setCustomTheme('');
                    } else {
                      setProjectTheme(themeOption);
                      setCustomTheme('');
                    }
                  }}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    projectTheme === themeOption
                      ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/50'
                  }`}
                >
                  {themeOption}
                </button>
              ))}
            </div>
            {projectTheme === 'その他' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="カスタムテーマを入力してください"
                />
              </div>
            )}
          </div>

          {/* 表紙画像 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              表紙画像
            </label>
            
            {/* ファイル選択エリア */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {previewUrl ? (
                <div className="space-y-3">
                  <img 
                    src={previewUrl} 
                    alt="プレビュー" 
                    className="w-full h-32 object-cover rounded-lg mx-auto"
                  />
                  <div className="flex space-x-2 justify-center">
                    <button
                      type="button"
                      onClick={handleSelectFile}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
                    >
                      <Upload className="h-4 w-4 inline mr-1" />
                      変更
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors text-sm"
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
                      className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
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

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP']"
            >
              プロジェクト作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};