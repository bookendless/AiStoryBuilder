import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Plus,
  Search,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  EyeOff,
  Users,
  Tag,
  Sparkles,
  Shield,
  Lightbulb,
  Wand2,
  Loader2,
  Calendar,
  List,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { useProject, Foreshadowing, ForeshadowingPoint } from '../../contexts/ProjectContext';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { useToast } from '../Toast';
import { Modal } from '../common/Modal';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { EmptyState } from '../common/EmptyState';
import { parseAIResponse } from '../../utils/aiResponseParser';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ForeshadowingTrackerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ステータスラベルとカラー
const statusConfig: Record<Foreshadowing['status'], { label: string; color: string; icon: typeof Clock }> = {
  planted: { label: '設置済み', color: 'bg-blue-500', icon: Target },
  hinted: { label: '進行中', color: 'bg-amber-500', icon: Clock },
  resolved: { label: '回収済み', color: 'bg-green-500', icon: CheckCircle },
  abandoned: { label: '破棄', color: 'bg-gray-500', icon: EyeOff },
};

// カテゴリラベルとカラー
const categoryConfig: Record<Foreshadowing['category'], { label: string; color: string }> = {
  character: { label: 'キャラクター', color: 'bg-pink-500' },
  plot: { label: 'プロット', color: 'bg-blue-500' },
  world: { label: '世界観', color: 'bg-green-500' },
  mystery: { label: 'ミステリー', color: 'bg-purple-500' },
  relationship: { label: '人間関係', color: 'bg-rose-500' },
  other: { label: 'その他', color: 'bg-gray-500' },
};

// 重要度ラベル
const importanceConfig: Record<Foreshadowing['importance'], { label: string; stars: string; color: string }> = {
  high: { label: '高', stars: '★★★', color: 'text-red-500' },
  medium: { label: '中', stars: '★★☆', color: 'text-amber-500' },
  low: { label: '低', stars: '★☆☆', color: 'text-gray-500' },
};

// ポイントタイプラベル
const pointTypeConfig: Record<ForeshadowingPoint['type'], { label: string; icon: string; color: string }> = {
  plant: { label: '設置', icon: '📍', color: 'text-blue-600' },
  hint: { label: 'ヒント', icon: '💡', color: 'text-amber-600' },
  payoff: { label: '回収', icon: '🎯', color: 'text-green-600' },
};

export const ForeshadowingTracker: React.FC<ForeshadowingTrackerProps> = ({ isOpen, onClose }) => {
  const { currentProject, updateProject } = useProject();
  const { showWarning, showError } = useToast();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  // 状態管理
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingForeshadowing, setEditingForeshadowing] = useState<Foreshadowing | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showPointForm, setShowPointForm] = useState<string | null>(null); // 伏線IDを保持

  // フォームデータ
  const [formData, setFormData] = useState<Partial<Foreshadowing>>({
    title: '',
    description: '',
    importance: 'medium',
    status: 'planted',
    category: 'plot',
    points: [],
    relatedCharacterIds: [],
    plannedPayoffChapterId: '',
    plannedPayoffDescription: '',
    tags: [],
    notes: '',
  });

  // 始まりの章（設置する章）
  const [plantChapterId, setPlantChapterId] = useState<string>('');

  // ポイント追加フォーム
  const [pointFormData, setPointFormData] = useState<Partial<ForeshadowingPoint>>({
    chapterId: '',
    type: 'plant',
    description: '',
    lineReference: '',
  });

  const [tagInput, setTagInput] = useState('');

  // ビュー切り替え
  const [currentView, setCurrentView] = useState<'list' | 'timeline' | 'stats'>('list');

  // AI関連のステート
  const { settings: aiSettings } = useAI();
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [deletingForeshadowingId, setDeletingForeshadowingId] = useState<string | null>(null);
  const [deletingPointInfo, setDeletingPointInfo] = useState<{ foreshadowingId: string; pointId: string } | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    title: string;
    description: string;
    category: Foreshadowing['category'];
    importance: Foreshadowing['importance'];
    plantChapter: string;
    plantDescription: string;
    payoffChapter: string;
    payoffDescription: string;
    relatedCharacters: string[];
    effect: string;
  }>>([]);
  const [consistencyResult, setConsistencyResult] = useState<{
    overallScore: number;
    summary: string;
    unresolvedIssues: Array<{ foreshadowingTitle: string; issue: string; severity: string; suggestion: string }>;
    contradictions: Array<{ items: string[]; description: string; resolution: string }>;
    balanceIssues: Array<{ issue: string; suggestion: string }>;
    strengths: string[];
  } | null>(null);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [selectedForEnhance, setSelectedForEnhance] = useState<Foreshadowing | null>(null);
  const [enhanceResult, setEnhanceResult] = useState<{
    enhancedDescription: string;
    additionalLayers: Array<{ layer: string; description: string; effect: string }>;
    connectionOpportunities: Array<{ target: string; connection: string; benefit: string }>;
    strengthenMethods: Array<{ current: string; improved: string; reason: string }>;
    warnings: string[];
  } | null>(null);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [selectedForPayoff, setSelectedForPayoff] = useState<Foreshadowing | null>(null);
  const [payoffResult, setPayoffResult] = useState<{
    recommendedChapter: string;
    timing: string;
    payoffMethods: Array<{ method: string; description: string; impact: string; prerequisites: string[] }>;
    hintsBeforePayoff: Array<{ chapter: string; hint: string }>;
    avoidTiming: string[];
  } | null>(null);
  const [showPayoffModal, setShowPayoffModal] = useState(false);

  const foreshadowings = useMemo(() => currentProject?.foreshadowings || [], [currentProject?.foreshadowings]);
  const chapters = useMemo(() => currentProject?.chapters || [], [currentProject?.chapters]);
  const characters = useMemo(() => currentProject?.characters || [], [currentProject?.characters]);

  // フィルタリング
  const filteredForeshadowings = useMemo(() => {
    let filtered = foreshadowings;

    // ステータスでフィルタ
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(f => f.status === selectedStatus);
    }

    // カテゴリでフィルタ
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(f => f.category === selectedCategory);
    }

    // 検索でフィルタ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // 重要度でソート（高→中→低）
    return filtered.sort((a, b) => {
      const importanceOrder = { high: 0, medium: 1, low: 2 };
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });
  }, [foreshadowings, selectedStatus, selectedCategory, searchQuery]);

  // ステータス別の件数
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: foreshadowings.length };
    foreshadowings.forEach(f => {
      counts[f.status] = (counts[f.status] || 0) + 1;
    });
    return counts;
  }, [foreshadowings]);

  // タイムラインビュー用データ：章ごとの伏線ポイントをマップ
  const timelineData = useMemo(() => {
    const chapterMap = new Map<string, {
      chapterId: string;
      chapterIndex: number;
      chapterTitle: string;
      points: Array<{
        foreshadowing: Foreshadowing;
        point: ForeshadowingPoint;
      }>;
      plannedPayoffs: Foreshadowing[];
    }>();

    // 全ての章を初期化
    chapters.forEach((chapter, idx) => {
      chapterMap.set(chapter.id, {
        chapterId: chapter.id,
        chapterIndex: idx,
        chapterTitle: chapter.title,
        points: [],
        plannedPayoffs: [],
      });
    });

    // 伏線ポイントを章にマッピング
    foreshadowings.forEach(f => {
      f.points.forEach(point => {
        const chapterData = chapterMap.get(point.chapterId);
        if (chapterData) {
          chapterData.points.push({ foreshadowing: f, point });
        }
      });

      // 予定回収章もマッピング
      if (f.plannedPayoffChapterId && f.status !== 'resolved') {
        const chapterData = chapterMap.get(f.plannedPayoffChapterId);
        if (chapterData) {
          chapterData.plannedPayoffs.push(f);
        }
      }
    });

    return Array.from(chapterMap.values()).sort((a, b) => a.chapterIndex - b.chapterIndex);
  }, [chapters, foreshadowings]);

  // 伏線の流れ（設置から回収まで）を計算
  const foreshadowingFlows = useMemo(() => {
    return foreshadowings.map(f => {
      const sortedPoints = [...f.points].sort((a, b) => {
        const idxA = chapters.findIndex(c => c.id === a.chapterId);
        const idxB = chapters.findIndex(c => c.id === b.chapterId);
        return idxA - idxB;
      });

      const firstPoint = sortedPoints[0];
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      const startChapterIdx = firstPoint ? chapters.findIndex(c => c.id === firstPoint.chapterId) : -1;
      const endChapterIdx = lastPoint ? chapters.findIndex(c => c.id === lastPoint.chapterId) : -1;
      const plannedPayoffIdx = f.plannedPayoffChapterId
        ? chapters.findIndex(c => c.id === f.plannedPayoffChapterId)
        : -1;

      return {
        foreshadowing: f,
        points: sortedPoints,
        startChapterIdx,
        endChapterIdx,
        plannedPayoffIdx,
        hasPayoff: sortedPoints.some(p => p.type === 'payoff'),
      };
    }).filter(flow => flow.startChapterIdx >= 0);
  }, [foreshadowings, chapters]);

  // 統計データ
  const statsData = useMemo(() => {
    const total = foreshadowings.length;
    const resolved = foreshadowings.filter(f => f.status === 'resolved').length;
    const planted = foreshadowings.filter(f => f.status === 'planted').length;
    const hinted = foreshadowings.filter(f => f.status === 'hinted').length;
    const abandoned = foreshadowings.filter(f => f.status === 'abandoned').length;

    const byCategory = Object.keys(categoryConfig).map(key => ({
      category: key as Foreshadowing['category'],
      count: foreshadowings.filter(f => f.category === key).length,
    }));

    const byImportance = {
      high: foreshadowings.filter(f => f.importance === 'high').length,
      medium: foreshadowings.filter(f => f.importance === 'medium').length,
      low: foreshadowings.filter(f => f.importance === 'low').length,
    };

    const unresolvedHighImportance = foreshadowings.filter(
      f => f.importance === 'high' && (f.status === 'planted' || f.status === 'hinted')
    ).length;

    // 章ごとの伏線密度
    const chapterDensity = chapters.map((chapter, idx) => {
      const pointsInChapter = foreshadowings.reduce((acc, f) => {
        return acc + f.points.filter(p => p.chapterId === chapter.id).length;
      }, 0);
      return { chapterIndex: idx, title: chapter.title, density: pointsInChapter };
    });

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total,
      resolved,
      planted,
      hinted,
      abandoned,
      byCategory,
      byImportance,
      unresolvedHighImportance,
      chapterDensity,
      resolutionRate,
    };
  }, [foreshadowings, chapters]);

  if (!isOpen || !currentProject) return null;

  // 伏線の追加
  const handleAddForeshadowing = () => {
    if (!formData.title || !formData.description) {
      showWarning('タイトルと説明は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    const now = new Date();

    // 始まりの章が設定されていれば、自動的に設置ポイントを追加
    const initialPoints: ForeshadowingPoint[] = [];
    if (plantChapterId) {
      initialPoints.push({
        id: `${Date.now()}-plant`,
        chapterId: plantChapterId,
        type: 'plant',
        description: '伏線の設置',
        createdAt: now,
      });
    }

    const newForeshadowing: Foreshadowing = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description,
      importance: formData.importance || 'medium',
      status: formData.status || 'planted',
      category: formData.category || 'plot',
      points: [...initialPoints, ...(formData.points || [])],
      relatedCharacterIds: formData.relatedCharacterIds,
      plannedPayoffChapterId: formData.plannedPayoffChapterId || undefined,
      plannedPayoffDescription: formData.plannedPayoffDescription || undefined,
      tags: formData.tags || [],
      notes: formData.notes || undefined,
      createdAt: now,
      updatedAt: now,
    };

    updateProject({
      foreshadowings: [...foreshadowings, newForeshadowing],
    });

    resetForm();
    setShowAddForm(false);
  };

  // 伏線の編集
  const handleEditForeshadowing = (foreshadowing: Foreshadowing) => {
    setEditingForeshadowing(foreshadowing);
    setFormData({
      title: foreshadowing.title,
      description: foreshadowing.description,
      importance: foreshadowing.importance,
      status: foreshadowing.status,
      category: foreshadowing.category,
      points: foreshadowing.points,
      relatedCharacterIds: foreshadowing.relatedCharacterIds || [],
      plannedPayoffChapterId: foreshadowing.plannedPayoffChapterId || '',
      plannedPayoffDescription: foreshadowing.plannedPayoffDescription || '',
      tags: foreshadowing.tags || [],
      notes: foreshadowing.notes || '',
    });
    // 最初の設置ポイントの章IDを設定
    const firstPlantPoint = foreshadowing.points.find(p => p.type === 'plant');
    setPlantChapterId(firstPlantPoint?.chapterId || '');
    setShowAddForm(true);
  };

  // 伏線の更新
  const handleUpdateForeshadowing = () => {
    if (!editingForeshadowing || !formData.title || !formData.description) {
      showWarning('タイトルと説明は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    // 既存のポイントを取得
    let updatedPoints = [...(formData.points || [])];

    // 始まりの章が設定されていて、まだ設置ポイントがない場合は追加
    if (plantChapterId) {
      const hasPlantPoint = updatedPoints.some(p => p.type === 'plant' && p.chapterId === plantChapterId);
      if (!hasPlantPoint) {
        // 既存の最初の設置ポイントを削除（新しい章に変更された場合）
        const existingPlantPoint = updatedPoints.find(p => p.type === 'plant');
        if (existingPlantPoint) {
          updatedPoints = updatedPoints.filter(p => p.id !== existingPlantPoint.id);
        }
        // 新しい設置ポイントを追加
        updatedPoints.unshift({
          id: `${Date.now()}-plant`,
          chapterId: plantChapterId,
          type: 'plant',
          description: existingPlantPoint?.description || '伏線の設置',
          createdAt: existingPlantPoint?.createdAt || new Date(),
        });
      }
    }

    const updatedForeshadowing: Foreshadowing = {
      ...editingForeshadowing,
      title: formData.title,
      description: formData.description,
      importance: formData.importance || 'medium',
      status: formData.status || 'planted',
      category: formData.category || 'plot',
      points: updatedPoints,
      relatedCharacterIds: formData.relatedCharacterIds,
      plannedPayoffChapterId: formData.plannedPayoffChapterId || undefined,
      plannedPayoffDescription: formData.plannedPayoffDescription || undefined,
      tags: formData.tags || [],
      notes: formData.notes || undefined,
      updatedAt: new Date(),
    };

    updateProject({
      foreshadowings: foreshadowings.map(f =>
        f.id === editingForeshadowing.id ? updatedForeshadowing : f
      ),
    });

    resetForm();
    setEditingForeshadowing(null);
    setShowAddForm(false);
  };

  // 伏線の削除
  const handleDeleteForeshadowing = (id: string) => {
    setDeletingForeshadowingId(id);
  };

  const handleConfirmDeleteForeshadowing = () => {
    if (!deletingForeshadowingId) return;
    updateProject({
      foreshadowings: foreshadowings.filter(f => f.id !== deletingForeshadowingId),
    });
    setDeletingForeshadowingId(null);
  };

  // ポイントの追加
  const handleAddPoint = (foreshadowingId: string) => {
    if (!pointFormData.chapterId || !pointFormData.description) {
      showWarning('章と説明は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    const newPoint: ForeshadowingPoint = {
      id: Date.now().toString(),
      chapterId: pointFormData.chapterId,
      type: pointFormData.type || 'plant',
      description: pointFormData.description,
      lineReference: pointFormData.lineReference || undefined,
      createdAt: new Date(),
    };

    const updatedForeshadowings = foreshadowings.map(f => {
      if (f.id === foreshadowingId) {
        // ステータスを自動更新
        let newStatus = f.status;
        if (newPoint.type === 'payoff') {
          newStatus = 'resolved';
        } else if (newPoint.type === 'hint' && f.status === 'planted') {
          newStatus = 'hinted';
        }

        return {
          ...f,
          points: [...f.points, newPoint],
          status: newStatus,
          updatedAt: new Date(),
        };
      }
      return f;
    });

    updateProject({ foreshadowings: updatedForeshadowings });

    setPointFormData({
      chapterId: '',
      type: 'plant',
      description: '',
      lineReference: '',
    });
    setShowPointForm(null);
  };

  // ポイントの削除
  const handleDeletePoint = (foreshadowingId: string, pointId: string) => {
    setDeletingPointInfo({ foreshadowingId, pointId });
  };

  const handleConfirmDeletePoint = () => {
    if (!deletingPointInfo) return;

    const updatedForeshadowings = foreshadowings.map(f => {
      if (f.id === deletingPointInfo.foreshadowingId) {
        const newPoints = f.points.filter(p => p.id !== deletingPointInfo.pointId);

        // ステータスを再計算
        let newStatus: Foreshadowing['status'] = 'planted';
        if (newPoints.some(p => p.type === 'payoff')) {
          newStatus = 'resolved';
        } else if (newPoints.some(p => p.type === 'hint')) {
          newStatus = 'hinted';
        }

        return {
          ...f,
          points: newPoints,
          status: (f.status === 'abandoned' ? 'abandoned' : newStatus) as Foreshadowing['status'],
          updatedAt: new Date(),
        };
      }
      return f;
    });

    updateProject({ foreshadowings: updatedForeshadowings });
    setDeletingPointInfo(null);
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      importance: 'medium',
      status: 'planted',
      category: 'plot',
      points: [],
      relatedCharacterIds: [],
      plannedPayoffChapterId: '',
      plannedPayoffDescription: '',
      tags: [],
      notes: '',
    });
    setPlantChapterId('');
    setTagInput('');
  };

  // タグ追加
  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const newTag = tagInput.trim();
    if (!formData.tags?.includes(newTag)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag],
      });
    }
    setTagInput('');
  };

  // タグ削除
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(tag => tag !== tagToRemove) || [],
    });
  };

  // 展開/折りたたみ
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // 章名を取得
  const getChapterTitle = (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    return chapter?.title || '不明な章';
  };

  // キャラクター名を取得
  const getCharacterName = (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    return character?.name || '不明';
  };

  // ヘルパー関数：AIレスポンスからJSONを安全にパース
  const parseAIJsonResponse = (content: string): unknown => {
    if (!content || typeof content !== 'string') {
      throw new Error('無効な応答内容です');
    }

    // aiResponseParserのparseAIResponseを使用
    const parsed = parseAIResponse(content, 'json');

    if (!parsed.success) {
      // エラーの詳細をログに記録
      console.error('JSON parsing failed:', parsed.error);
      console.debug('Raw content (first 500 chars):', content.substring(0, 500));

      throw new Error(parsed.error || 'JSONの解析に失敗しました');
    }

    if (!parsed.data) {
      throw new Error('JSONデータが見つかりませんでした');
    }

    return parsed.data;
  };

  // ヘルパー関数：プロジェクト情報をプロンプト用にフォーマット
  const buildProjectInfo = (): Record<string, string> => {
    if (!currentProject) return {
      title: '',
      mainGenre: '',
      subGenre: '',
      theme: '',
      plotTheme: '',
      plotSetting: '',
      plotHook: '',
      protagonistGoal: '',
      mainObstacle: '',
      structureInfo: '',
      characters: '',
      chapters: '',
      synopsis: '',
      existingForeshadowings: '',
      foreshadowings: '',
    };

    const structureInfo = currentProject.plot.structure === 'kishotenketsu'
      ? `起: ${currentProject.plot.ki || '未設定'}\n承: ${currentProject.plot.sho || '未設定'}\n転: ${currentProject.plot.ten || '未設定'}\n結: ${currentProject.plot.ketsu || '未設定'}`
      : currentProject.plot.structure === 'three-act'
        ? `第1幕: ${currentProject.plot.act1 || '未設定'}\n第2幕: ${currentProject.plot.act2 || '未設定'}\n第3幕: ${currentProject.plot.act3 || '未設定'}`
        : `第1幕: ${currentProject.plot.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot.fourAct4 || '未設定'}`;

    const charactersInfo = characters.map(c =>
      `- ${c.name}（${c.role}）: ${c.personality || '性格未設定'}`
    ).join('\n') || '未設定';

    const chaptersInfo = chapters.map((c, idx) =>
      `第${idx + 1}章: ${c.title}${c.summary ? ` - ${c.summary}` : ''}`
    ).join('\n') || '未設定';

    const existingForeshadowingsInfo = foreshadowings.map(f => {
      const categoryInfo = categoryConfig[f.category] || categoryConfig.other;
      const statusInfo = statusConfig[f.status] || statusConfig.planted;
      return `- ${f.title}（${categoryInfo.label}）[${statusInfo.label}]: ${f.description}`;
    }).join('\n') || 'なし';

    return {
      title: currentProject.title,
      mainGenre: currentProject.mainGenre || currentProject.genre || '未設定',
      subGenre: currentProject.subGenre || '未設定',
      theme: currentProject.projectTheme || currentProject.theme || '未設定',
      plotTheme: currentProject.plot.theme || '未設定',
      plotSetting: currentProject.plot.setting || '未設定',
      plotHook: currentProject.plot.hook || '未設定',
      protagonistGoal: currentProject.plot.protagonistGoal || '未設定',
      mainObstacle: currentProject.plot.mainObstacle || '未設定',
      structureInfo,
      characters: charactersInfo,
      chapters: chaptersInfo,
      synopsis: currentProject.synopsis || '未設定',
      existingForeshadowings: existingForeshadowingsInfo,
      foreshadowings: existingForeshadowingsInfo,
    };
  };

  // AI伏線提案
  const handleAISuggest = async () => {
    if (!currentProject) return;

    setIsAILoading(true);
    setAiError(null);
    setAiSuggestions([]);

    try {
      const projectInfo = buildProjectInfo();
      const prompt = aiService.buildPrompt('foreshadowing', 'suggest', projectInfo);

      const response = await aiService.generateContent({
        prompt,
        type: 'foreshadowing',
        settings: aiSettings,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // JSONをパース
      if (!response.content) {
        throw new Error('AIからの応答が空です');
      }

      const parsed = parseAIJsonResponse(response.content) as { suggestions?: typeof aiSuggestions };

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI応答の形式が正しくありません');
      }

      setAiSuggestions(parsed.suggestions || []);
    } catch (error) {
      console.error('AI suggest error:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : '伏線提案の生成に失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI整合性チェック
  const handleConsistencyCheck = async () => {
    if (!currentProject || foreshadowings.length === 0) return;

    setIsAILoading(true);
    setAiError(null);
    setConsistencyResult(null);

    try {
      const projectInfo = buildProjectInfo();
      const prompt = aiService.buildPrompt('foreshadowing', 'checkConsistency', projectInfo);

      const response = await aiService.generateContent({
        prompt,
        type: 'foreshadowing',
        settings: aiSettings,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.content) {
        throw new Error('AIからの応答が空です');
      }

      const parsed = parseAIJsonResponse(response.content) as typeof consistencyResult;

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI応答の形式が正しくありません');
      }

      setConsistencyResult(parsed);
      setShowConsistencyModal(true);
    } catch (error) {
      console.error('AI consistency check error:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : '整合性チェックに失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI伏線強化提案
  const handleEnhanceForeshadowing = async (foreshadowing: Foreshadowing) => {
    if (!currentProject) return;

    setIsAILoading(true);
    setAiError(null);
    setEnhanceResult(null);
    setSelectedForEnhance(foreshadowing);

    try {
      const projectInfo = buildProjectInfo();
      const relatedChars = foreshadowing.relatedCharacterIds?.map(id => getCharacterName(id)).join(', ') || 'なし';
      const currentPoints = foreshadowing.points.map(p =>
        `${pointTypeConfig[p.type].label}: ${p.description} (${getChapterTitle(p.chapterId)})`
      ).join('\n') || 'なし';

      const categoryInfo = categoryConfig[foreshadowing.category] || categoryConfig.other;
      const importanceInfo = importanceConfig[foreshadowing.importance] || importanceConfig.medium;
      const statusInfo = statusConfig[foreshadowing.status] || statusConfig.planted;
      const prompt = aiService.buildPrompt('foreshadowing', 'enhance', {
        ...projectInfo,
        foreshadowingTitle: foreshadowing.title,
        foreshadowingDescription: foreshadowing.description,
        foreshadowingCategory: categoryInfo.label,
        foreshadowingImportance: importanceInfo.label,
        foreshadowingStatus: statusInfo.label,
        currentPoints,
        plannedPayoff: foreshadowing.plannedPayoffDescription || '未設定',
        relatedCharacters: relatedChars,
        themeConnection: `この伏線はプロジェクトのテーマ「${projectInfo.theme}」と関連している可能性があります。`,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'foreshadowing',
        settings: aiSettings,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.content) {
        throw new Error('AIからの応答が空です');
      }

      const parsed = parseAIJsonResponse(response.content) as typeof enhanceResult;

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI応答の形式が正しくありません');
      }

      setEnhanceResult(parsed);
      setShowEnhanceModal(true);
    } catch (error) {
      console.error('AI enhance error:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : '伏線強化提案の生成に失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI回収タイミング提案
  const handleSuggestPayoff = async (foreshadowing: Foreshadowing) => {
    if (!currentProject) return;

    setIsAILoading(true);
    setAiError(null);
    setPayoffResult(null);
    setSelectedForPayoff(foreshadowing);

    try {
      const projectInfo = buildProjectInfo();
      const relatedChars = foreshadowing.relatedCharacterIds?.map(id => {
        const char = characters.find(c => c.id === id);
        return char ? `${char.name}（${char.role}）: ${char.personality || '性格未設定'}` : '';
      }).filter(Boolean).join('\n') || 'なし';
      const currentPoints = foreshadowing.points.map(p =>
        `${pointTypeConfig[p.type].label}: ${p.description} (${getChapterTitle(p.chapterId)})`
      ).join('\n') || 'なし';
      const otherForeshadowings = foreshadowings
        .filter(f => f.id !== foreshadowing.id)
        .map(f => {
          const statusInfo = statusConfig[f.status] || statusConfig.planted;
          return `- ${f.title}（${statusInfo.label}）`;
        })
        .join('\n') || 'なし';

      const prompt = aiService.buildPrompt('foreshadowing', 'suggestPayoff', {
        ...projectInfo,
        foreshadowingTitle: foreshadowing.title,
        foreshadowingDescription: foreshadowing.description,
        foreshadowingCategory: (categoryConfig[foreshadowing.category] || categoryConfig.other).label,
        foreshadowingImportance: (importanceConfig[foreshadowing.importance] || importanceConfig.medium).label,
        currentPoints,
        relatedCharacters: relatedChars,
        otherForeshadowings,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'foreshadowing',
        settings: aiSettings,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.content) {
        throw new Error('AIからの応答が空です');
      }

      const parsed = parseAIJsonResponse(response.content) as typeof payoffResult;

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI応答の形式が正しくありません');
      }

      setPayoffResult(parsed);
      setShowPayoffModal(true);
    } catch (error) {
      console.error('AI payoff suggest error:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : '回収タイミング提案の生成に失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI提案から伏線を追加
  const handleAddFromSuggestion = (suggestion: typeof aiSuggestions[0]) => {
    const now = new Date();

    // 関連キャラクターのIDを検索
    const relatedCharacterIds = suggestion.relatedCharacters
      .map(name => characters.find(c => c.name === name)?.id)
      .filter((id): id is string => !!id);

    // 推奨章のIDを検索
    const plantChapterMatch = suggestion.plantChapter.match(/第(\d+)章/);
    const payoffChapterMatch = suggestion.payoffChapter.match(/第(\d+)章/);
    const plantChapterId = plantChapterMatch ? chapters[parseInt(plantChapterMatch[1]) - 1]?.id : undefined;
    const payoffChapterId = payoffChapterMatch ? chapters[parseInt(payoffChapterMatch[1]) - 1]?.id : undefined;

    // 設置ポイントを自動作成
    const initialPoints: ForeshadowingPoint[] = plantChapterId ? [{
      id: `${Date.now()}-plant`,
      chapterId: plantChapterId,
      type: 'plant',
      description: suggestion.plantDescription,
      createdAt: now,
    }] : [];

    const newForeshadowing: Foreshadowing = {
      id: Date.now().toString(),
      title: suggestion.title,
      description: suggestion.description,
      importance: suggestion.importance,
      status: 'planted',
      category: suggestion.category,
      points: initialPoints,
      relatedCharacterIds,
      plannedPayoffChapterId: payoffChapterId,
      plannedPayoffDescription: suggestion.payoffDescription,
      tags: [],
      notes: `AI提案から作成\n設置推奨: ${suggestion.plantChapter} - ${suggestion.plantDescription}\n期待効果: ${suggestion.effect}`,
      createdAt: now,
      updatedAt: now,
    };

    updateProject({
      foreshadowings: [...foreshadowings, newForeshadowing],
    });

    // 提案リストから削除
    setAiSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-2 rounded-lg">
              <Bookmark className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                伏線トラッカー
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                伏線の設置・回収を管理
              </p>
            </div>
          </div>
        }
        size="xl"
        ref={modalRef}
      >
        <div className="flex flex-col h-[80vh]">
          {/* ビュー切り替えタブ */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setCurrentView('list')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors font-['Noto_Sans_JP'] ${currentView === 'list'
                    ? 'bg-white dark:bg-gray-600 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <List className="h-4 w-4" />
                <span>リスト</span>
              </button>
              <button
                onClick={() => setCurrentView('timeline')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors font-['Noto_Sans_JP'] ${currentView === 'timeline'
                    ? 'bg-white dark:bg-gray-600 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <Calendar className="h-4 w-4" />
                <span>タイムライン</span>
              </button>
              <button
                onClick={() => setCurrentView('stats')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors font-['Noto_Sans_JP'] ${currentView === 'stats'
                    ? 'bg-white dark:bg-gray-600 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>統計</span>
              </button>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
              {foreshadowings.length}件の伏線 / {chapters.length}章
            </div>
          </div>

          {/* リストビュー専用のヘッダー */}
          {currentView === 'list' && (
            <>
              {/* ヘッダーアクション */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {/* ステータスタブ */}
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setSelectedStatus('all')}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors font-['Noto_Sans_JP'] ${selectedStatus === 'all'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                      全て ({statusCounts.all || 0})
                    </button>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedStatus(key)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors font-['Noto_Sans_JP'] ${selectedStatus === key
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                      >
                        {config.label} ({statusCounts[key] || 0})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* AI機能ボタン */}
                  <button
                    onClick={() => setShowAIPanel(!showAIPanel)}
                    disabled={isAILoading}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${showAIPanel
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                      }`}
                  >
                    {isAILoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span className="text-sm font-['Noto_Sans_JP']">AI</span>
                  </button>

                  <button
                    onClick={() => {
                      resetForm();
                      setEditingForeshadowing(null);
                      setShowAddForm(true);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-lg hover:from-rose-600 hover:to-pink-700 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="font-['Noto_Sans_JP']">追加</span>
                  </button>
                </div>
              </div>

              {/* AIパネル */}
              {showAIPanel && (
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 font-['Noto_Sans_JP'] flex items-center space-x-2">
                      <Sparkles className="h-5 w-5" />
                      <span>AI伏線アシスタント</span>
                    </h4>
                    <button
                      onClick={() => setShowAIPanel(false)}
                      className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* AIエラー表示 */}
                  {aiError && (
                    <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">{aiError}</p>
                    </div>
                  )}

                  {/* AI機能ボタン群 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                    <button
                      onClick={handleAISuggest}
                      disabled={isAILoading}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
                    >
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-['Noto_Sans_JP']">伏線提案</span>
                    </button>
                    <button
                      onClick={handleConsistencyCheck}
                      disabled={isAILoading || foreshadowings.length === 0}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
                    >
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-['Noto_Sans_JP']">整合性チェック</span>
                    </button>
                  </div>

                  {/* AI提案リスト */}
                  {aiSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-purple-800 dark:text-purple-200 font-['Noto_Sans_JP']">
                        💡 AI提案（{aiSuggestions.length}件）
                      </h5>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {aiSuggestions.map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                    {suggestion.title}
                                  </span>
                                  <span className={`px-2 py-0.5 text-xs text-white rounded-full ${categoryConfig[suggestion.category]?.color || 'bg-gray-500'}`}>
                                    {categoryConfig[suggestion.category]?.label || suggestion.category}
                                  </span>
                                  <span className={`text-xs ${importanceConfig[suggestion.importance]?.color || 'text-gray-500'}`}>
                                    {importanceConfig[suggestion.importance]?.stars || ''}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                                  {suggestion.description}
                                </p>
                                <div className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP'] space-y-1">
                                  <p>📍 設置: {suggestion.plantChapter} - {suggestion.plantDescription}</p>
                                  <p>🎯 回収: {suggestion.payoffChapter} - {suggestion.payoffDescription}</p>
                                  <p>✨ 効果: {suggestion.effect}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleAddFromSuggestion(suggestion)}
                                className="ml-2 px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP']"
                              >
                                採用
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ローディング表示 */}
                  {isAILoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                      <span className="ml-2 text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP']">
                        AI分析中...
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* フィルタ */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="伏線を検索..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                >
                  <option value="all">全カテゴリ</option>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* 伏線リスト */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {filteredForeshadowings.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <EmptyState
                      icon={Bookmark}
                      iconColor="text-rose-400 dark:text-rose-500"
                      title={foreshadowings.length === 0
                        ? 'まだ伏線が登録されていません'
                        : '条件に一致する伏線がありません'}
                      description={foreshadowings.length === 0
                        ? '物語に伏線を設定して、読者を引き込む仕掛けを作りましょう。キャラクター、プロット、世界観など、様々な要素に伏線を仕込むことで、物語に深みと興味を生み出せます。伏線の設置、ヒント、回収を管理して、物語の完成度を高めましょう。'
                        : '検索条件やフィルターを変更して、再度お試しください。'}
                      actionLabel={foreshadowings.length === 0 ? '最初の伏線を追加' : undefined}
                      onAction={foreshadowings.length === 0 ? () => setShowAddForm(true) : undefined}
                    />
                  </div>
                ) : (
                  filteredForeshadowings.map((foreshadowing) => {
                    const isExpanded = expandedIds.has(foreshadowing.id);
                    const statusInfo = statusConfig[foreshadowing.status] || statusConfig.planted;
                    const importanceInfo = importanceConfig[foreshadowing.importance] || importanceConfig.medium;
                    const categoryInfo = categoryConfig[foreshadowing.category] || categoryConfig.other;
                    const StatusIcon = statusInfo.icon;

                    return (
                      <div
                        key={foreshadowing.id}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* ヘッダー */}
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className={`${statusInfo.color} p-2 rounded-lg`}>
                                <StatusIcon className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] truncate">
                                    {foreshadowing.title}
                                  </h3>
                                  <span className={`text-sm ${importanceInfo.color}`}>
                                    {importanceInfo.stars}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className={`px-2 py-0.5 text-xs text-white rounded-full ${categoryInfo.color}`}>
                                    {categoryInfo.label}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                    {statusInfo.label}
                                  </span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 text-sm font-['Noto_Sans_JP'] line-clamp-2">
                                  {foreshadowing.description}
                                </p>

                                {/* ポイントサマリー */}
                                {foreshadowing.points.length > 0 && (
                                  <div className="flex items-center space-x-3 mt-2 text-sm">
                                    {foreshadowing.points.map((point, idx) => {
                                      const pointTypeInfo = pointTypeConfig[point.type] || pointTypeConfig.plant;
                                      return (
                                        <span
                                          key={point.id}
                                          className={`flex items-center space-x-1 ${pointTypeInfo.color}`}
                                        >
                                          <span>{pointTypeInfo.icon}</span>
                                          <span className="font-['Noto_Sans_JP']">
                                            {chapters.findIndex(c => c.id === point.chapterId) + 1}章
                                          </span>
                                          {idx < foreshadowing.points.length - 1 && (
                                            <span className="text-gray-300 dark:text-gray-600 ml-2">→</span>
                                          )}
                                        </span>
                                      );
                                    })}
                                    {foreshadowing.plannedPayoffChapterId && foreshadowing.status !== 'resolved' && (
                                      <>
                                        <span className="text-gray-300 dark:text-gray-600">→</span>
                                        <span className="text-gray-400 font-['Noto_Sans_JP']">
                                          🎯 {chapters.findIndex(c => c.id === foreshadowing.plannedPayoffChapterId) + 1}章(予定)
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* タグ */}
                                {foreshadowing.tags && foreshadowing.tags.length > 0 && (
                                  <div className="flex items-center flex-wrap gap-1 mt-2">
                                    {foreshadowing.tags.map(tag => (
                                      <span
                                        key={tag}
                                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full font-['Noto_Sans_JP']"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => toggleExpand(foreshadowing.id)}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                              <button
                                onClick={() => handleEditForeshadowing(foreshadowing)}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteForeshadowing(foreshadowing.id)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 展開コンテンツ */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                            {/* ポイント一覧 */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                  ポイント
                                </h4>
                                <button
                                  onClick={() => setShowPointForm(foreshadowing.id)}
                                  className="flex items-center space-x-1 text-sm text-rose-600 dark:text-rose-400 hover:underline font-['Noto_Sans_JP']"
                                >
                                  <Plus className="h-4 w-4" />
                                  <span>追加</span>
                                </button>
                              </div>

                              {foreshadowing.points.length === 0 ? (
                                <div className="py-6 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                  <Target className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                                  <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                                    ポイントがまだ登録されていません
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                                    伏線の設置、ヒント、回収のポイントを追加しましょう
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {foreshadowing.points
                                    .sort((a, b) => {
                                      const chapterOrderA = chapters.findIndex(c => c.id === a.chapterId);
                                      const chapterOrderB = chapters.findIndex(c => c.id === b.chapterId);
                                      return chapterOrderA - chapterOrderB;
                                    })
                                    .map(point => {
                                      const pointTypeInfo = pointTypeConfig[point.type] || pointTypeConfig.plant;
                                      return (
                                        <div
                                          key={point.id}
                                          className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                        >
                                          <span className="text-lg">{pointTypeInfo.icon}</span>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                              <span className={`text-sm font-medium ${pointTypeInfo.color}`}>
                                                {pointTypeInfo.label}
                                              </span>
                                              <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                                第{chapters.findIndex(c => c.id === point.chapterId) + 1}章「{getChapterTitle(point.chapterId)}」
                                              </span>
                                            </div>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                              {point.description}
                                            </p>
                                            {point.lineReference && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic font-['Noto_Sans_JP']">
                                                「{point.lineReference}」
                                              </p>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => handleDeletePoint(foreshadowing.id, point.id)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}

                              {/* ポイント追加フォーム */}
                              {showPointForm === foreshadowing.id && (
                                <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-rose-200 dark:border-rose-800">
                                  <h5 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                                    ポイントを追加
                                  </h5>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                          タイプ
                                        </label>
                                        <select
                                          value={pointFormData.type}
                                          onChange={(e) => setPointFormData({ ...pointFormData, type: e.target.value as ForeshadowingPoint['type'] })}
                                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        >
                                          <option value="plant">📍 設置</option>
                                          <option value="hint">💡 ヒント</option>
                                          <option value="payoff">🎯 回収</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                          章 <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                          value={pointFormData.chapterId}
                                          onChange={(e) => setPointFormData({ ...pointFormData, chapterId: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        >
                                          <option value="">選択してください</option>
                                          {chapters.map((chapter, idx) => (
                                            <option key={chapter.id} value={chapter.id}>
                                              第{idx + 1}章: {chapter.title}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                        説明 <span className="text-red-500">*</span>
                                      </label>
                                      <textarea
                                        value={pointFormData.description}
                                        onChange={(e) => setPointFormData({ ...pointFormData, description: e.target.value })}
                                        rows={2}
                                        placeholder="このポイントで何が起こるか..."
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']">
                                        引用（任意）
                                      </label>
                                      <input
                                        type="text"
                                        value={pointFormData.lineReference}
                                        onChange={(e) => setPointFormData({ ...pointFormData, lineReference: e.target.value })}
                                        placeholder="該当する文章を引用..."
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
                                      />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                      <button
                                        onClick={() => setShowPointForm(null)}
                                        className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-['Noto_Sans_JP']"
                                      >
                                        キャンセル
                                      </button>
                                      <button
                                        onClick={() => handleAddPoint(foreshadowing.id)}
                                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-['Noto_Sans_JP']"
                                      >
                                        追加
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 関連キャラクター */}
                            {foreshadowing.relatedCharacterIds && foreshadowing.relatedCharacterIds.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                                  <Users className="h-4 w-4" />
                                  <span>関連キャラクター</span>
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {foreshadowing.relatedCharacterIds.map(charId => (
                                    <span
                                      key={charId}
                                      className="px-2 py-1 text-sm bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full font-['Noto_Sans_JP']"
                                    >
                                      {getCharacterName(charId)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 回収予定 */}
                            {foreshadowing.plannedPayoffChapterId && foreshadowing.status !== 'resolved' && (
                              <div className="mb-4">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                                  <Target className="h-4 w-4" />
                                  <span>回収予定</span>
                                </h4>
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                  <p className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                                    第{chapters.findIndex(c => c.id === foreshadowing.plannedPayoffChapterId) + 1}章「{getChapterTitle(foreshadowing.plannedPayoffChapterId)}」
                                  </p>
                                  {foreshadowing.plannedPayoffDescription && (
                                    <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
                                      {foreshadowing.plannedPayoffDescription}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* メモ */}
                            {foreshadowing.notes && (
                              <div className="mb-4">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                                  メモ
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] whitespace-pre-wrap">
                                  {foreshadowing.notes}
                                </p>
                              </div>
                            )}

                            {/* AIアクション */}
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                                <span>AIアシスト</span>
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleEnhanceForeshadowing(foreshadowing)}
                                  disabled={isAILoading}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
                                >
                                  <Wand2 className="h-4 w-4" />
                                  <span>強化提案</span>
                                </button>
                                {foreshadowing.status !== 'resolved' && (
                                  <button
                                    onClick={() => handleSuggestPayoff(foreshadowing)}
                                    disabled={isAILoading}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
                                  >
                                    <Target className="h-4 w-4" />
                                    <span>回収タイミング提案</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* 未回収伏線の警告 */}
              {foreshadowings.filter(f => f.status === 'planted' || f.status === 'hinted').length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                      {foreshadowings.filter(f => f.status === 'planted' || f.status === 'hinted').length}件の伏線が未回収です
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* タイムラインビュー */}
          {currentView === 'timeline' && (
            <div className="flex-1 overflow-y-auto">
              {chapters.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    章が作成されていません。先に章立てを設定してください。
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* 章のタイムライン */}
                  <div className="space-y-4">
                    {timelineData.map((chapterData, idx) => {
                      const plantPoints = chapterData.points.filter(p => p.point.type === 'plant');
                      const hintPoints = chapterData.points.filter(p => p.point.type === 'hint');
                      const payoffPoints = chapterData.points.filter(p => p.point.type === 'payoff');
                      const hasContent = chapterData.points.length > 0 || chapterData.plannedPayoffs.length > 0;

                      return (
                        <div key={chapterData.chapterId} className="relative">
                          {/* 章ヘッダー */}
                          <div className={`flex items-center space-x-4 p-3 rounded-lg ${hasContent
                              ? 'bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-800'
                              : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                            }`}>
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${hasContent ? 'bg-rose-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                              }`}>
                              <span className="font-bold text-sm">{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] truncate">
                                第{idx + 1}章: {chapterData.chapterTitle}
                              </h4>
                              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {plantPoints.length > 0 && (
                                  <span className="flex items-center space-x-1">
                                    <span>📍</span>
                                    <span>{plantPoints.length}設置</span>
                                  </span>
                                )}
                                {hintPoints.length > 0 && (
                                  <span className="flex items-center space-x-1">
                                    <span>💡</span>
                                    <span>{hintPoints.length}ヒント</span>
                                  </span>
                                )}
                                {payoffPoints.length > 0 && (
                                  <span className="flex items-center space-x-1">
                                    <span>🎯</span>
                                    <span>{payoffPoints.length}回収</span>
                                  </span>
                                )}
                                {chapterData.plannedPayoffs.length > 0 && (
                                  <span className="flex items-center space-x-1 text-amber-500">
                                    <span>⏳</span>
                                    <span>{chapterData.plannedPayoffs.length}回収予定</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${chapterData.points.length > 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                  chapterData.points.length > 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                密度: {chapterData.points.length}
                              </span>
                            </div>
                          </div>

                          {/* 伏線ポイント詳細 */}
                          {hasContent && (
                            <div className="ml-14 mt-2 space-y-2">
                              {/* 設置ポイント */}
                              {plantPoints.map(({ foreshadowing, point }) => {
                                const importanceInfo = importanceConfig[foreshadowing.importance] || importanceConfig.medium;
                                const categoryInfo = categoryConfig[foreshadowing.category] || categoryConfig.other;
                                return (
                                  <div
                                    key={point.id}
                                    className="flex items-start space-x-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500"
                                  >
                                    <span className="text-lg">📍</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-medium text-blue-700 dark:text-blue-300 text-sm font-['Noto_Sans_JP']">
                                          {foreshadowing.title}
                                        </span>
                                        <span className={`text-xs ${importanceInfo.color}`}>
                                          {importanceInfo.stars}
                                        </span>
                                      </div>
                                      <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP'] mt-0.5">
                                        {point.description}
                                      </p>
                                    </div>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${categoryInfo.color} text-white`}>
                                      {categoryInfo.label}
                                    </span>
                                  </div>
                                );
                              })}

                              {/* ヒントポイント */}
                              {hintPoints.map(({ foreshadowing, point }) => (
                                <div
                                  key={point.id}
                                  className="flex items-start space-x-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-4 border-amber-500"
                                >
                                  <span className="text-lg">💡</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium text-amber-700 dark:text-amber-300 text-sm font-['Noto_Sans_JP']">
                                        {foreshadowing.title}
                                      </span>
                                    </div>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP'] mt-0.5">
                                      {point.description}
                                    </p>
                                  </div>
                                </div>
                              ))}

                              {/* 回収ポイント */}
                              {payoffPoints.map(({ foreshadowing, point }) => (
                                <div
                                  key={point.id}
                                  className="flex items-start space-x-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500"
                                >
                                  <span className="text-lg">🎯</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium text-green-700 dark:text-green-300 text-sm font-['Noto_Sans_JP']">
                                        {foreshadowing.title}
                                      </span>
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    </div>
                                    <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP'] mt-0.5">
                                      {point.description}
                                    </p>
                                  </div>
                                </div>
                              ))}

                              {/* 回収予定 */}
                              {chapterData.plannedPayoffs.map(f => (
                                <div
                                  key={`planned-${f.id}`}
                                  className="flex items-start space-x-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-dashed border-amber-400"
                                >
                                  <span className="text-lg opacity-50">🎯</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium text-gray-500 dark:text-gray-400 text-sm font-['Noto_Sans_JP']">
                                        {f.title}
                                      </span>
                                      <span className="text-xs text-amber-500 font-['Noto_Sans_JP']">回収予定</span>
                                    </div>
                                    {f.plannedPayoffDescription && (
                                      <p className="text-xs text-gray-400 dark:text-gray-500 font-['Noto_Sans_JP'] mt-0.5">
                                        {f.plannedPayoffDescription}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 接続線 */}
                          {idx < timelineData.length - 1 && (
                            <div className="absolute left-[34px] top-[56px] w-0.5 h-6 bg-gray-300 dark:bg-gray-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 伏線フロー可視化 */}
                  {foreshadowingFlows.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP'] flex items-center space-x-2">
                        <ArrowRight className="h-5 w-5" />
                        <span>伏線の流れ</span>
                      </h4>
                      <div className="space-y-3">
                        {foreshadowingFlows
                          .filter(flow => flow.points.length > 0)
                          .sort((a, b) => a.startChapterIdx - b.startChapterIdx)
                          .map(flow => {
                            const categoryInfo = categoryConfig[flow.foreshadowing.category] || categoryConfig.other;
                            return (
                              <div
                                key={flow.foreshadowing.id}
                                className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <span className={`px-2 py-1 text-xs rounded-full ${categoryInfo.color} text-white`}>
                                  {categoryInfo.label}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP'] min-w-0 truncate flex-shrink-0" style={{ maxWidth: '150px' }}>
                                  {flow.foreshadowing.title}
                                </span>
                                <div className="flex-1 flex items-center space-x-1 overflow-x-auto">
                                  {flow.points.map((point, idx) => {
                                    const pointTypeInfo = pointTypeConfig[point.type] || pointTypeConfig.plant;
                                    return (
                                      <React.Fragment key={point.id}>
                                        <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded ${point.type === 'plant' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                            point.type === 'hint' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                          }`}>
                                          {pointTypeInfo.icon} {chapters.findIndex(c => c.id === point.chapterId) + 1}章
                                        </span>
                                        {idx < flow.points.length - 1 && (
                                          <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                  {!flow.hasPayoff && flow.plannedPayoffIdx >= 0 && (
                                    <>
                                      <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                                      <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600">
                                        🎯 {flow.plannedPayoffIdx + 1}章(予定)
                                      </span>
                                    </>
                                  )}
                                </div>
                                {!flow.hasPayoff && (
                                  <span title="未回収">
                                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                  </span>
                                )}
                                {flow.hasPayoff && (
                                  <span title="回収済み">
                                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 統計ビュー */}
          {currentView === 'stats' && (
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* 概要カード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-4 rounded-xl text-white">
                  <div className="text-3xl font-bold">{statsData.total}</div>
                  <div className="text-sm opacity-80 font-['Noto_Sans_JP']">総伏線数</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl text-white">
                  <div className="text-3xl font-bold">{statsData.resolutionRate}%</div>
                  <div className="text-sm opacity-80 font-['Noto_Sans_JP']">回収率</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-xl text-white">
                  <div className="text-3xl font-bold">{statsData.planted + statsData.hinted}</div>
                  <div className="text-sm opacity-80 font-['Noto_Sans_JP']">未回収</div>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-rose-600 p-4 rounded-xl text-white">
                  <div className="text-3xl font-bold">{statsData.unresolvedHighImportance}</div>
                  <div className="text-sm opacity-80 font-['Noto_Sans_JP']">重要未回収</div>
                </div>
              </div>

              {/* ステータス別内訳 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                  ステータス別内訳
                </h4>
                <div className="space-y-3">
                  {[
                    { key: 'planted', label: '設置済み', count: statsData.planted, color: 'bg-blue-500' },
                    { key: 'hinted', label: '進行中', count: statsData.hinted, color: 'bg-amber-500' },
                    { key: 'resolved', label: '回収済み', count: statsData.resolved, color: 'bg-green-500' },
                    { key: 'abandoned', label: '破棄', count: statsData.abandoned, color: 'bg-gray-500' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] w-24">{item.label}</span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full ${item.color} transition-all duration-500`}
                          style={{ width: statsData.total > 0 ? `${(item.count / statsData.total) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                        {item.count}件
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* カテゴリ別内訳 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                  カテゴリ別内訳
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {statsData.byCategory.map(item => {
                    const categoryInfo = categoryConfig[item.category] || categoryConfig.other;
                    return (
                      <div
                        key={item.category}
                        className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryInfo.color} text-white font-bold text-sm`}>
                          {item.count}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                          {categoryInfo.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 重要度別内訳 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                  重要度別内訳
                </h4>
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-red-500 text-2xl font-bold">{statsData.byImportance.high}</div>
                    <div className="text-sm text-gray-500 font-['Noto_Sans_JP']">★★★ 高</div>
                  </div>
                  <div className="text-center">
                    <div className="text-amber-500 text-2xl font-bold">{statsData.byImportance.medium}</div>
                    <div className="text-sm text-gray-500 font-['Noto_Sans_JP']">★★☆ 中</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-2xl font-bold">{statsData.byImportance.low}</div>
                    <div className="text-sm text-gray-500 font-['Noto_Sans_JP']">★☆☆ 低</div>
                  </div>
                </div>
              </div>

              {/* 章別密度 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                  章別伏線密度
                </h4>
                {statsData.chapterDensity.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    章がまだ作成されていません
                  </p>
                ) : (
                  <div className="space-y-2">
                    {statsData.chapterDensity.map((chapter, idx) => {
                      const maxDensity = Math.max(...statsData.chapterDensity.map(c => c.density), 1);
                      return (
                        <div key={idx} className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500 w-16 font-['Noto_Sans_JP']">
                            第{chapter.chapterIndex + 1}章
                          </span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${chapter.density > 5 ? 'bg-red-500' :
                                  chapter.density > 2 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                              style={{ width: `${(chapter.density / maxDensity) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-6 text-right">
                            {chapter.density}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 警告 */}
              {statsData.unresolvedHighImportance > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                      重要度「高」の伏線が{statsData.unresolvedHighImportance}件未回収です。物語の完成度に影響する可能性があります。
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 伏線追加/編集フォーム */}
      <Modal
        isOpen={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setEditingForeshadowing(null);
          resetForm();
        }}
        title={editingForeshadowing ? '伏線を編集' : '新しい伏線を追加'}
        size="md"
        className="z-[60]"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例：主人公の過去の秘密"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              説明 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="この伏線の内容と意図..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                重要度
              </label>
              <select
                value={formData.importance}
                onChange={(e) => setFormData({ ...formData, importance: e.target.value as Foreshadowing['importance'] })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="high">★★★ 高</option>
                <option value="medium">★★☆ 中</option>
                <option value="low">★☆☆ 低</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                ステータス
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Foreshadowing['status'] })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="planted">設置済み</option>
                <option value="hinted">進行中</option>
                <option value="resolved">回収済み</option>
                <option value="abandoned">破棄</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                カテゴリ
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as Foreshadowing['category'] })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              関連キャラクター
            </label>
            <select
              multiple
              value={formData.relatedCharacterIds || []}
              onChange={(e) => setFormData({
                ...formData,
                relatedCharacterIds: Array.from(e.target.selectedOptions, option => option.value)
              })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              size={4}
            >
              {characters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name} ({char.role})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
              Ctrlキー（Windows）またはCmdキー（Mac）を押しながらクリックで複数選択
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              始まりの章（設置する章）
            </label>
            <select
              value={plantChapterId}
              onChange={(e) => setPlantChapterId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">未設定</option>
              {chapters.map((chapter, idx) => (
                <option key={chapter.id} value={chapter.id}>
                  第{idx + 1}章: {chapter.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
              この伏線を最初に設置する章を選択してください
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              回収予定の章
            </label>
            <select
              value={formData.plannedPayoffChapterId || ''}
              onChange={(e) => setFormData({ ...formData, plannedPayoffChapterId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">未定</option>
              {chapters.map((chapter, idx) => (
                <option key={chapter.id} value={chapter.id}>
                  第{idx + 1}章: {chapter.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              回収方法の計画
            </label>
            <textarea
              value={formData.plannedPayoffDescription || ''}
              onChange={(e) => setFormData({ ...formData, plannedPayoffDescription: e.target.value })}
              rows={2}
              placeholder="どのように回収する予定か..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              タグ
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="タグを入力してEnter"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                <Tag className="h-5 w-5" />
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 text-sm bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full font-['Noto_Sans_JP']"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-rose-500 hover:text-rose-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              メモ
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="作者メモ..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-['Noto_Sans_JP']"
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingForeshadowing(null);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              キャンセル
            </button>
            <button
              onClick={editingForeshadowing ? handleUpdateForeshadowing : handleAddForeshadowing}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-lg hover:from-rose-600 hover:to-pink-700 transition-colors"
            >
              <Save className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">{editingForeshadowing ? '更新' : '追加'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* 整合性チェック結果モーダル */}
      <Modal
        isOpen={showConsistencyModal}
        onClose={() => setShowConsistencyModal(false)}
        title={
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-blue-500" />
            <span className="font-['Noto_Sans_JP']">伏線整合性チェック結果</span>
          </div>
        }
        size="lg"
        className="z-[60]"
      >
        {consistencyResult && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* スコア表示 */}
            <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
              <div className={`text-5xl font-bold ${consistencyResult.overallScore >= 80 ? 'text-green-600' :
                  consistencyResult.overallScore >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                {consistencyResult.overallScore}
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">整合性スコア</p>
            </div>

            {/* サマリー */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                {consistencyResult.summary}
              </p>
            </div>

            {/* 良い点 */}
            {consistencyResult.strengths.length > 0 && (
              <div>
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>良い点</span>
                </h4>
                <ul className="space-y-1">
                  {consistencyResult.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] flex items-start space-x-2">
                      <span className="text-green-500">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 未解決の問題 */}
            {consistencyResult.unresolvedIssues.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>未解決の問題</span>
                </h4>
                <div className="space-y-2">
                  {consistencyResult.unresolvedIssues.map((issue, i) => (
                    <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                          {issue.foreshadowingTitle}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                            issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                          {issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">{issue.issue}</p>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 font-['Noto_Sans_JP']">
                        💡 {issue.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 矛盾 */}
            {consistencyResult.contradictions.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                  <X className="h-5 w-5" />
                  <span>矛盾点</span>
                </h4>
                <div className="space-y-2">
                  {consistencyResult.contradictions.map((c, i) => (
                    <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                        {c.items.join(' ↔ ')}
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">{c.description}</p>
                      <p className="text-sm text-red-500 dark:text-red-400 mt-1 font-['Noto_Sans_JP']">
                        💡 {c.resolution}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* バランスの問題 */}
            {consistencyResult.balanceIssues.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 font-['Noto_Sans_JP']">
                  バランスの問題
                </h4>
                <div className="space-y-2">
                  {consistencyResult.balanceIssues.map((b, i) => (
                    <div key={i} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">{b.issue}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-['Noto_Sans_JP']">
                        💡 {b.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 伏線強化提案モーダル */}
      <Modal
        isOpen={showEnhanceModal}
        onClose={() => {
          setShowEnhanceModal(false);
          setSelectedForEnhance(null);
          setEnhanceResult(null);
        }}
        title={
          <div className="flex items-center space-x-2">
            <Wand2 className="h-6 w-6 text-purple-500" />
            <span className="font-['Noto_Sans_JP']">伏線強化提案: {selectedForEnhance?.title}</span>
          </div>
        }
        size="lg"
        className="z-[60]"
      >
        {enhanceResult && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 強化された説明 */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                💎 強化された説明
              </h4>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                  {enhanceResult.enhancedDescription}
                </p>
              </div>
            </div>

            {/* 追加できる層 */}
            {enhanceResult.additionalLayers.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                  🎭 追加できる深み
                </h4>
                <div className="space-y-2">
                  {enhanceResult.additionalLayers.map((layer, i) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="font-medium text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">{layer.layer}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{layer.description}</p>
                      <p className="text-sm text-purple-600 dark:text-purple-400 mt-1 font-['Noto_Sans_JP']">
                        ✨ {layer.effect}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 接続機会 */}
            {enhanceResult.connectionOpportunities.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                  🔗 接続の機会
                </h4>
                <div className="space-y-2">
                  {enhanceResult.connectionOpportunities.map((conn, i) => (
                    <div key={i} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="font-medium text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">→ {conn.target}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300 font-['Noto_Sans_JP']">{conn.connection}</p>
                      <p className="text-sm text-blue-500 dark:text-blue-400 mt-1 font-['Noto_Sans_JP']">
                        💡 {conn.benefit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 強化方法 */}
            {enhanceResult.strengthenMethods.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                  ⬆️ 強化方法
                </h4>
                <div className="space-y-2">
                  {enhanceResult.strengthenMethods.map((method, i) => (
                    <div key={i} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">現在:</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{method.current}</span>
                      </div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">改善:</span>
                        <span className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">{method.improved}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        理由: {method.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 注意点 */}
            {enhanceResult.warnings.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 font-['Noto_Sans_JP']">
                  ⚠️ 注意点
                </h4>
                <ul className="space-y-1">
                  {enhanceResult.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 回収タイミング提案モーダル */}
      <Modal
        isOpen={showPayoffModal}
        onClose={() => {
          setShowPayoffModal(false);
          setSelectedForPayoff(null);
          setPayoffResult(null);
        }}
        title={
          <div className="flex items-center space-x-2">
            <Target className="h-6 w-6 text-green-500" />
            <span className="font-['Noto_Sans_JP']">回収タイミング提案: {selectedForPayoff?.title}</span>
          </div>
        }
        size="lg"
        className="z-[60]"
      >
        {payoffResult && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 推奨タイミング */}
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 font-['Noto_Sans_JP']">
                🎯 推奨回収タイミング
              </h4>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                {payoffResult.recommendedChapter}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
                {payoffResult.timing}
              </p>
            </div>

            {/* 回収方法 */}
            {payoffResult.payoffMethods.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                  📖 回収方法の提案
                </h4>
                <div className="space-y-3">
                  {payoffResult.payoffMethods.map((method, i) => (
                    <div key={i} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2">
                        {i + 1}. {method.method}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                        {method.description}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">
                        💥 インパクト: {method.impact}
                      </p>
                      {method.prerequisites.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">前提条件:</p>
                          <ul className="text-xs text-gray-500 dark:text-gray-400">
                            {method.prerequisites.map((p, j) => (
                              <li key={j} className="font-['Noto_Sans_JP']">• {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 回収前のヒント */}
            {payoffResult.hintsBeforePayoff.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                  💡 回収前に入れるべきヒント
                </h4>
                <div className="space-y-2">
                  {payoffResult.hintsBeforePayoff.map((hint, i) => (
                    <div key={i} className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <span className="font-medium text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                        {hint.chapter}:
                      </span>
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                        {hint.hint}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 避けるべきタイミング */}
            {payoffResult.avoidTiming.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2 font-['Noto_Sans_JP']">
                  ❌ 避けるべきタイミング
                </h4>
                <ul className="space-y-1">
                  {payoffResult.avoidTiming.map((avoid, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                      • {avoid}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 確認ダイアログ - 伏線削除 */}
      <ConfirmDialog
        isOpen={deletingForeshadowingId !== null}
        onClose={() => setDeletingForeshadowingId(null)}
        onConfirm={handleConfirmDeleteForeshadowing}
        title="この伏線を削除しますか？"
        message=""
        type="warning"
        confirmLabel="削除"
      />

      {/* 確認ダイアログ - ポイント削除 */}
      <ConfirmDialog
        isOpen={deletingPointInfo !== null}
        onClose={() => setDeletingPointInfo(null)}
        onConfirm={handleConfirmDeletePoint}
        title="このポイントを削除しますか？"
        message=""
        type="warning"
        confirmLabel="削除"
      />
    </>
  );
};

