import React, { useState, useRef, useEffect } from 'react';
import { X, Edit3, Save, Upload, Image } from 'lucide-react';
import { useProject, Project } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import { databaseService } from '../services/databaseService';
import { OptimizedImage } from './OptimizedImage';
import { Modal } from './common/Modal';

// ジャンル選択オプション
const GENRES = [
  'ファンタジー', 'SF', 'ミステリー', '恋愛', 'ホラー',
  '歴史', '現代ドラマ', 'コメディ', 'アクション', '冒険',
  '青春', '童話', 'エッセイ', 'その他'
];

// 文体オプション
const STYLE_OPTIONS = [
  '現代小説風', 'ライトノベル風', '純文学風', '児童文学風',
  'ハードボイルド', '幻想的', 'コミカル', 'シリアス'
];

// 人称オプション
const PERSPECTIVE_OPTIONS = ['一人称（私/僕/俺）', '三人称（彼/彼女）', '神の視点'];

// 硬軟オプション
const FORMALITY_OPTIONS = ['硬め', '普通', '柔らかめ'];

// リズムオプション
const RHYTHM_OPTIONS = ['ゆったり', '普通', 'テンポよく'];

// 比喩表現オプション
const METAPHOR_OPTIONS = ['多め', '普通', '少なめ'];

// 会話比率オプション
const DIALOGUE_OPTIONS = ['多め', '普通', '少なめ'];

// 感情描写オプション
const EMOTION_OPTIONS = ['豊か', '普通', '控えめ'];

// トーンオプション
const TONE_OPTIONS = ['明るい', '普通', '暗い', '緊迫感', '穏やか'];

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
    genre: '',
    coverImage: undefined as string | undefined,
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

  useEffect(() => {
    if (isOpen && targetProject) {
      setFormData({
        title: targetProject.title,
        description: targetProject.description,
        genre: targetProject.genre || '',
        coverImage: targetProject.coverImage,
      });
      setPreviewUrl(targetProject.coverImage || null);

      if (targetProject.writingStyle) {
        setStyleData({
          style: targetProject.writingStyle.style || '',
          perspective: targetProject.writingStyle.perspective || '',
          formality: targetProject.writingStyle.formality || '',
          rhythm: targetProject.writingStyle.rhythm || '',
          metaphor: targetProject.writingStyle.metaphor || '',
          dialogue: targetProject.writingStyle.dialogue || '',
          emotion: targetProject.writingStyle.emotion || '',
          tone: targetProject.writingStyle.tone || '',
        });
      }
    }
  }, [isOpen, targetProject]);

  const handleSave = async () => {
    if (!targetProject) return;
    if (!formData.title.trim()) {
      showError('タイトルを入力してください');
      return;
    }

    try {
      const updatedProject = {
        ...targetProject,
        ...formData,
        writingStyle: styleData,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showError('ファイルサイズは10MB以下にしてください');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewUrl(result);
        setFormData(prev => ({ ...prev, coverImage: result }));
      };
      reader.readAsDataURL(file);
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
            <div className="space-y-6">
              {/* プロジェクトタイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  プロジェクトタイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="例: 魔法使いの弟子"
                />
              </div>

              {/* ジャンル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  ジャンル
                </label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                >
                  <option value="">選択してください</option>
                  {GENRES.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              {/* 概要 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  概要
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="物語の簡単なあらすじやアイデアを入力してください"
                />
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
                    <div className="relative group">
                      <OptimizedImage
                        src={previewUrl}
                        alt="Cover preview"
                        className="h-48 w-auto object-cover rounded-lg shadow-md"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
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
    </Modal>
  );
};
