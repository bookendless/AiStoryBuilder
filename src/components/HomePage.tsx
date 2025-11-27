import React, { useState, useMemo } from 'react';
import { Plus, BookOpen, Calendar, TrendingUp, Edit3, Search, Filter, ArrowUpDown, Clock, CheckCircle2, HelpCircle } from 'lucide-react';
import { Step } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { NewProjectModal } from './NewProjectModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { Project } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorHandler';
import { useGlobalShortcuts } from '../hooks/useKeyboardNavigation';
import { ContextHelp } from './ContextHelp';
import { OptimizedImage } from './OptimizedImage';
import { Card } from './common/Card';

// プロジェクトカードコンポーネント（メモ化）
interface ProjectCardProps {
  project: Project;
  progress: { percentage: number; completedSteps: number; totalSteps: number };
  onSelect: (project: Project) => void;
  onEdit: (e: React.MouseEvent, project: Project) => void;
  onDuplicate: (e: React.MouseEvent, projectId: string) => void;
  onDelete: (e: React.MouseEvent, projectId: string) => void;
  isLoading: boolean;
}

const ProjectCard = React.memo<ProjectCardProps>(({
  project,
  progress,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  isLoading
}) => {
  return (
    <Card
      className="p-6 hover:scale-105 transition-all duration-200 relative group border-usuzumi-200 dark:border-usuzumi-700"
      hoverEffect={true}
    >
      {/* プロジェクト操作ボタン */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
        <button
          onClick={(e) => onEdit(e, project)}
          className="p-2 bg-wakagusa-100 dark:bg-wakagusa-900 text-wakagusa-600 dark:text-wakagusa-400 rounded-lg hover:bg-wakagusa-200 dark:hover:bg-wakagusa-800 transition-colors"
          title="プロジェクトを編集"
        >
          <Edit3 className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => onDuplicate(e, project.id)}
          className="p-2 bg-mizu-100 dark:bg-mizu-900 text-mizu-600 dark:text-mizu-400 rounded-lg hover:bg-mizu-200 dark:hover:bg-mizu-800 transition-colors"
          title="プロジェクトを複製"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={(e) => onDelete(e, project.id)}
          className="p-2 bg-sakura-100 dark:bg-sakura-900 text-sakura-600 dark:text-sakura-400 rounded-lg hover:bg-sakura-200 dark:hover:bg-sakura-800 transition-colors"
          title="プロジェクトを削除"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* 表紙画像 */}
      {project.coverImage && (
        <div className="mb-4">
          <div
            onClick={() => onSelect(project)}
            className="cursor-pointer"
          >
            <OptimizedImage
              src={project.coverImage}
              alt={project.title}
              className="w-full h-32 rounded-lg"
              lazy={true}
              quality={0.8}
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <div
          onClick={() => onSelect(project)}
          className="cursor-pointer"
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-bold text-sumi-900 dark:text-usuzumi-50 flex-1 font-['Noto_Sans_JP']">
              {project.title}
            </h3>
            <span className="ml-2 inline-flex items-center px-2 py-1 bg-ai-100 dark:bg-ai-900 text-ai-600 dark:text-ai-400 text-xs font-bold rounded-full">
              {progress.percentage.toFixed(0)}%
            </span>
          </div>
          <p className="text-sumi-600 dark:text-usuzumi-400 text-sm line-clamp-2 font-['Noto_Sans_JP']">
            {project.description}
          </p>
        </div>
      </div>

      {/* 進捗バー */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-sumi-600 dark:text-usuzumi-400 mb-1 font-['Noto_Sans_JP']">
          <span>進捗: {progress.completedSteps}/{progress.totalSteps} ステップ完了</span>
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3 text-wakagusa-500" />
            <span>{progress.completedSteps}完了</span>
          </span>
        </div>
        <div className="w-full bg-usuzumi-200 dark:bg-usuzumi-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${progress.percentage === 100
              ? 'bg-gradient-to-r from-wakagusa-500 to-wakagusa-600'
              : progress.percentage >= 50
                ? 'bg-gradient-to-r from-ai-500 to-ai-600'
                : 'bg-gradient-to-r from-yamabuki-400 to-yamabuki-500'
              }`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* ジャンル表示 */}
      {(project.mainGenre || project.genre) && (
        <div className="mb-3 flex flex-wrap gap-1">
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

      <div className="mt-4 flex justify-between text-xs text-sumi-500 dark:text-usuzumi-400">
        <span>作成: {project.createdAt instanceof Date ? project.createdAt.toLocaleDateString('ja-JP') : new Date(project.createdAt).toLocaleDateString('ja-JP')}</span>
        <span>更新: {project.updatedAt instanceof Date ? project.updatedAt.toLocaleDateString('ja-JP') : new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span>
      </div>
      <div className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
        画像: {project.imageBoard.length} 枚
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
    prevProps.isLoading === nextProps.isLoading
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
      className="p-4 hover:scale-105 transition-all duration-200 cursor-pointer border-usuzumi-200 dark:border-usuzumi-700"
      hoverEffect={true}
    >
      {project.coverImage && (
        <OptimizedImage
          src={project.coverImage}
          alt={project.title}
          className="w-full h-24 rounded-lg mb-2"
          lazy={true}
          quality={0.8}
        />
      )}
      <h3 className="text-sm font-bold text-sumi-900 dark:text-usuzumi-50 mb-1 line-clamp-1 font-['Noto_Sans_JP']">
        {project.title}
      </h3>
      <div className="flex items-center justify-between text-xs text-sumi-500 dark:text-usuzumi-400 mb-2">
        <span>{progress.completedSteps}/{progress.totalSteps} ステップ完了</span>
        <span>{progress.percentage.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-usuzumi-200 dark:bg-usuzumi-700 rounded-full h-1.5">
        <div
          className="bg-gradient-to-r from-ai-500 to-ai-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      {project.lastAccessed && (
        <p className="text-xs text-usuzumi-400 dark:text-usuzumi-500 mt-2 font-['Noto_Sans_JP']">
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

export const HomePage: React.FC<HomePageProps> = ({ onNavigateToStep }) => {
  const { projects, setCurrentProject, deleteProject, duplicateProject, isLoading, calculateProjectProgress } = useProject();
  const { showError, showSuccess } = useToast();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showContextHelp, setShowContextHelp] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);

  // 検索・フィルタリング・ソート用の状態
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('lastAccessedDesc');

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project);
    onNavigateToStep('plot1');
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      await deleteProject(projectId);
      showSuccess('プロジェクトを削除しました', 3000);
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: errorInfo.title,
        details: errorInfo.details || errorInfo.solution,
      });
    }
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
    };
  };

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
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <h1 className="text-4xl sm:text-6xl font-bold text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
              <span className="bg-gradient-to-r from-ai-500 to-ai-600 bg-clip-text text-transparent">
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
          <p className="text-xl text-sumi-600 dark:text-usuzumi-300 mb-8 font-['Noto_Sans_JP']">
            80%の面倒な作業はAIに任せて、20%の創造性に集中しましょう
          </p>

          <button
            onClick={() => setShowNewProjectModal(true)}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-ai-500 to-ai-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="h-6 w-6" />
            <span>新しいプロジェクトを作成</span>
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 border-usuzumi-200 dark:border-usuzumi-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-sumi-900 dark:text-usuzumi-50">{projects.length}</p>
                <p className="text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">総プロジェクト数</p>
              </div>
              <BookOpen className="h-8 w-8 text-ai-600 dark:text-ai-400" />
            </div>
          </Card>

          <Card className="p-6 border-usuzumi-200 dark:border-usuzumi-700">
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
                <Clock className="h-6 w-6 text-ai-600 dark:text-ai-400" />
                <h2 className="text-2xl font-bold text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
                  最近使用したプロジェクト
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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
            <h2 className="text-2xl font-bold text-sumi-900 dark:text-usuzumi-50 font-['Noto_Sans_JP']">
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
            <Card className="p-12 text-center border-usuzumi-200 dark:border-usuzumi-700">
              <BookOpen className="h-16 w-16 text-usuzumi-400 dark:text-usuzumi-500 mx-auto mb-4" />
              <p className="text-xl text-sumi-600 dark:text-usuzumi-400 mb-4 font-['Noto_Sans_JP']">
                {searchQuery || filterGenre !== 'all' ? '該当するプロジェクトが見つかりません' : 'まだプロジェクトがありません'}
              </p>
              <p className="text-sumi-500 dark:text-usuzumi-500 mb-6 font-['Noto_Sans_JP']">
                {searchQuery || filterGenre !== 'all'
                  ? '検索条件を変更して再度お試しください'
                  : '新しいプロジェクトを作成して、AI支援による創作を始めましょう'}
              </p>
              {(!searchQuery && filterGenre === 'all') && (
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="inline-flex items-center space-x-2 bg-ai-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-ai-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>最初のプロジェクトを作成</span>
                </button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Features Section */}
        <Card className="p-8 border-usuzumi-200 dark:border-usuzumi-700">
          <h2 className="text-2xl font-bold text-sumi-900 dark:text-usuzumi-50 mb-6 font-['Noto_Sans_JP']">
            主な機能
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-sakura-100 dark:bg-sakura-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">キャラクター設計</h3>
              <p className="text-sm text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">AIが背景や性格を補完</p>
            </div>

            <div className="text-center">
              <div className="bg-mizu-100 dark:bg-mizu-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📖</span>
              </div>
              <h3 className="font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">プロット生成</h3>
              <p className="text-sm text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">物語構造の自動展開</p>
            </div>

            <div className="text-center">
              <div className="bg-wakagusa-100 dark:bg-wakagusa-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✍️</span>
              </div>
              <h3 className="font-semibold text-sumi-900 dark:text-usuzumi-50 mb-2 font-['Noto_Sans_JP']">草案執筆支援</h3>
              <p className="text-sm text-sumi-600 dark:text-usuzumi-400 font-['Noto_Sans_JP']">AIによる文章ドラフト</p>
            </div>
          </div>
        </Card>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
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
    </div>
  );
};