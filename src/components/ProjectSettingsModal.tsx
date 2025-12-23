import React, { useState, useRef, useEffect } from 'react';
import { X, Edit3, Save, Upload, Image } from 'lucide-react';
import { useProject, Project } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import { databaseService } from '../services/databaseService';
import { OptimizedImage } from './OptimizedImage';
import { Modal } from './common/Modal';
import { compressImage } from '../utils/performanceUtils';
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

// ジャンル選択オプション（新規作成画面と共通）
const GENRES = [
  '一般小説', '恋愛小説', 'ミステリー', 'SF', 'ファンタジー', 'ホラー',
  'コメディ', 'アクション', 'サスペンス', 'その他'
];

// ターゲット読者オプション
const TARGET_READERS = [
  '10代', '20代', '30代', '40代以上', '全年齢', 'その他'
];

// テーマオプション
const THEMES = [
  '成長・自己発見', '友情・絆', '恋愛・愛', '家族・親子', '正義・道徳',
  '復讐・救済', '冒険・探検', '戦争・平和', '死・生', '希望・夢', '孤独・疎外感', 'その他'
];

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const { projects, setProjects, currentProject: globalCurrentProject, setCurrentProject } = useProject();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'basic' | 'style'>('basic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const targetProject = project || globalCurrentProject;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coverImage: undefined as string | undefined,
    mainGenre: '',
    subGenre: '',
    targetReader: '',
    projectTheme: '',
    customMainGenre: '',
    customSubGenre: '',
    customTargetReader: '',
    customTheme: '',
  });

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

  const resolveSelection = (
    value: string | undefined,
    options: readonly string[],
    customValue?: string
  ) => {
    const actualValue = customValue || value || '';
    if (!actualValue) {
      return { selected: '', custom: '' };
    }
    if (options.includes(actualValue)) {
      return { selected: actualValue, custom: '' };
    }
    return { selected: 'その他', custom: actualValue };
  };

  useEffect(() => {
    if (isOpen && targetProject) {
      const main = resolveSelection(
        targetProject.mainGenre || targetProject.genre,
        GENRES,
        targetProject.customMainGenre
      );
      const sub = resolveSelection(
        targetProject.subGenre,
        GENRES,
        targetProject.customSubGenre
      );
      const target = resolveSelection(
        targetProject.targetReader,
        TARGET_READERS,
        targetProject.customTargetReader
      );
      const theme = resolveSelection(
        targetProject.projectTheme,
        THEMES,
        targetProject.customTheme
      );

      setFormData({
        title: targetProject.title,
        description: targetProject.description,
        coverImage: targetProject.coverImage,
        mainGenre: main.selected,
        subGenre: sub.selected,
        targetReader: target.selected,
        projectTheme: theme.selected,
        customMainGenre: main.custom,
        customSubGenre: sub.custom,
        customTargetReader: target.custom,
        customTheme: theme.custom,
      });
      setPreviewUrl(targetProject.coverImage || null);

      if (targetProject.writingStyle) {
        // 文体設定の各項目について、既存の値が選択肢に含まれているかチェック
        const style = resolveSelection(
          targetProject.writingStyle.style,
          STYLE_OPTIONS,
          targetProject.writingStyle.customStyle
        );
        const perspective = resolveSelection(
          targetProject.writingStyle.perspective,
          PERSPECTIVE_OPTIONS,
          targetProject.writingStyle.customPerspective
        );
        const formality = resolveSelection(
          targetProject.writingStyle.formality,
          FORMALITY_OPTIONS,
          targetProject.writingStyle.customFormality
        );
        const rhythm = resolveSelection(
          targetProject.writingStyle.rhythm,
          RHYTHM_OPTIONS,
          targetProject.writingStyle.customRhythm
        );
        const metaphor = resolveSelection(
          targetProject.writingStyle.metaphor,
          METAPHOR_OPTIONS,
          targetProject.writingStyle.customMetaphor
        );
        const dialogue = resolveSelection(
          targetProject.writingStyle.dialogue,
          DIALOGUE_OPTIONS,
          targetProject.writingStyle.customDialogue
        );
        const emotion = resolveSelection(
          targetProject.writingStyle.emotion,
          EMOTION_OPTIONS,
          targetProject.writingStyle.customEmotion
        );
        const tone = resolveSelection(
          targetProject.writingStyle.tone,
          TONE_OPTIONS,
          targetProject.writingStyle.customTone
        );

        setStyleData({
          style: style.selected,
          perspective: perspective.selected,
          formality: formality.selected,
          rhythm: rhythm.selected,
          metaphor: metaphor.selected,
          dialogue: dialogue.selected,
          emotion: emotion.selected,
          tone: tone.selected,
          customStyle: style.custom,
          customPerspective: perspective.custom,
          customFormality: formality.custom,
          customRhythm: rhythm.custom,
          customMetaphor: metaphor.custom,
          customDialogue: dialogue.custom,
          customEmotion: emotion.custom,
          customTone: tone.custom,
        });
      } else {
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
      }
    }
  }, [isOpen, targetProject]);

  const computeFinalValue = (selected: string, custom: string) => {
    if (!selected) return undefined;
    if (selected === 'その他') {
      return custom.trim() || undefined;
    }
    return selected;
  };

  const handleSave = async () => {
    if (!targetProject) return;
    if (!formData.title.trim()) {
      showError('タイトルを入力してください');
      return;
    }

    if (!formData.mainGenre) {
      showError('メインジャンルを選択してください');
      return;
    }
    if (formData.mainGenre === 'その他' && !formData.customMainGenre.trim()) {
      showError('メインジャンルのカスタム値を入力してください');
      return;
    }
    const finalMainGenre = computeFinalValue(formData.mainGenre, formData.customMainGenre);
    const finalSubGenre = computeFinalValue(formData.subGenre, formData.customSubGenre);
    const finalTargetReader = computeFinalValue(formData.targetReader, formData.customTargetReader);
    const finalProjectTheme = computeFinalValue(formData.projectTheme, formData.customTheme);

    try {
      // 文体設定を構築（「その他」が選択されている場合はカスタム値を使用）
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
      const hasAnyValue = Object.values(writingStyle).some(v => v !== undefined);
      const finalWritingStyle = hasAnyValue ? writingStyle : undefined;

      const updatedProject = {
        ...targetProject,
        title: formData.title.trim(),
        description: formData.description,
        coverImage: formData.coverImage,
        genre: finalMainGenre || targetProject.genre || '',
        mainGenre: finalMainGenre,
        subGenre: finalSubGenre,
        targetReader: finalTargetReader,
        projectTheme: finalProjectTheme,
        customMainGenre: formData.mainGenre === 'その他' ? formData.customMainGenre.trim() : '',
        customSubGenre: formData.subGenre === 'その他' ? formData.customSubGenre.trim() : '',
        customTargetReader: formData.targetReader === 'その他' ? formData.customTargetReader.trim() : '',
        customTheme: formData.projectTheme === 'その他' ? formData.customTheme.trim() : '',
        writingStyle: finalWritingStyle,
        updatedAt: new Date(),
      };

      await databaseService.saveProject(updatedProject);

      const updatedProjects = projects.map(p =>
        p.id === targetProject.id ? updatedProject : p
      );

      setProjects(updatedProjects);

      if (globalCurrentProject && globalCurrentProject.id === targetProject.id) {
        setCurrentProject(updatedProject);
      }

      showSuccess('プロジェクト設定を保存しました');
      onClose();
    } catch (error) {
      console.error('Failed to update project:', error);
      showError('保存に失敗しました');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showError('ファイルサイズは10MB以下にしてください');
        return;
      }

      try {
        // 画像を圧縮（1920x1080、quality 0.8）
        const compressedBlob = await compressImage(file, 1920, 1080, 0.8);
        
        // 圧縮されたBlobをBase64に変換
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setPreviewUrl(result);
          setFormData(prev => ({ ...prev, coverImage: result }));
        };
        reader.readAsDataURL(compressedBlob);
      } catch (error) {
        console.error('画像の圧縮エラー:', error);
        // エラーの場合は元のファイルをBase64に変換
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setPreviewUrl(result);
          setFormData(prev => ({ ...prev, coverImage: result }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    setPreviewUrl(null);
    setFormData(prev => ({ ...prev, coverImage: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen || !targetProject) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg">
            <Edit3 className="h-6 w-6 text-white" />
          </div>
          <span>プロジェクト設定</span>
        </div>
      }
      size="lg"
    >
      <div className="flex flex-col h-full">
        {/* タブナビゲーション */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'basic'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              基本設定
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'style'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              文体設定
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'basic' && (
            <div 
              id="basic-tabpanel"
              role="tabpanel"
              aria-labelledby="basic-tab"
              className="space-y-6"
            >
              {/* プロジェクトタイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  プロジェクトタイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="例: 魔法使いの弟子"
                />
              </div>

              {/* 概要 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  概要
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="物語の簡単なあらすじやアイデアを入力してください"
                />
              </div>

              {/* メインジャンル */}
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
                        setFormData(prev => {
                          if (prev.mainGenre === genreOption) {
                            return prev;
                          }
                          return {
                            ...prev,
                            mainGenre: genreOption,
                            customMainGenre: '',
                          };
                        });
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${formData.mainGenre === genreOption
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                        }`}
                    >
                      {genreOption}
                    </button>
                  ))}
                </div>
                {formData.mainGenre === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customMainGenre}
                      onChange={(e) => setFormData(prev => ({ ...prev, customMainGenre: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP']"
                      placeholder="カスタムジャンルを入力してください"
                    />
                  </div>
                )}
              </div>

              {/* サブジャンル */}
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
                        setFormData(prev => {
                          const isSame = prev.subGenre === genreOption;
                          const shouldClearCustom = genreOption !== 'その他' || isSame;
                          return {
                            ...prev,
                            subGenre: isSame ? '' : genreOption,
                            customSubGenre: shouldClearCustom ? '' : prev.customSubGenre,
                          };
                        });
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${formData.subGenre === genreOption
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/50'
                        }`}
                    >
                      {genreOption}
                    </button>
                  ))}
                </div>
                {formData.subGenre === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customSubGenre}
                      onChange={(e) => setFormData(prev => ({ ...prev, customSubGenre: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP']"
                      placeholder="カスタムサブジャンルを入力してください"
                    />
                  </div>
                )}
              </div>

              {/* ターゲット読者 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                  ターゲット読者
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TARGET_READERS.map((targetOption) => (
                    <button
                      key={targetOption}
                      type="button"
                      onClick={() => {
                        setFormData(prev => {
                          const isSame = prev.targetReader === targetOption;
                          const shouldClearCustom = targetOption !== 'その他' || isSame;
                          return {
                            ...prev,
                            targetReader: isSame ? '' : targetOption,
                            customTargetReader: shouldClearCustom ? '' : prev.customTargetReader,
                          };
                        });
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${formData.targetReader === targetOption
                          ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/50'
                        }`}
                    >
                      {targetOption}
                    </button>
                  ))}
                </div>
                {formData.targetReader === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customTargetReader}
                      onChange={(e) => setFormData(prev => ({ ...prev, customTargetReader: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP']"
                      placeholder="カスタムターゲット読者を入力してください"
                    />
                  </div>
                )}
              </div>

              {/* テーマ */}
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
                        setFormData(prev => {
                          const isSame = prev.projectTheme === themeOption;
                          const shouldClearCustom = themeOption !== 'その他' || isSame;
                          return {
                            ...prev,
                            projectTheme: isSame ? '' : themeOption,
                            customTheme: shouldClearCustom ? '' : prev.customTheme,
                          };
                        });
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${formData.projectTheme === themeOption
                          ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/50'
                        }`}
                    >
                      {themeOption}
                    </button>
                  ))}
                </div>
                {formData.projectTheme === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customTheme}
                      onChange={(e) => setFormData(prev => ({ ...prev, customTheme: e.target.value }))}
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
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  {previewUrl ? (
                    <div className="w-full space-y-4">
                      <OptimizedImage
                        src={previewUrl}
                        alt="Cover preview"
                        className="h-48 w-auto object-cover rounded-lg shadow-md mx-auto"
                      />
                      <div className="flex flex-wrap justify-center gap-3">
                        <button
                          type="button"
                          onClick={handleSelectFile}
                          className="flex items-center gap-1 px-4 py-2 rounded-full bg-white shadow-md text-blue-600 border border-blue-200 hover:bg-blue-50 font-['Noto_Sans_JP'] text-sm transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          変更
                        </button>
                        <button
                          type="button"
                          onClick={handleClearFile}
                          className="flex items-center gap-1 px-4 py-2 rounded-full bg-white shadow-md text-red-600 border border-red-200 hover:bg-red-50 font-['Noto_Sans_JP'] text-sm transition-colors"
                        >
                          <X className="h-4 w-4" />
                          削除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-center">
                      <Image className="h-12 w-12 text-gray-400 mx-auto" />
                      <div>
                        <button
                          type="button"
                          onClick={handleSelectFile}
                          className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors font-['Noto_Sans_JP']"
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
        </div>

        {/* フッター */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] flex items-center justify-center"
            >
              <Save className="h-4 w-4 mr-2" />
              保存
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
