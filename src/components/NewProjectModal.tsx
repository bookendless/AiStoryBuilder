import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Image, Upload, X } from 'lucide-react';
import { Step } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { OptimizedImage } from './OptimizedImage';
import { Modal } from './common/Modal';
import { compressImage } from '../utils/performanceUtils';
import { useToast } from './Toast';
import {
  STYLE_OPTIONS,
  PERSPECTIVE_OPTIONS,
  FORMALITY_OPTIONS,
  RHYTHM_OPTIONS,
  METAPHOR_OPTIONS,
  DIALOGUE_OPTIONS,
  EMOTION_OPTIONS,
  TONE_OPTIONS,
} from '../constants/writingStyle';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStep: (step: Step) => void;
}

// ジャンル選択オプション
const GENRES = [
  '一般小説', '恋愛小説', 'ミステリー', 'SF', 'ファンタジー', 'ホラー',
  'コメディ', 'アクション', 'サスペンス', 'その他'
];

// ターゲット読者選択オプション
const TARGET_READERS = [
  '10代', '20代', '30代', '40代以上', '全年齢', 'その他'
];

// テーマ選択オプション
const THEMES = [
  '成長・自己発見', '友情・絆', '恋愛・愛', '家族・親子', '正義・道徳',
  '復讐・救済', '冒険・探検', '戦争・平和', '死・生', '希望・夢', '孤独・疎外感', 'その他'
];

interface ValidationErrors {
  title?: string;
  mainGenre?: string;
  customMainGenre?: string;
  customSubGenre?: string;
  customTargetReader?: string;
  customTheme?: string;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onNavigateToStep }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'style'>('basic');
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
  const [styleData, setStyleData] = useState({
    style: '',
    perspective: '',
    formality: '',
    rhythm: '',
    metaphor: '',
    dialogue: '',
    emotion: '',
    tone: '',
    customStyle: '',
    customPerspective: '',
    customFormality: '',
    customRhythm: '',
    customMetaphor: '',
    customDialogue: '',
    customEmotion: '',
    customTone: '',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createNewProject } = useProject();
  const { showError } = useToast();

  // バリデーション関数
  const validateField = (fieldName: string, value: string): string | undefined => {
    switch (fieldName) {
      case 'title':
        if (!value.trim()) {
          return 'プロジェクトタイトルは必須です';
        }
        if (value.trim().length > 100) {
          return 'プロジェクトタイトルは100文字以内で入力してください';
        }
        return undefined;
      case 'mainGenre':
        if (!value) {
          return 'メインジャンルは必須です';
        }
        return undefined;
      case 'customMainGenre':
        if (mainGenre === 'その他' && !value.trim()) {
          return 'カスタムジャンルを入力してください';
        }
        return undefined;
      case 'customSubGenre':
        if (subGenre === 'その他' && !value.trim()) {
          return 'カスタムサブジャンルを入力してください';
        }
        return undefined;
      case 'customTargetReader':
        if (targetReader === 'その他' && !value.trim()) {
          return 'カスタムターゲット読者を入力してください';
        }
        return undefined;
      case 'customTheme':
        if (projectTheme === 'その他' && !value.trim()) {
          return 'カスタムテーマを入力してください';
        }
        return undefined;
      default:
        return undefined;
    }
  };

  // リアルタイムバリデーション
  const handleFieldChange = (fieldName: string, value: string, setter: (value: string) => void) => {
    setter(value);
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error,
      }));
    }
  };

  // フィールドがタッチされたときにマーク
  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    const value = fieldName === 'title' ? title :
      fieldName === 'mainGenre' ? mainGenre :
        fieldName === 'customMainGenre' ? customMainGenre :
          fieldName === 'customSubGenre' ? customSubGenre :
            fieldName === 'customTargetReader' ? customTargetReader :
              fieldName === 'customTheme' ? customTheme : '';
    const error = validateField(fieldName, value);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));
  };


  // モーダルが閉じられたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
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
      setStyleData({
        style: '',
        perspective: '',
        formality: '',
        rhythm: '',
        metaphor: '',
        dialogue: '',
        emotion: '',
        tone: '',
        customStyle: '',
        customPerspective: '',
        customFormality: '',
        customRhythm: '',
        customMetaphor: '',
        customDialogue: '',
        customEmotion: '',
        customTone: '',
      });
      setErrors({});
      setTouched({});
      setActiveTab('basic');
    }
  }, [isOpen]);

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
      setCoverImage(base64);
    } catch (error) {
      console.error('画像の圧縮エラー:', error);
      // エラーの場合は元のファイルをBase64に変換
      const base64 = await fileToBase64(file);
      setPreviewUrl(base64);
      setCoverImage(base64);
    }
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

  // すべてのフィールドをバリデーション
  const validateAll = (): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    const titleError = validateField('title', title);
    if (titleError) {
      newErrors.title = titleError;
      isValid = false;
    }

    const mainGenreError = validateField('mainGenre', mainGenre);
    if (mainGenreError) {
      newErrors.mainGenre = mainGenreError;
      isValid = false;
    }

    if (mainGenre === 'その他') {
      const customMainGenreError = validateField('customMainGenre', customMainGenre);
      if (customMainGenreError) {
        newErrors.customMainGenre = customMainGenreError;
        isValid = false;
      }
    }

    if (subGenre === 'その他') {
      const customSubGenreError = validateField('customSubGenre', customSubGenre);
      if (customSubGenreError) {
        newErrors.customSubGenre = customSubGenreError;
        isValid = false;
      }
    }

    if (targetReader === 'その他') {
      const customTargetReaderError = validateField('customTargetReader', customTargetReader);
      if (customTargetReaderError) {
        newErrors.customTargetReader = customTargetReaderError;
        isValid = false;
      }
    }

    if (projectTheme === 'その他') {
      const customThemeError = validateField('customTheme', customTheme);
      if (customThemeError) {
        newErrors.customTheme = customThemeError;
        isValid = false;
      }
    }

    setErrors(newErrors);
    // すべてのフィールドをタッチ済みとしてマーク
    setTouched({
      title: true,
      mainGenre: true,
      customMainGenre: true,
      customSubGenre: true,
      customTargetReader: true,
      customTheme: true,
    });

    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAll()) {
      // エラーがある場合は基本情報タブに切り替え
      if (activeTab === 'style') {
        setActiveTab('basic');
      }
      showError('入力内容にエラーがあります。確認してください。', 5000, {
        title: 'バリデーションエラー',
      });
      return;
    }

    if (title.trim() && mainGenre) {
      const finalMainGenre = mainGenre === 'その他' ? customMainGenre : mainGenre;
      const finalSubGenre = subGenre === 'その他' ? customSubGenre : subGenre;
      const finalTargetReader = targetReader === 'その他' ? customTargetReader : targetReader;
      const finalTheme = projectTheme === 'その他' ? customTheme : projectTheme;

      // 文体設定を構築（空でない値のみ含める）
      // 「その他」が選択されている場合はカスタム値を使用、それ以外は選択値をそのまま使用
      const computeStyleValue = (selected: string, custom: string) => {
        if (!selected) return undefined;
        if (selected === 'その他') {
          return custom.trim() || undefined;
        }
        return selected;
      };

      const writingStyle = {
        style: computeStyleValue(styleData.style, styleData.customStyle),
        perspective: computeStyleValue(styleData.perspective, styleData.customPerspective),
        formality: computeStyleValue(styleData.formality, styleData.customFormality),
        rhythm: computeStyleValue(styleData.rhythm, styleData.customRhythm),
        metaphor: computeStyleValue(styleData.metaphor, styleData.customMetaphor),
        dialogue: computeStyleValue(styleData.dialogue, styleData.customDialogue),
        emotion: computeStyleValue(styleData.emotion, styleData.customEmotion),
        tone: computeStyleValue(styleData.tone, styleData.customTone),
        customStyle: styleData.style === 'その他' ? styleData.customStyle.trim() : undefined,
        customPerspective: styleData.perspective === 'その他' ? styleData.customPerspective.trim() : undefined,
        customFormality: styleData.formality === 'その他' ? styleData.customFormality.trim() : undefined,
        customRhythm: styleData.rhythm === 'その他' ? styleData.customRhythm.trim() : undefined,
        customMetaphor: styleData.metaphor === 'その他' ? styleData.customMetaphor.trim() : undefined,
        customDialogue: styleData.dialogue === 'その他' ? styleData.customDialogue.trim() : undefined,
        customEmotion: styleData.emotion === 'その他' ? styleData.customEmotion.trim() : undefined,
        customTone: styleData.tone === 'その他' ? styleData.customTone.trim() : undefined,
      };

      // すべての値が undefined の場合は writingStyle 自体を undefined にする
      const finalWritingStyle = Object.values(writingStyle).every(v => v === undefined)
        ? undefined
        : writingStyle;

      createNewProject(title.trim(), description.trim(), finalMainGenre, finalSubGenre, coverImage, finalTargetReader, finalTheme, finalWritingStyle);
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
      setStyleData({
        style: '',
        perspective: '',
        formality: '',
        rhythm: '',
        metaphor: '',
        dialogue: '',
        emotion: '',
        tone: '',
        customStyle: '',
        customPerspective: '',
        customFormality: '',
        customRhythm: '',
        customMetaphor: '',
        customDialogue: '',
        customEmotion: '',
        customTone: '',
      });
      setActiveTab('basic');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
            <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span>新しいプロジェクト</span>
        </div>
      }
      size="md"
    >
      {/* タブナビゲーション */}
      <div
        className="mb-6 flex space-x-1 border-b border-gray-200 dark:border-gray-700"
        role="tablist"
        aria-label="プロジェクト設定タブ"
      >
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'basic'
            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            } font-['Noto_Sans_JP']`}
        >
          基本情報
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('style')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'style'
            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            } font-['Noto_Sans_JP']`}
        >
          文体設定
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'basic' && (
          <div
            id="basic-tabpanel"
            role="tabpanel"
            aria-labelledby="basic-tab"
            className="space-y-6"
          >
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                プロジェクトタイトル <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => handleFieldChange('title', e.target.value, setTitle)}
                onBlur={() => handleFieldBlur('title')}
                placeholder="例：異世界転生物語"
                className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-['Noto_Sans_JP'] ${errors.title ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                required
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400 font-['Noto_Sans_JP']">
                  {errors.title}
                </p>
              )}
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
                メインジャンル <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                {GENRES.map((genreOption) => (
                  <button
                    key={genreOption}
                    type="button"
                    onClick={() => {
                      if (mainGenre !== genreOption) {
                        handleFieldChange('mainGenre', genreOption, setMainGenre);
                        setCustomMainGenre('');
                        setErrors(prev => ({ ...prev, mainGenre: undefined }));
                      }
                    }}
                    onBlur={() => handleFieldBlur('mainGenre')}
                    className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${mainGenre === genreOption
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                      } ${errors.mainGenre ? 'ring-2 ring-red-500' : ''}`}
                  >
                    {genreOption}
                  </button>
                ))}
              </div>
              {errors.mainGenre && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400 font-['Noto_Sans_JP']">
                  {errors.mainGenre}
                </p>
              )}
              {mainGenre === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={customMainGenre}
                    onChange={(e) => handleFieldChange('customMainGenre', e.target.value, setCustomMainGenre)}
                    onBlur={() => handleFieldBlur('customMainGenre')}
                    className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP'] ${errors.customMainGenre ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    placeholder="カスタムジャンルを入力してください"
                  />
                  {errors.customMainGenre && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 font-['Noto_Sans_JP']">
                      {errors.customMainGenre}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* サブジャンル選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                サブジャンル <span className="text-gray-500">（任意）</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
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
                    className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${subGenre === genreOption
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
                    onChange={(e) => handleFieldChange('customSubGenre', e.target.value, setCustomSubGenre)}
                    onBlur={() => handleFieldBlur('customSubGenre')}
                    className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP'] ${errors.customSubGenre ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    placeholder="カスタムサブジャンルを入力してください"
                  />
                  {errors.customSubGenre && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 font-['Noto_Sans_JP']">
                      {errors.customSubGenre}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ターゲット読者選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                ターゲット読者
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                    className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${targetReader === target
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
                    onChange={(e) => handleFieldChange('customTargetReader', e.target.value, setCustomTargetReader)}
                    onBlur={() => handleFieldBlur('customTargetReader')}
                    className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP'] ${errors.customTargetReader ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    placeholder="カスタムターゲット読者を入力してください"
                  />
                  {errors.customTargetReader && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 font-['Noto_Sans_JP']">
                      {errors.customTargetReader}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* テーマ選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                テーマ
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${projectTheme === themeOption
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
                    onChange={(e) => handleFieldChange('customTheme', e.target.value, setCustomTheme)}
                    onBlur={() => handleFieldBlur('customTheme')}
                    className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent font-['Noto_Sans_JP'] ${errors.customTheme ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    placeholder="カスタムテーマを入力してください"
                  />
                  {errors.customTheme && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 font-['Noto_Sans_JP']">
                      {errors.customTheme}
                    </p>
                  )}
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
                    <OptimizedImage
                      src={previewUrl}
                      alt="プレビュー"
                      className="w-full h-32 rounded-lg mx-auto"
                      lazy={false}
                      quality={0.8}
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
          </div>
        )}

        {activeTab === 'style' && (
          <div
            id="style-tabpanel"
            role="tabpanel"
            aria-labelledby="style-tab"
            className="space-y-6"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">
                これらの設定は、AIによる文章生成時に使用されます。設定しない場合はデフォルト値が使用されます。
              </p>
            </div>

            {/* 基本文体 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                基本文体
              </label>
              <select
                value={styleData.style}
                onChange={(e) => setStyleData({ ...styleData, style: e.target.value, customStyle: e.target.value === 'その他' ? styleData.customStyle : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">デフォルト（現代小説風）</option>
                {STYLE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {styleData.style === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customStyle}
                    onChange={(e) => setStyleData({ ...styleData, customStyle: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタム基本文体を入力してください"
                  />
                </div>
              )}
            </div>

            {/* 人称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                人称
              </label>
              <select
                value={styleData.perspective}
                onChange={(e) => setStyleData({ ...styleData, perspective: e.target.value, customPerspective: e.target.value === 'その他' ? styleData.customPerspective : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">指定なし</option>
                {PERSPECTIVE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="その他">その他</option>
              </select>
              {styleData.perspective === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customPerspective}
                    onChange={(e) => setStyleData({ ...styleData, customPerspective: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタム人称を入力してください"
                  />
                </div>
              )}
            </div>

            {/* 硬軟 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                硬軟
              </label>
              <select
                value={styleData.formality}
                onChange={(e) => setStyleData({ ...styleData, formality: e.target.value, customFormality: e.target.value === 'その他' ? styleData.customFormality : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">指定なし</option>
                {FORMALITY_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="その他">その他</option>
              </select>
              {styleData.formality === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customFormality}
                    onChange={(e) => setStyleData({ ...styleData, customFormality: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタム硬軟を入力してください"
                  />
                </div>
              )}
            </div>

            {/* リズム */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                リズム
              </label>
              <select
                value={styleData.rhythm}
                onChange={(e) => setStyleData({ ...styleData, rhythm: e.target.value, customRhythm: e.target.value === 'その他' ? styleData.customRhythm : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">指定なし</option>
                {RHYTHM_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="その他">その他</option>
              </select>
              {styleData.rhythm === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customRhythm}
                    onChange={(e) => setStyleData({ ...styleData, customRhythm: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタムリズムを入力してください"
                  />
                </div>
              )}
            </div>

            {/* 比喩表現 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                比喩表現
              </label>
              <select
                value={styleData.metaphor}
                onChange={(e) => setStyleData({ ...styleData, metaphor: e.target.value, customMetaphor: e.target.value === 'その他' ? styleData.customMetaphor : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">指定なし</option>
                {METAPHOR_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="その他">その他</option>
              </select>
              {styleData.metaphor === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customMetaphor}
                    onChange={(e) => setStyleData({ ...styleData, customMetaphor: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタム比喩表現を入力してください"
                  />
                </div>
              )}
            </div>

            {/* 会話比率 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                会話比率
              </label>
              <select
                value={styleData.dialogue}
                onChange={(e) => setStyleData({ ...styleData, dialogue: e.target.value, customDialogue: e.target.value === 'その他' ? styleData.customDialogue : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">指定なし</option>
                {DIALOGUE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="その他">その他</option>
              </select>
              {styleData.dialogue === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customDialogue}
                    onChange={(e) => setStyleData({ ...styleData, customDialogue: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタム会話比率を入力してください"
                  />
                </div>
              )}
            </div>

            {/* 感情描写 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                感情描写
              </label>
              <select
                value={styleData.emotion}
                onChange={(e) => setStyleData({ ...styleData, emotion: e.target.value, customEmotion: e.target.value === 'その他' ? styleData.customEmotion : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">指定なし</option>
                {EMOTION_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="その他">その他</option>
              </select>
              {styleData.emotion === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customEmotion}
                    onChange={(e) => setStyleData({ ...styleData, customEmotion: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタム感情描写を入力してください"
                  />
                </div>
              )}
            </div>

            {/* トーン */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                トーン
              </label>
              <select
                value={styleData.tone}
                onChange={(e) => setStyleData({ ...styleData, tone: e.target.value, customTone: e.target.value === 'その他' ? styleData.customTone : '' })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                <option value="">指定なし</option>
                {TONE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                <option value="その他">その他</option>
              </select>
              {styleData.tone === 'その他' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={styleData.customTone}
                    onChange={(e) => setStyleData({ ...styleData, customTone: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    placeholder="カスタムトーンを入力してください"
                  />
                </div>
              )}
            </div>
          </div>
        )}

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
    </Modal>
  );
};