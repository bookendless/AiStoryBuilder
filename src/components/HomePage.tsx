import React, { useState, useRef, useMemo } from 'react';
import { Plus, BookOpen, Calendar, TrendingUp, Image, Edit3, Save, X, Upload, Search, Filter, ArrowUpDown, Clock, CheckCircle2 } from 'lucide-react';
import { Step } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { NewProjectModal } from './NewProjectModal';
import { databaseService } from '../services/databaseService';
import { Project } from '../contexts/ProjectContext';

interface HomePageProps {
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

type SortOption = 'updatedDesc' | 'updatedAsc' | 'createdDesc' | 'createdAsc' | 'titleAsc' | 'titleDesc' | 'progressDesc' | 'progressAsc' | 'lastAccessedDesc';

export const HomePage: React.FC<HomePageProps> = ({ onNavigateToStep }) => {
  const { projects, setProjects, currentProject, setCurrentProject, deleteProject, duplicateProject, isLoading } = useProject();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
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
    customTheme: ''
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    await deleteProject(projectId);
  };

  const handleDuplicateProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    await duplicateProject(projectId);
  };

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
    setEditFormData(prev => ({ ...prev, coverImage: base64 }));
  };

  // ファイル選択ボタンクリック
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // ファイルクリア
  const handleClearFile = () => {
    setPreviewUrl(null);
    setEditFormData(prev => ({ ...prev, coverImage: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 編集開始
  const handleEditProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project.id);
    
    // カスタムフィールドの値を適切に復元
    const mainGenre = project.mainGenre || project.genre || '';
    const subGenre = project.subGenre || '';
    const targetReader = project.targetReader || '';
    const projectTheme = project.projectTheme || '';
    
    // カスタムフィールドが存在する場合は、それを使用して「その他」を選択状態にする
    const customMainGenre = project.customMainGenre || '';
    const customSubGenre = project.customSubGenre || '';
    const customTargetReader = project.customTargetReader || '';
    const customTheme = project.customTheme || '';
    
    setEditFormData({
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
      customTheme: customTheme
    });
    setPreviewUrl(project.coverImage || null);
  };

  // 編集保存
  const handleSaveEdit = async () => {
    if (!editingProject) return;
    
    try {
      // 編集対象のプロジェクトを取得
      const projectToUpdate = projects.find(p => p.id === editingProject);
      if (!projectToUpdate) {
        alert('プロジェクトが見つかりません。');
        return;
      }

      // プロジェクトを更新
      const updatedProject = {
        ...projectToUpdate,
        title: editFormData.title,
        description: editFormData.description,
        genre: editFormData.mainGenre === 'その他' ? editFormData.customMainGenre : editFormData.mainGenre, // 後方互換性のため
        mainGenre: editFormData.mainGenre === 'その他' ? editFormData.customMainGenre : editFormData.mainGenre,
        subGenre: editFormData.subGenre === 'その他' ? editFormData.customSubGenre : editFormData.subGenre,
        targetReader: editFormData.targetReader === 'その他' ? editFormData.customTargetReader : editFormData.targetReader,
        projectTheme: editFormData.projectTheme === 'その他' ? editFormData.customTheme : editFormData.projectTheme,
        coverImage: editFormData.coverImage,
        customMainGenre: editFormData.customMainGenre,
        customSubGenre: editFormData.customSubGenre,
        customTargetReader: editFormData.customTargetReader,
        customTheme: editFormData.customTheme,
        updatedAt: new Date(),
      };

      // データベースに保存
      await databaseService.saveProject(updatedProject);
      
      // プロジェクト一覧を更新
      const updatedProjects = projects.map((p: Project) => p.id === updatedProject.id ? updatedProject : p);
      setProjects(updatedProjects);
      
      // 現在のプロジェクトが編集対象の場合は更新
      if (currentProject?.id === editingProject) {
        setCurrentProject(updatedProject);
      }
      
      setEditingProject(null);
      setEditFormData({ title: '', description: '', genre: '', mainGenre: '', subGenre: '', targetReader: '', projectTheme: '', coverImage: '', customMainGenre: '', customSubGenre: '', customTargetReader: '', customTheme: '' });
      setPreviewUrl(null);
      
      alert('プロジェクトを更新しました。');
    } catch (error) {
      console.error('Update error:', error);
      alert('更新に失敗しました。');
    }
  };

  // 編集キャンセル
  const handleCancelEdit = () => {
    setEditingProject(null);
    setEditFormData({ title: '', description: '', genre: '', mainGenre: '', subGenre: '', targetReader: '', projectTheme: '', coverImage: '', customMainGenre: '', customSubGenre: '', customTargetReader: '', customTheme: '' });
    setPreviewUrl(null);
  };

  // プロジェクト進捗を計算する関数
  const calculateProjectProgress = (project: Project): { percentage: number; completedSteps: number; totalSteps: number } => {
    const steps = [
      { name: 'character', completed: project.characters.length > 0 },
      { name: 'plot1', completed: !!(project.plot.theme && project.plot.setting && project.plot.hook && project.plot.protagonistGoal && project.plot.mainObstacle) },
      { name: 'plot2', completed: !!(project.plot.structure && (
        (project.plot.structure === 'kishotenketsu' && project.plot.ki && project.plot.sho && project.plot.ten && project.plot.ketsu) ||
        (project.plot.structure === 'three-act' && project.plot.act1 && project.plot.act2 && project.plot.act3) ||
        (project.plot.structure === 'four-act' && project.plot.fourAct1 && project.plot.fourAct2 && project.plot.fourAct3 && project.plot.fourAct4)
      )) },
      { name: 'synopsis', completed: !!project.synopsis },
      { name: 'chapter', completed: project.chapters.length > 0 },
      { name: 'draft', completed: project.chapters.some(ch => ch.draft && ch.draft.trim().length > 0) }
    ];
    
    const completedSteps = steps.filter(s => s.completed).length;
    const totalSteps = steps.length;
    const percentage = (completedSteps / totalSteps) * 100;
    
    return { percentage, completedSteps, totalSteps };
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
          return calculateProjectProgress(b).percentage - calculateProjectProgress(a).percentage;
        case 'progressAsc':
          return calculateProjectProgress(a).percentage - calculateProjectProgress(b).percentage;
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-['Noto_Sans_JP']">
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AIと共創する
            </span>
            <br />
            ストーリービルダー
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 font-['Noto_Sans_JP']">
            80%の面倒な作業はAIに任せて、20%の創造性に集中しましょう
          </p>
          
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="h-6 w-6" />
            <span>新しいプロジェクトを作成</span>
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</p>
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">総プロジェクト数</p>
              </div>
              <BookOpen className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">6</p>
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">制作ステップ</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {projects.length > 0 ? new Date().toLocaleDateString('ja-JP') : '---'}
                </p>
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">最終更新</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* 最近使用したプロジェクト */}
        {recentProjects.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  最近使用したプロジェクト
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {recentProjects.map((project) => {
                const progress = calculateProjectProgress(project);
                return (
                  <div
                    key={project.id}
                    onClick={() => handleProjectSelect(project)}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 hover:scale-105 transition-all duration-200 hover:shadow-lg cursor-pointer"
                  >
                    {project.coverImage && (
                      <img 
                        src={project.coverImage} 
                        alt={project.title}
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                    )}
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 font-['Noto_Sans_JP']">
                      {project.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span>{progress.completedSteps}/{progress.totalSteps} ステップ完了</span>
                      <span>{progress.percentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    {project.lastAccessed && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-['Noto_Sans_JP']">
                        {project.lastAccessed instanceof Date 
                          ? project.lastAccessed.toLocaleDateString('ja-JP')
                          : new Date(project.lastAccessed).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Projects Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              プロジェクト一覧
            </h2>
          </div>

          {/* 検索・フィルタリング・ソート */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 検索バー */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="プロジェクトを検索..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                />
              </div>

              {/* ジャンルフィルタ */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={filterGenre}
                  onChange={(e) => setFilterGenre(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] appearance-none"
                >
                  <option value="all">すべてのジャンル</option>
                  {GENRES.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              {/* ソート */}
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] appearance-none"
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
          </div>
          
          {filteredAndSortedProjects.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-12 text-center">
              <BookOpen className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                {searchQuery || filterGenre !== 'all' ? '該当するプロジェクトが見つかりません' : 'まだプロジェクトがありません'}
              </p>
              <p className="text-gray-500 dark:text-gray-500 mb-6 font-['Noto_Sans_JP']">
                {searchQuery || filterGenre !== 'all' 
                  ? '検索条件を変更して再度お試しください'
                  : '新しいプロジェクトを作成して、AI支援による創作を始めましょう'}
              </p>
              {(!searchQuery && filterGenre === 'all') && (
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>最初のプロジェクトを作成</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedProjects.map((project) => {
                const progress = calculateProjectProgress(project);
                return (
                <div
                  key={project.id}
                  className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:scale-105 transition-all duration-200 hover:shadow-xl relative group"
                >
                  {/* プロジェクト操作ボタン */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                    <button
                      onClick={(e) => handleEditProject(e, project)}
                      className="p-2 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                      title="プロジェクトを編集"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => handleDuplicateProject(e, project.id)}
                      className="p-2 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                      title="プロジェクトを複製"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className="p-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
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
                        onClick={() => handleProjectSelect(project as Project)}
                        className="cursor-pointer"
                      >
                        <img 
                          src={project.coverImage} 
                          alt={project.title}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <div 
                      onClick={() => handleProjectSelect(project as Project)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex-1 font-['Noto_Sans_JP']">
                          {project.title}
                        </h3>
                        <span className="ml-2 inline-flex items-center px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full">
                          {progress.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 font-['Noto_Sans_JP']">
                        {project.description}
                      </p>
                    </div>
                  </div>

                  {/* 進捗バー */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1 font-['Noto_Sans_JP']">
                      <span>進捗: {progress.completedSteps}/{progress.totalSteps} ステップ完了</span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span>{progress.completedSteps}完了</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          progress.percentage === 100 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : progress.percentage >= 50
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                            : 'bg-gradient-to-r from-yellow-400 to-orange-500'
                        }`}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* ジャンル表示 */}
                  {(project.mainGenre || project.genre) && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {project.mainGenre && (
                        <span className="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-xs rounded-full font-['Noto_Sans_JP']">
                          メイン: {project.mainGenre}
                        </span>
                      )}
                      {!project.mainGenre && project.genre && (
                        <span className="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-xs rounded-full font-['Noto_Sans_JP']">
                          メイン: {project.genre}
                        </span>
                      )}
                      {project.subGenre && (
                        <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs rounded-full font-['Noto_Sans_JP']">
                          サブ: {project.subGenre}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>作成: {project.createdAt instanceof Date ? project.createdAt.toLocaleDateString('ja-JP') : new Date(project.createdAt).toLocaleDateString('ja-JP')}</span>
                    <span>更新: {project.updatedAt instanceof Date ? project.updatedAt.toLocaleDateString('ja-JP') : new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    画像: {project.imageBoard.length} 枚
                  </div>

                  {/* ローディング表示 */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-['Noto_Sans_JP']">
            主な機能
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-pink-100 dark:bg-pink-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">キャラクター設計</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">AIが背景や性格を補完</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 dark:bg-purple-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📖</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">プロット生成</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">物語構造の自動展開</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✍️</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">草案執筆支援</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">AIによる文章ドラフト</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onNavigateToStep={onNavigateToStep}
      />

      {/* Edit Project Modal */}
      {editingProject && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleCancelEdit}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg">
                    <Edit3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    プロジェクト編集
                  </h2>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* プロジェクトタイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  プロジェクトタイトル
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
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
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
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
                      onClick={() => {
                        if (editFormData.mainGenre !== genre) {
                          setEditFormData({ ...editFormData, mainGenre: genre, customMainGenre: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        editFormData.mainGenre === genre
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
                {editFormData.mainGenre === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={editFormData.customMainGenre}
                      onChange={(e) => setEditFormData({ ...editFormData, customMainGenre: e.target.value })}
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
                      onClick={() => {
                        if (editFormData.subGenre === genre) {
                          setEditFormData({ ...editFormData, subGenre: '', customSubGenre: '' });
                        } else {
                          setEditFormData({ ...editFormData, subGenre: genre, customSubGenre: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        editFormData.subGenre === genre
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/50'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
                {editFormData.subGenre === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={editFormData.customSubGenre}
                      onChange={(e) => setEditFormData({ ...editFormData, customSubGenre: e.target.value })}
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
                      onClick={() => {
                        if (editFormData.targetReader === target) {
                          setEditFormData({ ...editFormData, targetReader: '', customTargetReader: '' });
                        } else {
                          setEditFormData({ ...editFormData, targetReader: target, customTargetReader: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        editFormData.targetReader === target
                          ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/50'
                      }`}
                    >
                      {target}
                    </button>
                  ))}
                </div>
                {editFormData.targetReader === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={editFormData.customTargetReader}
                      onChange={(e) => setEditFormData({ ...editFormData, customTargetReader: e.target.value })}
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
                      onClick={() => {
                        if (editFormData.projectTheme === theme) {
                          setEditFormData({ ...editFormData, projectTheme: '', customTheme: '' });
                        } else {
                          setEditFormData({ ...editFormData, projectTheme: theme, customTheme: '' });
                        }
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        editFormData.projectTheme === theme
                          ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/50'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                {editFormData.projectTheme === 'その他' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={editFormData.customTheme}
                      onChange={(e) => setEditFormData({ ...editFormData, customTheme: e.target.value })}
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
                          onClick={handleSelectFile}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
                        >
                          <Upload className="h-4 w-4 inline mr-1" />
                          変更
                        </button>
                        <button
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
                          onClick={handleSelectFile}
                          className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
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

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP']"
                >
                  <Save className="h-4 w-4 inline mr-2" />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};