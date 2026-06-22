import React, { useState, useMemo, useEffect } from 'react';
import { Plus, BookOpen, Calendar, TrendingUp, Edit3, Search, Filter, ArrowUpDown, Clock, CheckCircle2, HelpCircle, Sparkles, Image, Mic, Library, FileUp } from 'lucide-react';
import { Step } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { startAutoBackup, stopAutoBackup } from '../services/autoBackupService';
import { AutoBackupStatus } from './common/AutoBackupStatus';
import { NewProjectModal } from './NewProjectModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { ImageToStoryModal } from './ImageToStoryModal';
import { AudioToStoryModal } from './AudioToStoryModal';
import { AudioImageToStoryModal } from './AudioImageToStoryModal';
import { StoryProposalModal } from './StoryProposalModal';
import { SequelComposerModal } from './sequel/SequelComposerModal';
import { StoryImporterModal } from './import/StoryImporterModal';
import { Project } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorHandler';
import { useGlobalShortcuts } from '../hooks/useKeyboardNavigation';
import { ContextHelp } from './ContextHelp';
import { OptimizedImage } from './OptimizedImage';
import { Card } from './common/Card';
import { EmptyState } from './common/EmptyState';
import { SkeletonLoader } from './common/SkeletonLoader';
import { ConfirmDialog } from './common/ConfirmDialog';
import { StoryProposal } from '../utils/storyProposalParser';

// プロジェクトカードコンポーネント（メモ化）
interface ProjectCardProps {
  project: Project;
  progress: { percentage: number; completedSteps: number; totalSteps: number; nextStep?: string };
  onSelect: (project: Project) => void;
  onEdit: (e: React.MouseEvent, project: Project) => void;
  onDuplicate: (e: React.MouseEvent, projectId: string) => void;
  onDelete: (e: React.MouseEvent, projectId: string) => void;
  isLoading: boolean;
  parentTitle?: string;
}

const ProjectCard = React.memo<ProjectCardProps>(({
  project,
  progress,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  isLoading,
  parentTitle
}) => {
  return (
    <Card
      onClick={() => onSelect(project)}
      className="p-4 sm:p-6 hover:scale-[1.02] transition-all duration-200 relative group border-usuzumi-200 dark:border-usuzumi-700 cursor-pointer hover:shadow-lg dark:hover:shadow-xl hover:shadow-usuzumi-300/50 dark:hover:shadow-sumi-900/50"
      hoverEffect={true}
    >
      {/* 表紙画像 - 書籍の標準比率(3:4)でcover表示 */}
      {project.coverImage && (
        <div className="mb-4">
          <div className="w-full aspect-[3/4] rounded-lg glass-bg-only overflow-hidden">
            <OptimizedImage
              src={project.coverImage}
              alt={project.title}
              className="w-full h-full"
              objectFit="cover"
              lazy={true}
              quality={0.8}
            />
          </div>
        </div>
      )}

      {/* タイトル */}
      <div className="mb-3">
        {parentTitle && (
          <span className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-xs rounded-full font-['Noto_Sans_JP']">
            <Library className="h-3 w-3" />
            「{parentTitle}」の続編
          </span>
        )}
        <h3 className="text-xl font-bold text-sumi-900 dark:text-usuzumi-50 line-clamp-2 font-['Noto_Sans_JP']">
          {project.title}
        </h3>
      </div>

      {/* 進捗バー + % */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-full bg-usuzumi-200 dark:bg-usuzumi-700 rounded-full h-2 flex-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${progress.percentage === 100
                  ? 'bg-semantic-success'
                  : progress.percentage >= 50
                    ? 'bg-semantic-primary'
                    : 'bg-semantic-warning'
                  }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <span className="inline-flex items-center px-2 py-1 bg-ai-100 dark:bg-ai-900 text-ai-600 dark:text-ai-400 text-xs font-bold rounded-full whitespace-nowrap">
              {progress.percentage.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* 次のステップ */}
      {progress.nextStep && progress.percentage < 100 && (
        <p className="text-xs text-sumi-500 dark:text-usuzumi-400 mb-3 font-['Noto_Sans_JP']">
          次のステップ: {progress.nextStep}
        </p>
      )}

      {/* 最終更新日 */}
      <div className="mb-3">
        <p className="text-sm text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
          最終更新: {project.updatedAt instanceof Date ? project.updatedAt.toLocaleDateString('ja-JP') : new Date(project.updatedAt).toLocaleDateString('ja-JP')}
        </p>
      </div>

      {/* 詳細情報（常に表示） */}
      <div className="space-y-3">
        {/* 説明文 */}
        {project.description && (
          <p className="text-sm text-sumi-600 dark:text-usuzumi-400 line-clamp-2 font-['Noto_Sans_JP']">
            {project.description}
          </p>
        )}

        {/* ジャンル表示 */}
        {(project.mainGenre || project.genre || project.subGenre) && (
          <div className="flex flex-wrap gap-1">
            {project.mainGenre && (
              <span className="inline-block px-2 py-1 bg-mizu-100 dark:bg-mizu-900 text-mizu-600 dark:text-mizu-400 text-xs rounded-full font-['Noto_Sans_JP']">
                メイン: {project.mainGenre}
              </span>
            )}
            {!project.mainGenre && project.genre && (
              <span className="inline-block px-2 py-1 bg-mizu-100 dark:bg-mizu-900 text-mizu-600 dark:text-mizu-400 text-xs rounded-full font-['Noto_Sans_JP']">
                メイン: {project.genre}
              </span>
            )}
            {project.subGenre && (
              <span className="inline-block px-2 py-1 bg-ai-100 dark:bg-ai-900 text-ai-600 dark:text-ai-400 text-xs rounded-full font-['Noto_Sans_JP']">
                サブ: {project.subGenre}
              </span>
            )}
          </div>
        )}

        {/* 進捗詳細 */}
        <div className="flex items-center justify-between text-xs text-sumi-500 dark:text-usuzumi-400">
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3 text-semantic-success" />
            <span>{progress.completedSteps}/{progress.totalSteps} ステップ完了</span>
          </span>
          <span>画像: {project.imageBoard.length} 枚</span>
        </div>

        {/* プロジェクト操作ボタン */}
        <div className="pt-3 border-t border-usuzumi-200 dark:border-usuzumi-700 flex justify-end gap-1 sm:gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e, project);
            }}
            className="p-2 bg-wakagusa-100 dark:bg-wakagusa-900 text-wakagusa-600 dark:text-wakagusa-400 rounded-lg hover:bg-wakagusa-200 dark:hover:bg-wakagusa-800 transition-colors"
            title="プロジェクトを編集"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(e, project.id);
            }}
            className="p-2 bg-mizu-100 dark:bg-mizu-900 text-mizu-600 dark:text-mizu-400 rounded-lg hover:bg-mizu-200 dark:hover:bg-mizu-800 transition-colors"
            title="プロジェクトを複製"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e, project.id);
            }}
            className="p-2 bg-sakura-100 dark:bg-sakura-900 text-sakura-600 dark:text-sakura-400 rounded-lg hover:bg-sakura-200 dark:hover:bg-sakura-800 transition-colors"
            title="プロジェクトを削除"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* ローディング表示 */}
      {isLoading && (
        <div className="absolute inset-0 bg-unohana-50/50 dark:bg-sumi-800/50 rounded-2xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ai-600"></div>
        </div>
      )}
    </Card>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数：プロジェクトの主要プロパティが変更された場合のみ再レンダリング
  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.title === nextProps.project.title &&
    prevProps.project.description === nextProps.project.description &&
    prevProps.project.coverImage === nextProps.project.coverImage &&
    prevProps.project.mainGenre === nextProps.project.mainGenre &&
    prevProps.project.genre === nextProps.project.genre &&
    prevProps.project.subGenre === nextProps.project.subGenre &&
    prevProps.project.imageBoard.length === nextProps.project.imageBoard.length &&
    prevProps.progress.percentage === nextProps.progress.percentage &&
    prevProps.progress.completedSteps === nextProps.progress.completedSteps &&
    prevProps.progress.totalSteps === nextProps.progress.totalSteps &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.parentTitle === nextProps.parentTitle
  );
});

ProjectCard.displayName = 'ProjectCard';

// 最近使用したプロジェクトカードコンポーネント（メモ化）
interface RecentProjectCardProps {
  project: Project;
  progress: { percentage: number; completedSteps: number; totalSteps: number };
  onSelect: (project: Project) => void;
}

const RecentProjectCard = React.memo<RecentProjectCardProps>(({ project, progress, onSelect }) => {
  return (
    <Card
      onClick={() => onSelect(project)}
      className="p-3 hover:scale-[1.02] transition-all duration-200 cursor-pointer border-usuzumi-200 dark:border-usuzumi-700 hover:shadow-lg dark:hover:shadow-xl hover:shadow-usuzumi-300/50 dark:hover:shadow-sumi-900/50"
      hoverEffect={true}
    >
      {project.coverImage && (
        <div className="w-full aspect-[3/4] rounded-lg glass-bg-only mb-2 overflow-hidden">
          <OptimizedImage
            src={project.coverImage}
            alt={project.title}
            className="w-full h-full"
            objectFit="cover"
            lazy={true}
            quality={0.8}
          />
        </div>
      )}
      <h3 className="text-base font-bold text-sumi-900 dark:text-usuzumi-50 mb-2 line-clamp-2 font-['Noto_Sans_JP']">
        {project.title}
      </h3>
      <div className="flex items-center justify-between mb-2">
        <div className="w-full bg-usuzumi-200 dark:bg-usuzumi-700 rounded-full h-1.5 flex-1 mr-2">
          <div
            className="bg-semantic-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <span className="text-xs font-bold text-ai-600 dark:text-ai-400 whitespace-nowrap">
          {progress.percentage.toFixed(0)}%
        </span>
      </div>
      {project.lastAccessed && (
        <p className="text-xs text-usuzumi-400 dark:text-usuzumi-500 font-['Noto_Sans_JP']">
          {project.lastAccessed instanceof Date
            ? project.lastAccessed.toLocaleDateString('ja-JP')
            : new Date(project.lastAccessed).toLocaleDateString('ja-JP')}
        </p>
      )}
    </Card>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数：プロジェクトの主要プロパティが変更された場合のみ再レンダリング
  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.title === nextProps.project.title &&
    prevProps.project.coverImage === nextProps.project.coverImage &&
    prevProps.progress.percentage === nextProps.progress.percentage &&
    prevProps.progress.completedSteps === nextProps.progress.completedSteps &&
    prevProps.progress.totalSteps === nextProps.progress.totalSteps
  );
});

RecentProjectCard.displayName = 'RecentProjectCard';

interface HomePageProps {
  onNavigateToStep: (step: Step) => void;
}

// ジャンル選択オプション
const GENRES = [
  '一般小説', '恋愛小説', 'ミステリー', 'SF', 'ファンタジー', 'ホラー', 'コメディ', 'アクション', 'サスペンス', 'その他'
];

type SortOption = 'updatedDesc' | 'updatedAsc' | 'createdDesc' | 'createdAsc' | 'titleAsc' | 'titleDesc' | 'progressDesc' | 'progressAsc' | 'lastAccessedDesc';

const WELCOME_MESSAGES = [
  'おかえりなさい ✨',
  'また会えましたね 📖',
  '今日も物語を紡ぎましょう 🖊️',
  'あなたの物語が待っています 🌟',
  'インスピレーションは準備できています 💡',
  'AI Story Builderへようこそ 🐵🤖',
  'さあ、続きを書きましょう ✍️',
  '物語の世界へようこそ 🌙',
  '創作の時間です 🎨',
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigateToStep }) => {
  const { projects, currentProject, setCurrentProject, deleteProject, duplicateProject, isLoading, calculateProjectProgress } = useProject();
  const { showError, showSuccess } = useToast();
  const welcomeMessage = useMemo(
    () => WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)],
    []
  );

  const currentProjectRef = React.useRef(currentProject);
  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useEffect(() => {
    startAutoBackup(() => currentProjectRef.current);
    return () => {
      stopAutoBackup();
    };
  }, []);

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showImageToStoryModal, setShowImageToStoryModal] = useState(false);
  const [showAudioToStoryModal, setShowAudioToStoryModal] = useState(false);
  const [showAudioImageToStoryModal, setShowAudioImageToStoryModal] = useState(false);
  const [showStoryProposalModal, setShowStoryProposalModal] = useState(false);
  const [showSequelModal, setShowSequelModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [storyProposal, setStoryProposal] = useState<StoryProposal | null>(null);
  const [showContextHelp, setShowContextHelp] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // 検索・フィルタリング・ソート用の状態
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('lastAccessedDesc');

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project);
    // 保存されたcurrentStepがあればそのステップに遷移、なければplot1に遷移
    const stepToNavigate = project.currentStep || 'plot1';
    onNavigateToStep(stepToNavigate as Step);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDeletingProjectId(projectId);
  };

  const confirmDeleteProject = async () => {
    if (!deletingProjectId) return;

    try {
      await deleteProject(deletingProjectId);
      showSuccess('プロジェクトを削除しました', 3000);
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: errorInfo.title,
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setDeletingProjectId(null);
    }
  };

  const cancelDeleteProject = () => {
    setDeletingProjectId(null);
  };

  const handleDuplicateProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      await duplicateProject(projectId);
      showSuccess('プロジェクトを複製しました', 3000);
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: errorInfo.title,
        details: errorInfo.details || errorInfo.solution,
      });
    }
  };

  // 編集開始
  const handleEditProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project.id);
  };

  // 編集モーダルを閉じる
  const handleCloseEditModal = () => {
    setEditingProject(null);
  };

  // プロジェクト進捗を計算する関数（ProjectContextの関数を使用）
  const getProjectProgress = (project: Project) => {
    const progress = calculateProjectProgress(project);
    return {
      percentage: progress.percentage,
      completedSteps: progress.completedSteps,
      totalSteps: progress.totalSteps,
      nextStep: progress.nextStep,
    };
  };

  // プロジェクトID → タイトルのマップ（続編バッジの前作名表示に使用）
  const projectTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach(p => { map[p.id] = p.title; });
    return map;
  }, [projects]);

  // 最近使用したプロジェクトを取得（最大5件）
  const recentProjects = useMemo(() => {
    return projects
      .filter(p => p.lastAccessed)
      .sort((a, b) => {
        const aDate = a.lastAccessed instanceof Date ? a.lastAccessed : new Date(a.lastAccessed!);
        const bDate = b.lastAccessed instanceof Date ? b.lastAccessed : new Date(b.lastAccessed!);
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 5);
  }, [projects]);

  // Ctrl+N ショートカット
  useGlobalShortcuts(
    [
      {
        keys: 'ctrl+n',
        handler: () => {
          if (!showNewProjectModal) {
            setShowNewProjectModal(true);
          }
        },
        description: '新しいプロジェクトを作成',
        enabled: !showNewProjectModal,
      },
    ],
    {
      enabled: true,
      ignoreInputs: false, // Ctrl+Nは入力フィールド内でも有効
    }
  );

  // フィルタリング・ソート済みプロジェクト
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;

    // 検索フィルタ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        (p.mainGenre || p.genre || '').toLowerCase().includes(query) ||
        (p.subGenre || '').toLowerCase().includes(query)
      );
    }

    // ジャンルフィルタ
    if (filterGenre !== 'all') {
      filtered = filtered.filter(p =>
        (p.mainGenre || p.genre || '') === filterGenre ||
        p.subGenre === filterGenre
      );
    }

    // ソート
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'updatedDesc': {
          const aUpdated = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
          const bUpdated = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
          return bUpdated.getTime() - aUpdated.getTime();
        }
        case 'updatedAsc': {
          const aUpdatedAsc = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
          const bUpdatedAsc = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
          return aUpdatedAsc.getTime() - bUpdatedAsc.getTime();
        }
        case 'createdDesc': {
          const aCreated = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const bCreated = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return bCreated.getTime() - aCreated.getTime();
        }
        case 'createdAsc': {
          const aCreatedAsc = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const bCreatedAsc = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return aCreatedAsc.getTime() - bCreatedAsc.getTime();
        }
        case 'titleAsc':
          return a.title.localeCompare(b.title, 'ja');
        case 'titleDesc':
          return b.title.localeCompare(a.title, 'ja');
        case 'progressDesc':
          return getProjectProgress(b).percentage - getProjectProgress(a).percentage;
        case 'progressAsc':
          return getProjectProgress(a).percentage - getProjectProgress(b).percentage;
        case 'lastAccessedDesc':
        default: {
          const aLast = a.lastAccessed instanceof Date ? a.lastAccessed : (a.lastAccessed ? new Date(a.lastAccessed) : a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt));
          const bLast = b.lastAccessed instanceof Date ? b.lastAccessed : (b.lastAccessed ? new Date(b.lastAccessed) : b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt));
          return bLast.getTime() - aLast.getTime();
        }
      }
    });

    return sorted;
  }, [projects, searchQuery, filterGenre, sortOption]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-unohana-50 via-unohana-100 to-unohana-200 dark:from-sumi-900 dark:via-sumi-800 dark:to-sumi-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        {projects.length === 0 ? (
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4 sm:mb-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  AIと共創する
                </span>
                <br />
                ストーリービルダー
              </h1>
              <button
                onClick={() => setShowContextHelp(true)}
                className="p-2 rounded-lg bg-ai-100 dark:bg-ai-900/30 hover:bg-ai-200 dark:hover:bg-ai-900/50 text-ai-600 dark:text-ai-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2"
                aria-label="ヘルプを表示"
                title="ヘルプ"
              >
                <HelpCircle className="h-6 w-6" />
              </button>
            </div>
            <p className="text-body sm:text-lg md:text-xl text-sumi-600 dark:text-usuzumi-300 mb-6 sm:mb-8 font-['Noto_Sans_JP'] px-4">
              80%の面倒な作業はAIに任せて、20%の創造性に集中しましょう
            </p>
            <div className="flex flex-col items-center justify-center gap-4">
              {/* 上段: 新しいプロジェクトを作成 */}
              <button
                id="new-project-btn"
                onClick={() => setShowNewProjectModal(true)}
                className="inline-flex items-center space-x-2 bg-semantic-primary text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full font-semibold text-lg sm:text-xl hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="h-7 w-7" />
                <span>新しいプロジェクトを作成</span>
              </button>
              {/* 下段: 画像 / 小説取込 / 音声 */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={() => setShowImageToStoryModal(true)}
                  className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-base hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Image className="h-4 w-4" />
                  <span>画像から物語を作る</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center space-x-2 bg-amber-600 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-base hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <FileUp className="h-4 w-4" />
                  <span>小説を取り込む</span>
                </button>
                <button
                  onClick={() => setShowAudioToStoryModal(true)}
                  className="inline-flex items-center space-x-2 bg-purple-600 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-base hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Mic className="h-4 w-4" />
                  <span>音声から物語を作る</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 py-4">
            <div className="flex items-center gap-3">
              <p className="text-lg sm:text-xl font-semibold text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
                {welcomeMessage}
              </p>
              <button
                onClick={() => setShowContextHelp(true)}
                className="p-1.5 rounded-lg bg-ai-100 dark:bg-ai-900/30 hover:bg-ai-200 dark:hover:bg-ai-900/50 text-ai-600 dark:text-ai-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ai-500 focus:ring-offset-2"
                aria-label="ヘルプを表示"
                title="ヘルプ"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
              <button
                onClick={() => setShowImageToStoryModal(true)}
                className="inline-flex items-center space-x-1.5 bg-indigo-600 text-white px-4 py-2 rounded-full font-semibold text-sm hover:scale-105 transition-all duration-200 shadow hover:shadow-md"
              >
                <Image className="h-3.5 w-3.5" />
                <span>画像から</span>
              </button>
              <button
                id="new-project-btn"
                onClick={() => setShowNewProjectModal(true)}
                className="inline-flex items-center space-x-1.5 bg-semantic-primary text-white px-4 py-2 rounded-full font-semibold text-sm hover:scale-105 transition-all duration-200 shadow hover:shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>新規プロジェクト</span>
              </button>
              <button
                onClick={() => setShowAudioToStoryModal(true)}
                className="inline-flex items-center space-x-1.5 bg-purple-600 text-white px-4 py-2 rounded-full font-semibold text-sm hover:scale-105 transition-all duration-200 shadow hover:shadow-md"
              >
                <Mic className="h-3.5 w-3.5" />
                <span>音声から</span>
              </button>
              <button
                onClick={() => setShowSequelModal(true)}
                className="inline-flex items-center space-x-1.5 bg-teal-600 text-white px-4 py-2 rounded-full font-semibold text-sm hover:scale-105 transition-all duration-200 shadow hover:shadow-md"
                title="完成した作品の続編をAI補助で作成"
              >
                <Library className="h-3.5 w-3.5" />
                <span>続編構成</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center space-x-1.5 bg-amber-600 text-white px-4 py-2 rounded-full font-semibold text-sm hover:scale-105 transition-all duration-200 shadow hover:shadow-md"
                title="手持ちの小説・断片をAI解析して取り込む"
              >
                <FileUp className="h-3.5 w-3.5" />
                <span>小説取込</span>
              </button>
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <Card className="p-6 border-usuzumi-200 dark:border-usuzumi-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-sumi-900 dark:text-usuzumi-50">{projects.length}</p>
                <p className="text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">総プロジェクト数</p>
              </div>
              <BookOpen className="h-8 w-8 text-ai-600 dark:text-ai-400" />
            </div>
          </Card>

          <Card
            className={`p-6 border-usuzumi-200 dark:border-usuzumi-700 ${projects.length >= 5
                ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-[1.02] transition-all duration-200'
                : ''
              }`}
            onClick={projects.length >= 5 ? () => setShowAudioImageToStoryModal(true) : undefined}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-sumi-900 dark:text-usuzumi-50">6</p>
                <p className="text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">制作ステップ</p>
              </div>
              <TrendingUp className="h-8 w-8 text-wakagusa-600 dark:text-wakagusa-400" />
            </div>
          </Card>

          <Card className="p-6 border-usuzumi-200 dark:border-usuzumi-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-sumi-900 dark:text-usuzumi-50">
                  {projects.length > 0 ? new Date().toLocaleDateString('ja-JP') : '---'}
                </p>
                <p className="text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">最終更新</p>
              </div>
              <Calendar className="h-8 w-8 text-mizu-600 dark:text-mizu-400" />
            </div>
          </Card>
        </div>

        {/* 最近使用したプロジェクト */}
        {recentProjects.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-6 w-6 text-semantic-primary" />
                <h2 className="text-section-title text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
                  最近使用したプロジェクト
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {recentProjects.map((project) => {
                const progress = getProjectProgress(project);
                return (
                  <RecentProjectCard
                    key={project.id}
                    project={project}
                    progress={progress}
                    onSelect={handleProjectSelect}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Projects Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-section-title text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
              プロジェクト一覧
            </h2>
          </div>

          {/* 検索・フィルタリング・ソート */}
          <Card className="p-4 mb-6 border-usuzumi-200 dark:border-usuzumi-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 検索バー */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-usuzumi-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="プロジェクトを検索..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-usuzumi-200 dark:border-usuzumi-600 bg-unohana-50 dark:bg-sumi-800 text-sumi-900 dark:text-usuzumi-50 focus:ring-2 focus:ring-ai-500 focus:border-transparent font-['Noto_Sans_JP']"
                />
              </div>

              {/* ジャンルフィルタ */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-usuzumi-400" />
                <select
                  value={filterGenre}
                  onChange={(e) => setFilterGenre(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-usuzumi-200 dark:border-usuzumi-600 bg-unohana-50 dark:bg-sumi-800 text-sumi-900 dark:text-usuzumi-50 focus:ring-2 focus:ring-ai-500 focus:border-transparent font-['Noto_Sans_JP'] appearance-none"
                >
                  <option value="all">すべてのジャンル</option>
                  {GENRES.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              {/* ソート */}
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-usuzumi-400" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-usuzumi-200 dark:border-usuzumi-600 bg-unohana-50 dark:bg-sumi-800 text-sumi-900 dark:text-usuzumi-50 focus:ring-2 focus:ring-ai-500 focus:border-transparent font-['Noto_Sans_JP'] appearance-none"
                >
                  <option value="lastAccessedDesc">最近使用した順</option>
                  <option value="updatedDesc">更新日時（新しい順）</option>
                  <option value="updatedAsc">更新日時（古い順）</option>
                  <option value="createdDesc">作成日時（新しい順）</option>
                  <option value="createdAsc">作成日時（古い順）</option>
                  <option value="titleAsc">タイトル（あいうえお順）</option>
                  <option value="titleDesc">タイトル（逆順）</option>
                  <option value="progressDesc">進捗率（高い順）</option>
                  <option value="progressAsc">進捗率（低い順）</option>
                </select>
              </div>
            </div>
          </Card>

          {filteredAndSortedProjects.length === 0 ? (
            <Card className="border-usuzumi-200 dark:border-usuzumi-700">
              {searchQuery || filterGenre !== 'all' ? (
                <EmptyState
                  icon={Search}
                  iconColor="text-usuzumi-400 dark:text-usuzumi-500"
                  title="該当するプロジェクトが見つかりません"
                  description="検索条件やフィルターを変更して、再度お試しください。別のキーワードで検索するか、すべてのジャンルを表示してみましょう。"
                />
              ) : (
                <EmptyState
                  icon={Sparkles}
                  iconColor="text-ai-400 dark:text-ai-500"
                  title="まだプロジェクトがありません"
                  description="新しいプロジェクトを作成して、AI支援による創作の旅を始めましょう。キャラクター設計から物語の完成まで、AIがあなたの創作をサポートします。"
                />
              )}
            </Card>
          ) : isLoading ? (
            <SkeletonLoader variant="project-card" count={8} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredAndSortedProjects.map((project) => {
                const progress = getProjectProgress(project);
                return (
                  <ProjectCard
                    key={project.id}
                    project={project as Project}
                    progress={progress}
                    onSelect={handleProjectSelect}
                    onEdit={handleEditProject}
                    onDuplicate={handleDuplicateProject}
                    onDelete={handleDeleteProject}
                    isLoading={false}
                    parentTitle={project.parentProjectId ? projectTitleById[project.parentProjectId] : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Features Section — プロジェクトが0件の場合のみ表示 */}
        {projects.length === 0 && <Card className="p-8 border-usuzumi-200 dark:border-usuzumi-700">
          <h2 className="text-section-title text-sumi-900 dark:text-usuzumi-50 mb-6 font-['Noto_Sans_JP']">
            主な機能
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-sakura-100 dark:bg-sakura-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">キャラクター設計</h3>
              <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">AIが背景や性格を補完</p>
            </div>

            <div className="text-center">
              <div className="bg-mizu-100 dark:bg-mizu-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📖</span>
              </div>
              <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">プロット生成</h3>
              <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">物語構造の自動展開</p>
            </div>

            <div className="text-center">
              <div className="bg-wakagusa-100 dark:bg-wakagusa-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✍️</span>
              </div>
              <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">草案執筆支援</h3>
              <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">AIによる文章ドラフト</p>
            </div>
          </div>

          {/* プロジェクトツール */}
          <div className="mt-8 pt-8 border-t border-usuzumi-200 dark:border-usuzumi-700">
            <h3 className="text-lg font-semibold text-sumi-900 dark:text-usuzumi-50 mb-6 font-['Noto_Sans_JP']">
              プロジェクトツール
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 dark:bg-blue-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📚</span>
                </div>
                <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">用語集</h3>
                <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">作品内の重要な用語や設定を整理・管理し、一貫性のある世界観を構築します</p>
              </div>

              <div className="text-center">
                <div className="bg-pink-100 dark:bg-pink-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🕸️</span>
                </div>
                <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">相関図</h3>
                <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">キャラクター間の関係性を視覚的に表示し、複雑な人間関係を把握しやすくします</p>
              </div>

              <div className="text-center">
                <div className="bg-green-100 dark:bg-green-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📅</span>
                </div>
                <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">タイムライン</h3>
                <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">物語の時系列やイベントを管理し、時系列の整合性を保ちます</p>
              </div>

              <div className="text-center">
                <div className="bg-amber-100 dark:bg-amber-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🌍</span>
                </div>
                <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">世界観</h3>
                <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">地理、文化、技術、魔法などの世界設定を体系的に管理し、詳細な世界観を構築します</p>
              </div>

              <div className="text-center">
                <div className="bg-rose-100 dark:bg-rose-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔗</span>
                </div>
                <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">伏線トラッカー</h3>
                <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">伏線の設置、ヒント、回収を管理し、物語の整合性を保ちます</p>
              </div>

              <div className="text-center">
                <div className="bg-violet-100 dark:bg-violet-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💭</span>
                </div>
                <h3 className="text-base font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">感情マップ</h3>
                <p className="text-caption text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">キャラクターの感情変化を可視化し、感情の流れを追跡して物語の深みを増します</p>
              </div>
            </div>
          </div>
        </Card>}
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onNavigateToStep={onNavigateToStep}
      />

      {/* Image to Story Modal */}
      <ImageToStoryModal
        isOpen={showImageToStoryModal}
        onClose={() => setShowImageToStoryModal(false)}
        onProposalGenerated={(proposal) => {
          setStoryProposal(proposal);
          setShowImageToStoryModal(false);
          setShowStoryProposalModal(true);
        }}
      />

      {/* Audio to Story Modal */}
      <AudioToStoryModal
        isOpen={showAudioToStoryModal}
        onClose={() => setShowAudioToStoryModal(false)}
        onProposalGenerated={(proposal) => {
          setStoryProposal(proposal);
          setShowAudioToStoryModal(false);
          setShowStoryProposalModal(true);
        }}
      />

      {/* Audio and Image to Story Modal (Hidden Feature) */}
      <AudioImageToStoryModal
        isOpen={showAudioImageToStoryModal}
        onClose={() => setShowAudioImageToStoryModal(false)}
        onProposalGenerated={(proposal) => {
          setStoryProposal(proposal);
          setShowAudioImageToStoryModal(false);
          setShowStoryProposalModal(true);
        }}
      />

      {/* Story Proposal Modal */}
      <StoryProposalModal
        isOpen={showStoryProposalModal}
        onClose={() => {
          setShowStoryProposalModal(false);
          setStoryProposal(null);
        }}
        onNavigateToStep={onNavigateToStep}
        proposal={storyProposal}
      />

      {/* Sequel Composer Modal */}
      <SequelComposerModal
        isOpen={showSequelModal}
        onClose={() => setShowSequelModal(false)}
        onNavigateToStep={onNavigateToStep}
      />

      {/* Story Importer Modal */}
      <StoryImporterModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onNavigateToStep={onNavigateToStep}
      />

      {/* Context Help */}
      <ContextHelp
        step="home"
        isOpen={showContextHelp}
        onClose={() => setShowContextHelp(false)}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        isOpen={editingProject !== null}
        project={editingProject ? projects.find(p => p.id === editingProject) || null : null}
        onClose={handleCloseEditModal}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingProjectId !== null}
        onClose={cancelDeleteProject}
        onConfirm={confirmDeleteProject}
        title="プロジェクトの削除"
        message={deletingProjectId ? `「${projects.find(p => p.id === deletingProjectId)?.title || 'このプロジェクト'}」を削除しますか？\nこの操作は取り消せません。` : ''}
        type="danger"
        confirmLabel="削除"
        cancelLabel="キャンセル"
      />

      <AutoBackupStatus />
    </div>
  );
};