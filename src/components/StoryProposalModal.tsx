import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Sparkles } from 'lucide-react';
import { Step } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { Modal } from './common/Modal';
import { useOverlayBackHandler } from '../contexts/BackButtonContext';
import { StoryProposal } from '../utils/storyProposalParser';
import { useToast } from './Toast';

interface StoryProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStep: (step: Step) => void;
  proposal: StoryProposal | null;
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

export const StoryProposalModal: React.FC<StoryProposalModalProps> = ({
  isOpen,
  onClose,
  onNavigateToStep,
  proposal,
}) => {
  const { createNewProject } = useProject();
  const { showError, showSuccess } = useToast();

  // Android戻るボタン対応
  useOverlayBackHandler(isOpen, onClose, 'story-proposal-modal', 90);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainGenre, setMainGenre] = useState('');
  const [subGenre, setSubGenre] = useState('');
  const [targetReader, setTargetReader] = useState('');
  const [projectTheme, setProjectTheme] = useState('');
  const [customMainGenre, setCustomMainGenre] = useState('');
  const [customSubGenre, setCustomSubGenre] = useState('');
  const [customTargetReader, setCustomTargetReader] = useState('');
  const [customTheme, setCustomTheme] = useState('');

  // プロジェクト提案が変更されたときにフォームを更新
  useEffect(() => {
    if (proposal) {
      setTitle(proposal.title || '');
      setDescription(proposal.description || '');
      setMainGenre(proposal.mainGenre || '');
      setSubGenre(proposal.subGenre || '');
      setTargetReader(proposal.targetReader || '');
      setProjectTheme(proposal.theme || '');
      setCustomMainGenre('');
      setCustomSubGenre('');
      setCustomTargetReader('');
      setCustomTheme('');
    }
  }, [proposal]);

  // モーダルが閉じられたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setMainGenre('');
      setSubGenre('');
      setTargetReader('');
      setProjectTheme('');
      setCustomMainGenre('');
      setCustomSubGenre('');
      setCustomTargetReader('');
      setCustomTheme('');
    }
  }, [isOpen]);

  // 基本情報ステップの完了度を計算
  const getBasicStepProgress = (): number => {
    let completed = 0;
    const total = 2; // 必須項目数

    if (title.trim()) completed++;
    if (mainGenre) {
      if (mainGenre === 'その他') {
        if (customMainGenre.trim()) {
          completed++;
        }
      } else {
        completed++;
      }
    }

    return total > 0 ? (completed / total) * 100 : 0;
  };

  const basicProgress = getBasicStepProgress();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !mainGenre) {
      showError('タイトルとメインジャンルは必須です。', 5000, {
        title: 'バリデーションエラー',
      });
      return;
    }

    if (!proposal) {
      showError('プロジェクト提案が見つかりません。', 5000, {
        title: 'エラー',
      });
      return;
    }

    const finalMainGenre = mainGenre === 'その他' ? customMainGenre : mainGenre;
    const finalSubGenre = subGenre === 'その他' ? customSubGenre : subGenre;
    const finalTargetReader = targetReader === 'その他' ? customTargetReader : targetReader;
    const finalTheme = projectTheme === 'その他' ? customTheme : projectTheme;

    // デバッグ: あらすじの値を確認
    console.log('プロジェクト作成時のあらすじ:', proposal.synopsis);
    console.log('あらすじの長さ:', proposal.synopsis?.length || 0);

    createNewProject(
      title.trim(),
      description.trim(),
      finalMainGenre,
      finalSubGenre,
      '', // カバー画像はなし
      finalTargetReader,
      finalTheme,
      undefined, // 文体設定はなし
      proposal.synopsis || '' // あらすじ
    );
    showSuccess('プロジェクトを作成しました！', 3000);
    onNavigateToStep('character');
    onClose();
  };

  if (!isOpen || !proposal) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
            <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <span>AIが提案した物語プロジェクト</span>
        </div>
      }
      size="md"
    >
      <div className="space-y-6">
        {/* ステップインジケーター */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 flex-1">
              <div className="flex items-center space-x-2">
                {basicProgress === 100 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm font-medium font-['Noto_Sans_JP'] text-indigo-600 dark:text-indigo-400">
                  基本情報
                </span>
              </div>
              <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 mx-2">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-300"
                  style={{ width: `${basicProgress}%` }}
                />
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center font-['Noto_Sans_JP']">
            完了度: {Math.round(basicProgress)}%
          </div>
        </div>

        {/* AI分析結果の表示 */}
        {(proposal.imageAnalysis || proposal.audioAnalysis) && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2 font-['Noto_Sans_JP']">
              AI分析結果
            </h3>
            {proposal.imageAnalysis && (
              <p className="text-sm text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">
                {proposal.imageAnalysis}
              </p>
            )}
            {proposal.audioAnalysis && (
              <p className="text-sm text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">
                {proposal.audioAnalysis}
              </p>
            )}
            {proposal.transcription && (
              <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1 font-['Noto_Sans_JP']">
                  文字起こし:
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">
                  {proposal.transcription}
                </p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* タイトル */}
          <div>
            <label htmlFor="proposal-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              プロジェクトタイトル <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="proposal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：異世界転生物語"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-['Noto_Sans_JP']"
              required
            />
          </div>

          {/* 説明 */}
          <div>
            <label htmlFor="proposal-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              プロジェクトの説明
            </label>
            <textarea
              id="proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このプロジェクトの概要や目標を簡単に説明してください..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-['Noto_Sans_JP']"
            />
          </div>

          {/* あらすじ */}
          <div>
            <label htmlFor="proposal-synopsis" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              あらすじ
            </label>
            <textarea
              id="proposal-synopsis"
              value={proposal.synopsis}
              readOnly
              rows={5}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-['Noto_Sans_JP']"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
              AIが生成したあらすじです。プロジェクト作成後、編集できます。
            </p>
          </div>

          {/* メインジャンル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              メインジャンル <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((genreOption) => (
                <button
                  key={genreOption}
                  type="button"
                  onClick={() => {
                    setMainGenre(genreOption);
                    setCustomMainGenre('');
                  }}
                  className={`p-2 rounded-lg text-sm transition-colors font-['Noto_Sans_JP'] ${mainGenre === genreOption
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
                  onChange={(e) => setCustomSubGenre(e.target.value)}
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
                  onChange={(e) => setCustomTargetReader(e.target.value)}
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
                  onChange={(e) => setCustomTheme(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent font-['Noto_Sans_JP']"
                  placeholder="カスタムテーマを入力してください"
                />
              </div>
            )}
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
    </Modal>
  );
};


