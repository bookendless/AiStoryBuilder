import React, { useState, useRef, useEffect } from 'react';
import { X, Edit3, Save, Upload, Image } from 'lucide-react';
import { Project } from '../contexts/ProjectContext';
import { useProject } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import { databaseService } from '../services/databaseService';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';
import { OptimizedImage } from './OptimizedImage';

// ジャンル選択オプション
const GENRES = [
  '一般小説', '恋愛小説', 'ミステリー', 'SF', 'ファンタジー', 'ホラー', 'コメディ', 'アクション', 'サスペンス', 'その他'
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

// 文体オプション
const STYLE_OPTIONS = [
  '現代小説風', '文語調', '口語的', '詩的', '簡潔', '詳細', 'その他'
];

const PERSPECTIVE_OPTIONS = [
  '一人称', '三人称', '神の視点'
];

const FORMALITY_OPTIONS = [
  '硬め', '柔らかめ', '口語的', '文語的'
];

const RHYTHM_OPTIONS = [
  '短文中心', '長短混合', '流れるような長文'
];

const METAPHOR_OPTIONS = [
  '多用', '控えめ', '詩的', '写実的'
];

const DIALOGUE_OPTIONS = [
  '会話多め', '描写重視', 'バランス型'
];

const EMOTION_OPTIONS = [
  '内面重視', '行動で示す', '抑制的'
];

const TONE_OPTIONS = [
  '緊張感', '穏やか', '希望', '切なさ', '謎めいた'
];

interface ProjectSettingsModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  project,
  onClose,
}) => {
  const { projects, setProjects, currentProject, setCurrentProject } = useProject();
  const { showSuccess, showError } = useToast();
  const { modalRef } = useModalNavigation({ isOpen, onClose });
  const [activeTab, setActiveTab] = useState<'basic' | 'style'>('basic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: '',
    mainGenre: '',
    subGenre: '',
    targetReader: '',
    projectTheme: '',
    coverImage: '',
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
  });

  // プロジェクトデータをフォームに読み込む
  useEffect(() => {
    if (isOpen && project) {
      const mainGenre = project.mainGenre || project.genre || '';
      const subGenre = project.subGenre || '';
      const targetReader = project.targetReader || '';
      const projectTheme = project.projectTheme || '';
      
      const customMainGenre = project.customMainGenre || '';
      const customSubGenre = project.customSubGenre || '';
      const customTargetReader = project.customTargetReader || '';
      const customTheme = project.customTheme || '';
      
      setFormData({
        title: project.title,
        description: project.description,
        genre: mainGenre,
        mainGenre: customMainGenre ? 'その他' : mainGenre,
        subGenre: customSubGenre ? 'その他' : subGenre,
        targetReader: customTargetReader ? 'その他' : targetReader,
        projectTheme: customTheme ? 'その他' : projectTheme,
        coverImage: project.coverImage || '',
        customMainGenre: customMainGenre,
        customSubGenre: customSubGenre,
        customTargetReader: customTargetReader,
        customTheme: customTheme,
      });

      setStyleData({
        style: project.writingStyle?.style || '',
        perspective: project.writingStyle?.perspective || '',
        formality: project.writingStyle?.formality || '',
        rhythm: project.writingStyle?.rhythm || '',
        metaphor: project.writingStyle?.metaphor || '',
        dialogue: project.writingStyle?.dialogue || '',
        emotion: project.writingStyle?.emotion || '',
        tone: project.writingStyle?.tone || '',
      });

      setPreviewUrl(project.coverImage || null);
      setActiveTab('basic');
    }
  }, [isOpen, project]);

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

    if (!file.type.startsWith('image/')) {
      showError('画像ファイルを選択してください。', 5000);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('ファイルサイズは10MB以下にしてください。', 5000);
      return;
    }

    const base64 = await fileToBase64(file);
    setPreviewUrl(base64);
    setFormData(prev => ({ ...prev, coverImage: base64 }));
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    setPreviewUrl(null);
    setFormData(prev => ({ ...prev, coverImage: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 保存処理
  const handleSave = async () => {
    if (!project) return;

    try {
      const updatedProject: Project = {
        ...project,
        title: formData.title,
        description: formData.description,
        genre: formData.mainGenre === 'その他' ? formData.customMainGenre : formData.mainGenre,
        mainGenre: formData.mainGenre === 'その他' ? formData.customMainGenre : formData.mainGenre,
        subGenre: formData.subGenre === 'その他' ? formData.customSubGenre : formData.subGenre,
        targetReader: formData.targetReader === 'その他' ? formData.customTargetReader : formData.targetReader,
        projectTheme: formData.projectTheme === 'その他' ? formData.customTheme : formData.projectTheme,
        coverImage: formData.coverImage,
        customMainGenre: formData.customMainGenre,
        customSubGenre: formData.customSubGenre,
        customTargetReader: formData.customTargetReader,
        customTheme: formData.customTheme,
        writingStyle: {
          style: styleData.style || undefined,
          perspective: styleData.perspective || undefined,
          formality: styleData.formality || undefined,
          rhythm: styleData.rhythm || undefined,
          metaphor: styleData.metaphor || undefined,
          dialogue: styleData.dialogue || undefined,
          emotion: styleData.emotion || undefined,
          tone: styleData.tone || undefined,
        },
        updatedAt: new Date(),
      };

      await databaseService.saveProject(updatedProject);
      
      const updatedProjects = projects.map((p: Project) => 
        p.id === updatedProject.id ? updatedProject : p
      );
      setProjects(updatedProjects);
      
      if (currentProject?.id === project.id) {
        setCurrentProject(updatedProject);
      }
      
      showSuccess('プロジェクトを更新しました。', 3000);
      onClose();
    } catch (error) {
      console.error('Update error:', error);
      showError('更新に失敗しました。', 7000);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg">
                <Edit3 className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                プロジェクト設定
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* タブナビゲーション */}
          <div className="mt-4 flex space-x-1 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'basic'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              } font-['Noto_Sans_JP']`}
            >
              基本情報
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'style'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              } font-['Noto_Sans_JP']`}
            >
              文体設定
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* プロジェクトタイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  プロジェクトタイトル
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="プロジェクトのタイトルを入力"
                />
              </div>

              {/* プロジェクト説明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  プロジェクト説明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="プロジェクトの説明を入力"
                />
              </div>

              {/* メインジャンル選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                  メインジャンル <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GENRES.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        if (formData.mainGenre !== genre) {
                          setFormData({ ...formData, mainGenre: genre, customMainGenre: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        formData.mainGenre === genre
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                      } font-['Noto_Sans_JP']`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
                {formData.mainGenre === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customMainGenre}
                      onChange={(e) => setFormData({ ...formData, customMainGenre: e.target.value })}
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
                  {GENRES.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        if (formData.subGenre === genre) {
                          setFormData({ ...formData, subGenre: '', customSubGenre: '' });
                        } else {
                          setFormData({ ...formData, subGenre: genre, customSubGenre: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        formData.subGenre === genre
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/50'
                      } font-['Noto_Sans_JP']`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
                {formData.subGenre === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customSubGenre}
                      onChange={(e) => setFormData({ ...formData, customSubGenre: e.target.value })}
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
                        if (formData.targetReader === target) {
                          setFormData({ ...formData, targetReader: '', customTargetReader: '' });
                        } else {
                          setFormData({ ...formData, targetReader: target, customTargetReader: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        formData.targetReader === target
                          ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/50'
                      } font-['Noto_Sans_JP']`}
                    >
                      {target}
                    </button>
                  ))}
                </div>
                {formData.targetReader === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customTargetReader}
                      onChange={(e) => setFormData({ ...formData, customTargetReader: e.target.value })}
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
                  {THEMES.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => {
                        if (formData.projectTheme === theme) {
                          setFormData({ ...formData, projectTheme: '', customTheme: '' });
                        } else {
                          setFormData({ ...formData, projectTheme: theme, customTheme: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        formData.projectTheme === theme
                          ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/50'
                      } font-['Noto_Sans_JP']`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                {formData.projectTheme === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={formData.customTheme}
                      onChange={(e) => setFormData({ ...formData, customTheme: e.target.value })}
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
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm font-['Noto_Sans_JP']"
                        >
                          <Upload className="h-4 w-4 inline mr-1" />
                          変更
                        </button>
                        <button
                          type="button"
                          onClick={handleClearFile}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors text-sm font-['Noto_Sans_JP']"
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
            <div className="space-y-6">
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
                  onChange={(e) => setStyleData({ ...styleData, style: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">デフォルト（現代小説風）</option>
                  {STYLE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 人称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  人称
                </label>
                <select
                  value={styleData.perspective}
                  onChange={(e) => setStyleData({ ...styleData, perspective: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">指定なし</option>
                  {PERSPECTIVE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 硬軟 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  硬軟
                </label>
                <select
                  value={styleData.formality}
                  onChange={(e) => setStyleData({ ...styleData, formality: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">指定なし</option>
                  {FORMALITY_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* リズム */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  リズム
                </label>
                <select
                  value={styleData.rhythm}
                  onChange={(e) => setStyleData({ ...styleData, rhythm: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">指定なし</option>
                  {RHYTHM_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 比喩表現 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  比喩表現
                </label>
                <select
                  value={styleData.metaphor}
                  onChange={(e) => setStyleData({ ...styleData, metaphor: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">指定なし</option>
                  {METAPHOR_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 会話比率 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  会話比率
                </label>
                <select
                  value={styleData.dialogue}
                  onChange={(e) => setStyleData({ ...styleData, dialogue: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">指定なし</option>
                  {DIALOGUE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 感情描写 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  感情描写
                </label>
                <select
                  value={styleData.emotion}
                  onChange={(e) => setStyleData({ ...styleData, emotion: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">指定なし</option>
                  {EMOTION_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* トーン */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  トーン
                </label>
                <select
                  value={styleData.tone}
                  onChange={(e) => setStyleData({ ...styleData, tone: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">指定なし</option>
                  {TONE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
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
    </div>
  );
};

