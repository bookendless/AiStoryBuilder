import React, { useState, useEffect, useCallback, useRef } from 'react';
import { List, Plus, Sparkles, Edit3, Trash2, ChevronUp, ChevronDown, Check, X, FileText, Copy, Download, Search, ChevronRight, BookOpen, History, RotateCcw, GripVertical } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';

// ProjectContextの型を使用するため、ローカルのChapterインターフェースは削除

interface StructureProgress {
  introduction: boolean;
  development: boolean;
  climax: boolean;
  conclusion: boolean;
}

interface AILogEntry {
  id: string;
  timestamp: Date;
  type: 'basic' | 'structure';
  prompt: string;
  response: string;
  error?: string;
  parsedChapters?: Array<{id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[]}>;
}

interface ChapterHistory {
  id: string;
  chapterId: string;
  timestamp: Date;
  data: {
    title: string;
    summary: string;
    characters: string[];
    setting: string;
    mood: string;
    keyEvents: string[];
  };
}

export const ChapterStep: React.FC = () => {
  const { currentProject, updateProject, deleteChapter } = useProject();
  const { settings, isConfigured } = useAI();
  const { showSuccess } = useToast();
  
  // 状態管理
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    characters: [] as string[],
    setting: '',
    mood: '',
    keyEvents: [] as string[],
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    summary: '',
    characters: [] as string[],
    setting: '',
    mood: '',
    keyEvents: [] as string[],
  });
  const [structureProgress, setStructureProgress] = useState<StructureProgress>({
    introduction: false,
    development: false,
    climax: false,
    conclusion: false,
  });
  
  // 折りたたみ機能の状態管理
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  
  // 検索機能の状態管理
  const [searchQuery, setSearchQuery] = useState('');
  
  // ジャンプ機能用のref
  const chapterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // 履歴管理の状態
  const [chapterHistories, setChapterHistories] = useState<{ [chapterId: string]: ChapterHistory[] }>({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // 右サイドバーセクションの管理
  type SidebarSectionId = 'tableOfContents' | 'aiAssistant' | 'structureProgress';
  
  // セクションの並び順（デフォルト）
  const defaultSectionOrder: SidebarSectionId[] = ['tableOfContents', 'aiAssistant', 'structureProgress'];
  
  // localStorageから並び順を読み込む
  const loadSectionOrder = (): SidebarSectionId[] => {
    try {
      const saved = localStorage.getItem('chapterStep_sidebar_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        // すべてのセクションが含まれているか確認
        if (Array.isArray(parsed) && parsed.length === defaultSectionOrder.length) {
          const allSections = new Set(parsed);
          const defaultSections = new Set(defaultSectionOrder);
          if (allSections.size === defaultSections.size && [...allSections].every(s => defaultSections.has(s))) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('Failed to load sidebar order:', e);
    }
    return defaultSectionOrder;
  };

  // セクションの並び順の状態
  const [sectionOrder, setSectionOrder] = useState<SidebarSectionId[]>(loadSectionOrder());
  
  // セクションの展開状態（localStorageから読み込む）
  const loadExpandedSections = (): Set<SidebarSectionId> => {
    try {
      const saved = localStorage.getItem('chapterStep_sidebar_expanded');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed.filter(id => defaultSectionOrder.includes(id as SidebarSectionId)));
        }
      }
    } catch (e) {
      console.error('Failed to load expanded sections:', e);
    }
    // デフォルトではすべて展開
    return new Set(defaultSectionOrder);
  };

  const [expandedSections, setExpandedSections] = useState<Set<SidebarSectionId>>(loadExpandedSections());

  // セクションの展開状態を保存
  const saveExpandedSections = (expanded: Set<SidebarSectionId>) => {
    try {
      localStorage.setItem('chapterStep_sidebar_expanded', JSON.stringify([...expanded]));
    } catch (e) {
      console.error('Failed to save expanded sections:', e);
    }
  };

  // セクションの並び順を保存
  const saveSectionOrder = (order: SidebarSectionId[]) => {
    try {
      localStorage.setItem('chapterStep_sidebar_order', JSON.stringify(order));
    } catch (e) {
      console.error('Failed to save section order:', e);
    }
  };

  // セクションの展開/折りたたみを切り替え
  const toggleSection = (sectionId: SidebarSectionId) => {
    setExpandedSections(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      saveExpandedSections(newExpanded);
      return newExpanded;
    });
  };

  // ドラッグ中のセクションインデックス
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);

  // セクションのドラッグ開始
  const handleSectionDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  // セクションのドラッグオーバー
  const handleSectionDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSectionIndex !== null && draggedSectionIndex !== index) {
      setDragOverSectionIndex(index);
    }
  };

  // セクションのドラッグ離脱
  const handleSectionDragLeave = () => {
    setDragOverSectionIndex(null);
  };

  // セクションのドロップ
  const handleSectionDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedSectionIndex === null || draggedSectionIndex === dropIndex) {
      setDraggedSectionIndex(null);
      setDragOverSectionIndex(null);
      return;
    }

    const newOrder = [...sectionOrder];
    const [removed] = newOrder.splice(draggedSectionIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    
    setSectionOrder(newOrder);
    saveSectionOrder(newOrder);
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
    showSuccess('サイドバー項目の並び順を変更しました');
  };

  // セクションのドラッグ終了
  const handleSectionDragEnd = () => {
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
  };

  // プロジェクトが変更されたときに構成バランスの状態を初期化
  useEffect(() => {
    if (currentProject) {
      setStructureProgress({
        introduction: currentProject.structureProgress?.introduction || false,
        development: currentProject.structureProgress?.development || false,
        climax: currentProject.structureProgress?.climax || false,
        conclusion: currentProject.structureProgress?.conclusion || false,
      });
    }
  }, [currentProject]);

  // ユーティリティ関数
  const handleCharacterToggle = (characterId: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        characters: prev.characters.includes(characterId)
          ? prev.characters.filter(id => id !== characterId)
          : [...prev.characters, characterId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        characters: prev.characters.includes(characterId)
          ? prev.characters.filter(id => id !== characterId)
          : [...prev.characters, characterId]
      }));
    }
  };

  const handleKeyEventChange = (index: number, value: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.map((event, i) => i === index ? value : event)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.map((event, i) => i === index ? value : event)
      }));
    }
  };

  const handleAddKeyEvent = (isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        keyEvents: [...prev.keyEvents, '']
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        keyEvents: [...prev.keyEvents, '']
      }));
    }
  };

  const handleRemoveKeyEvent = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        keyEvents: prev.keyEvents.filter((_, i) => i !== index)
      }));
    }
  };

  const getProjectContext = () => {
    if (!currentProject) {
      return {
        title: '無題',
        description: '一般小説',
        plot: {
          theme: '',
          setting: '',
          structure: '',
          hook: '',
          structureDetails: '',
        },
        characters: [],
        existingChapters: [],
      };
    }

    // プロット構成の詳細情報を構築（章づくりを意識した形式）
    const buildStructureDetails = () => {
      if (!currentProject.plot) return '';
      
      const { structure, ki, sho, ten, ketsu, act1, act2, act3, fourAct1, fourAct2, fourAct3, fourAct4 } = currentProject.plot;
      
      if (structure === 'kishotenketsu') {
        const parts = [];
        if (ki) parts.push(`【起】導入部（1-2章程度）: ${ki}`);
        if (sho) parts.push(`【承】展開部（3-6章程度）: ${sho}`);
        if (ten) parts.push(`【転】転換部（7-8章程度）: ${ten}`);
        if (ketsu) parts.push(`【結】結末部（9-10章程度）: ${ketsu}`);
        return parts.join('\n');
      } else if (structure === 'three-act') {
        const parts = [];
        if (act1) parts.push(`【第1幕】導入部（1-3章程度）: ${act1}`);
        if (act2) parts.push(`【第2幕】展開部（4-8章程度）: ${act2}`);
        if (act3) parts.push(`【第3幕】結末部（9-10章程度）: ${act3}`);
        return parts.join('\n');
      } else if (structure === 'four-act') {
        const parts = [];
        if (fourAct1) parts.push(`【第1幕】秩序（1-2章程度）: ${fourAct1}`);
        if (fourAct2) parts.push(`【第2幕】混沌（3-5章程度）: ${fourAct2}`);
        if (fourAct3) parts.push(`【第3幕】秩序（6-8章程度）: ${fourAct3}`);
        if (fourAct4) parts.push(`【第4幕】混沌（9-10章程度）: ${fourAct4}`);
        return parts.join('\n');
      }
      
      return '';
    };

    return {
      // 基本情報
      title: currentProject.title || '無題',
      description: currentProject.description || '一般小説',
      
      // プロット情報
      plot: {
        theme: currentProject.plot?.theme || '',
        setting: currentProject.plot?.setting || '',
        structure: currentProject.plot?.structure || '',
        hook: currentProject.plot?.hook || '',
        structureDetails: buildStructureDetails(),
      },
      
      // キャラクター情報（正確なプロパティ参照）
      characters: currentProject.characters.map(c => ({
        name: c.name,
        role: c.role,
        appearance: c.appearance,
        personality: c.personality,
        background: c.background,
        image: c.image ? '画像あり' : '画像なし'
      })),
      
      // 既存の章情報
      existingChapters: currentProject.chapters.map(c => ({
        title: c.title,
        summary: c.summary,
        setting: c.setting || '',
        mood: c.mood || '',
        keyEvents: c.keyEvents || []
      }))
    };
  };

  // AIログ関連のユーティリティ関数
  const addAILog = (logEntry: Omit<AILogEntry, 'id' | 'timestamp'>) => {
    const newLog: AILogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      ...logEntry
    };
    setAiLogs(prev => [newLog, ...prev].slice(0, 10)); // 最新10件まで保持
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('クリップボードにコピーしました');
    } catch (err) {
      console.error('コピーに失敗しました:', err);
      alert('コピーに失敗しました');
    }
  };

  const downloadLog = (log: AILogEntry) => {
    const content = `AI生成ログ - ${log.timestamp.toLocaleString()}
タイプ: ${log.type === 'basic' ? '基本AI章立て提案' : '構成バランスAI提案'}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】\n${log.error}` : ''}

${log.parsedChapters && log.parsedChapters.length > 0 ? `【解析された章数】\n${log.parsedChapters.length}章\n\n【解析された章の詳細】\n${log.parsedChapters.map((ch, i) => `${i + 1}. ${ch.title}: ${ch.summary}`).join('\n')}` : ''}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-log-${log.timestamp.toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseAIResponse = (content: string) => {
    // フォールバック: 基本的な解析処理（強化版）
    const newChapters: Array<{id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[]}> = [];
    const lines = content.split('\n').filter(line => line.trim());
    let currentChapter: {
      id: string;
      title: string;
      summary: string;
      setting: string;
      mood: string;
      keyEvents: string[];
      characters: string[];
    } | null = null;

    // 拡張された章検出パターン
    const chapterPatterns = [
      /第(\d+)章[：:]\s*(.+)/,           // 標準形式: 第1章: タイトル
      /(\d+)\.\s*(.+)/,                  // 番号付き形式: 1. タイトル
      /【第(\d+)章】\s*(.+)/,            // 括弧形式: 【第1章】 タイトル
      /Chapter\s*(\d+)[：:]\s*(.+)/i,    // 英語形式: Chapter 1: タイトル
      /章(\d+)[：:]\s*(.+)/,             // 簡略形式: 章1: タイトル
      /^(\d+)\s*[．.]\s*(.+)/,           // 数字+句点形式: 1．タイトル
      /^(\d+)\s*[-－]\s*(.+)/,           // 数字+ハイフン形式: 1-タイトル
    ];

    // 詳細情報検出パターン（より柔軟）
    const detailPatterns = {
      summary: [/概要[：:]\s*(.+)/, /あらすじ[：:]\s*(.+)/, /内容[：:]\s*(.+)/, /要約[：:]\s*(.+)/],
      setting: [/設定[・・]場所[：:]\s*(.+)/, /舞台[：:]\s*(.+)/, /場所[：:]\s*(.+)/, /設定[：:]\s*(.+)/],
      mood: [/雰囲気[・・]ムード[：:]\s*(.+)/, /ムード[：:]\s*(.+)/, /雰囲気[：:]\s*(.+)/, /トーン[：:]\s*(.+)/],
      keyEvents: [/重要な出来事[：:]\s*(.+)/, /キーイベント[：:]\s*(.+)/, /出来事[：:]\s*(.+)/, /イベント[：:]\s*(.+)/],
      characters: [/登場キャラクター[：:]\s*(.+)/, /登場人物[：:]\s*(.+)/, /キャラクター[：:]\s*(.+)/, /人物[：:]\s*(.+)/]
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 章の開始を検出（複数パターンを試行）
      let chapterMatch: RegExpMatchArray | null = null;
      let chapterTitle = '';

      for (const pattern of chapterPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          chapterMatch = match;
          chapterTitle = match[2].trim();
          break;
        }
      }
      
      if (chapterMatch) {
        if (currentChapter) {
          newChapters.push(currentChapter);
        }
        currentChapter = {
          id: Date.now().toString() + Math.random(),
          title: chapterTitle,
          summary: '',
          setting: '',
          mood: '',
          keyEvents: [] as string[],
          characters: [] as string[],
        };
      } else if (currentChapter) {
        // 章の詳細情報を解析（複数パターンを試行）
        let detailFound = false;

        // 概要の検出
        for (const pattern of detailPatterns.summary) {
          const match = trimmedLine.match(pattern);
          if (match) {
            currentChapter.summary = match[1].trim();
            detailFound = true;
            break;
          }
        }

        // 設定・場所の検出
        if (!detailFound) {
          for (const pattern of detailPatterns.setting) {
            const match = trimmedLine.match(pattern);
            if (match) {
              currentChapter.setting = match[1].trim();
              detailFound = true;
              break;
            }
          }
        }

        // 雰囲気・ムードの検出
        if (!detailFound) {
          for (const pattern of detailPatterns.mood) {
            const match = trimmedLine.match(pattern);
            if (match) {
              currentChapter.mood = match[1].trim();
              detailFound = true;
              break;
            }
          }
        }

        // 重要な出来事の検出
        if (!detailFound) {
          for (const pattern of detailPatterns.keyEvents) {
            const match = trimmedLine.match(pattern);
            if (match) {
              const eventsText = match[1].trim();
              currentChapter.keyEvents = eventsText.split(/[,、;；]/).map(event => event.trim()).filter(event => event) as string[];
              detailFound = true;
              break;
            }
          }
        }

        // 登場キャラクターの検出
        if (!detailFound) {
          for (const pattern of detailPatterns.characters) {
            const match = trimmedLine.match(pattern);
            if (match) {
              const charactersText = match[1].trim();
              currentChapter.characters = charactersText.split(/[,、;；]/).map(char => char.trim()).filter(char => char) as string[];
              detailFound = true;
              break;
            }
          }
        }

        // 詳細情報が見つからず、概要も空の場合は最初の説明文を概要として使用
        if (!detailFound && !currentChapter.summary && 
            !trimmedLine.startsWith('役割:') && 
            !trimmedLine.startsWith('ペース:') &&
            !trimmedLine.includes('【') &&
            !trimmedLine.includes('】') &&
            trimmedLine.length > 10) {
          currentChapter.summary = trimmedLine;
        }
      }
    }

    if (currentChapter) {
      newChapters.push(currentChapter);
    }

    return newChapters;
  };

  // イベントハンドラー
  const handleStructureProgressChange = (section: keyof StructureProgress) => {
    const newProgress = {
      ...structureProgress,
      [section]: !structureProgress[section],
    };
    setStructureProgress(newProgress);
    
    // プロジェクトに保存
    if (currentProject) {
      updateProject({
        structureProgress: newProgress,
      });
    }
  };

  const handleAddChapter = () => {
    if (!currentProject || !formData.title.trim()) return;

    const newChapter = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      summary: formData.summary.trim(),
      characters: formData.characters,
      setting: formData.setting.trim(),
      mood: formData.mood.trim(),
      keyEvents: formData.keyEvents,
    };

    updateProject({
      chapters: [...currentProject.chapters, newChapter],
    });

    // 新規作成時も履歴を保存
    saveChapterHistory(newChapter);

    setFormData({ title: '', summary: '', characters: [], setting: '', mood: '', keyEvents: [] });
    setShowAddForm(false);
  };

  const handleCloseModal = useCallback(() => {
    setFormData({ title: '', summary: '', characters: [], setting: '', mood: '', keyEvents: [] });
    setShowAddForm(false);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditFormData({ title: '', summary: '', characters: [], setting: '', mood: '', keyEvents: [] });
    setShowEditForm(false);
    setEditingId(null);
  }, []);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddForm) {
          handleCloseModal();
        } else if (showEditForm) {
          handleCloseEditModal();
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
        }
      }
    };

    if (showAddForm || showEditForm || showHistoryModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showAddForm, showEditForm, showHistoryModal, handleCloseModal, handleCloseEditModal]);

  const handleDeleteChapter = (id: string) => {
    if (!currentProject) return;
    deleteChapter(id);
  };

  const handleEditChapter = (chapter: {id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[]}) => {
    setEditingId(chapter.id);
    setEditFormData({
      title: chapter.title,
      summary: chapter.summary,
      characters: chapter.characters || [],
      setting: chapter.setting || '',
      mood: chapter.mood || '',
      keyEvents: chapter.keyEvents || [],
    });
    setShowEditForm(true);
  };

  const handleDoubleClickChapter = (chapter: {id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[]}) => {
    handleEditChapter(chapter);
  };

  const handleUpdateChapter = () => {
    if (!currentProject || !editingId || !editFormData.title.trim()) return;

    // 更新前の状態を履歴に保存
    const oldChapter = currentProject.chapters.find(c => c.id === editingId);
    if (oldChapter) {
      saveChapterHistory(oldChapter);
    }

    const updatedChapter = {
      id: editingId,
      title: editFormData.title.trim(),
      summary: editFormData.summary.trim(),
      characters: editFormData.characters,
      setting: editFormData.setting.trim(),
      mood: editFormData.mood.trim(),
      keyEvents: editFormData.keyEvents,
    };

    updateProject({
      chapters: currentProject.chapters.map(c => 
        c.id === editingId 
          ? { 
              ...c, 
              ...updatedChapter
            }
          : c
      ),
    });

    handleCloseEditModal();
  };


  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!currentProject || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newChapters = [...currentProject.chapters];
    const draggedChapter = newChapters[draggedIndex];
    
    // ドラッグされた章を削除
    newChapters.splice(draggedIndex, 1);
    
    // 新しい位置に挿入
    newChapters.splice(dropIndex, 0, draggedChapter);
    
    updateProject({
      chapters: newChapters,
    });
    
    setDraggedIndex(null);
  };

  const moveChapter = (fromIndex: number, toIndex: number) => {
    if (!currentProject || fromIndex === toIndex) return;

    const newChapters = [...currentProject.chapters];
    const [movedChapter] = newChapters.splice(fromIndex, 1);
    newChapters.splice(toIndex, 0, movedChapter);
    
    updateProject({
      chapters: newChapters,
    });
  };

  // 折りたたみ機能のハンドラー
  const toggleChapterExpansion = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  // すべての章を展開/折りたたみ
  const toggleAllChapters = () => {
    if (!currentProject) return;
    if (expandedChapters.size === currentProject.chapters.length) {
      setExpandedChapters(new Set());
    } else {
      setExpandedChapters(new Set(currentProject.chapters.map(ch => ch.id)));
    }
  };

  // 検索フィルタリング関数
  const filterChapters = (chapters: NonNullable<typeof currentProject>['chapters']) => {
    if (!searchQuery.trim() || !currentProject) return chapters;
    
    const query = searchQuery.toLowerCase();
    return chapters.filter(chapter => {
      // タイトルで検索
      if (chapter.title.toLowerCase().includes(query)) return true;
      
      // 概要で検索
      if (chapter.summary.toLowerCase().includes(query)) return true;
      
      // 設定・場所で検索
      if (chapter.setting?.toLowerCase().includes(query)) return true;
      
      // 雰囲気・ムードで検索
      if (chapter.mood?.toLowerCase().includes(query)) return true;
      
      // 重要な出来事で検索
      if (chapter.keyEvents?.some(event => event.toLowerCase().includes(query))) return true;
      
      // キャラクター名で検索
      if (chapter.characters?.some(characterId => {
        const character = currentProject.characters.find(c => c.id === characterId);
        const characterName = character ? character.name : characterId;
        return characterName.toLowerCase().includes(query);
      })) return true;
      
      return false;
    });
  };

  // ジャンプ機能
  const scrollToChapter = (chapterId: string) => {
    const element = chapterRefs.current[chapterId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // ハイライト効果
      element.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500');
      }, 2000);
    }
  };

  // 章の履歴を保存する関数
  const saveChapterHistory = useCallback((chapter: {id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[]}) => {
    const history: ChapterHistory = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      chapterId: chapter.id,
      timestamp: new Date(),
      data: {
        title: chapter.title,
        summary: chapter.summary,
        characters: chapter.characters || [],
        setting: chapter.setting || '',
        mood: chapter.mood || '',
        keyEvents: chapter.keyEvents || [],
      },
    };

    setChapterHistories(prev => {
      const chapterHistory = prev[chapter.id] || [];
      // 最新50件まで保持
      const newHistory = [history, ...chapterHistory].slice(0, 50);
      return {
        ...prev,
        [chapter.id]: newHistory,
      };
    });
  }, []);

  // 履歴から章を復元する関数
  const restoreChapterFromHistory = (history: ChapterHistory) => {
    if (!currentProject) return;

    updateProject({
      chapters: currentProject.chapters.map(c =>
        c.id === history.chapterId
          ? {
              ...c,
              title: history.data.title,
              summary: history.data.summary,
              characters: history.data.characters,
              setting: history.data.setting,
              mood: history.data.mood,
              keyEvents: history.data.keyEvents,
            }
          : c
      ),
    });

    // 復元後、新しい履歴として保存（現在の状態を履歴に追加）
    const currentChapter = currentProject.chapters.find(c => c.id === history.chapterId);
    if (currentChapter) {
      saveChapterHistory(currentChapter);
    }

    setShowHistoryModal(false);
    alert('章を履歴から復元しました');
  };

  // 履歴モーダルを開く
  const openHistoryModal = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setShowHistoryModal(true);
  };




  // AI生成関数
  const buildAIPrompt = (type: 'basic' | 'structure') => {
    const context = getProjectContext();
    
    if (type === 'structure') {
      const incompleteStructures = [];
      if (!structureProgress.introduction) incompleteStructures.push('導入部');
      if (!structureProgress.development) incompleteStructures.push('展開部');
      if (!structureProgress.climax) incompleteStructures.push('クライマックス');
      if (!structureProgress.conclusion) incompleteStructures.push('結末部');

      if (settings.provider === 'local') {
        return `以下のプロジェクト情報に基づいて、未完了の構成要素「${incompleteStructures.join('、')}」に対応する章立てを提案してください。

【プロジェクト基本情報】
作品タイトル: ${context.title}
メインジャンル: ${currentProject?.mainGenre || '未設定'}

【最重要】構成詳細
${context.plot?.structureDetails || '構成詳細が設定されていません'}

【キャラクター】
${context.characters.slice(0, 3).map((c: { name: string; role: string }) => `${c.name}(${c.role})`).join(', ')}

【既存章構成】
${context.existingChapters.map((ch: { title: string; summary: string; setting?: string; mood?: string; keyEvents?: string[] }, index: number) => {
  let chapterInfo = `${index + 1}. ${ch.title}: ${ch.summary}`;
  if (ch.setting) chapterInfo += `\n   設定・場所: ${ch.setting}`;
  if (ch.mood) chapterInfo += `\n   雰囲気・ムード: ${ch.mood}`;
  if (ch.keyEvents && ch.keyEvents.length > 0) {
    chapterInfo += `\n   重要な出来事: ${ch.keyEvents.join(', ')}`;
  }
  return chapterInfo;
}).join('\n')}

【未完了構成要素】
${incompleteStructures.join('、')}

【必須出力形式】（この形式を厳密に守ってください）
第1章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

第2章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章は必ず上記の6項目（章タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクター）を含むこと
- 項目名は「概要:」「設定・場所:」等の形式を厳密に守ること
- 章番号は「第X章:」の形式を使用すること
- 各章の概要は200文字以内に収めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 重要な出来事は3つ以上、登場キャラクターは2つ以上含めること

【最重要指示】
1. 構成詳細の情報を最優先で従い、逸脱しない
2. 未完了の構成要素に焦点を当てた章立てを作成
3. メインジャンルに適した章構成
4. 既存の章との整合性を保つ
5. 登場キャラクターの提案：
   - 主要キャラクターを尊重し、各章に適切に配置
   - 章の内容に必要であれば、新しいキャラクターを追加提案
   - キャラクターの関係性や役割を考慮した登場タイミング`;
      } else {
        return `以下のプロジェクト情報に基づいて、未完了の構成要素「${incompleteStructures.join('、')}」に対応する章立てを提案してください。

【プロジェクト基本情報】
作品タイトル: ${context.title}
メインジャンル: ${currentProject?.mainGenre || '未設定'}

【最重要】構成詳細
${context.plot?.structureDetails || '構成詳細が設定されていません'}

【キャラクター情報】
${context.characters.map((c: { name: string; role: string; appearance: string; personality: string; background: string }) => 
  `・${c.name} (${c.role})
  外見: ${c.appearance}
  性格: ${c.personality}
  背景: ${c.background}`
).join('\n')}

【既存章構成】
${context.existingChapters.map((ch: { title: string; summary: string; setting?: string; mood?: string; keyEvents?: string[] }, index: number) => {
  let chapterInfo = `${index + 1}. ${ch.title}: ${ch.summary}`;
  if (ch.setting) chapterInfo += `\n   設定・場所: ${ch.setting}`;
  if (ch.mood) chapterInfo += `\n   雰囲気・ムード: ${ch.mood}`;
  if (ch.keyEvents && ch.keyEvents.length > 0) {
    chapterInfo += `\n   重要な出来事: ${ch.keyEvents.join(', ')}`;
  }
  return chapterInfo;
}).join('\n')}

【未完了構成要素】
${incompleteStructures.join('、')}

【必須出力形式】（この形式を厳密に守ってください）
第1章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

第2章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章は必ず上記の6項目（章タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクター）を含むこと
- 項目名は「概要:」「設定・場所:」等の形式を厳密に守ること
- 章番号は「第X章:」の形式を使用すること
- 各章の概要は200文字以内に収めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 重要な出来事は3つ以上、登場キャラクターは2つ以上含めること

【最重要指示】
1. **構成詳細の情報を最優先で従い、逸脱しない**
   - 起承転結、三幕構成、四幕構成の詳細に厳密に従う
   - 各段階の役割と配置を正確に反映

2. **未完了の構成要素に焦点を当てた章立て**
   - 「${incompleteStructures.join('、')}」の要素を重点的に補完
   - 構成詳細に基づいた適切な配置

3. **メインジャンルに適した章構成**
   - メインジャンルの特徴を活かした章の配置とペース
   - ジャンル特有の構成パターンを考慮

4. **キャラクターの役割と性格を考慮**
   - 各キャラクターの個性を活かした章の内容
   - キャラクター関係性の発展を考慮
   - 役割に応じた登場タイミング

5. **既存の章との整合性**
   - 既存の章構成との整合性を保つ
   - 物語の流れを自然に構成
   - 一貫性のある展開

6. **登場キャラクターの提案**
   - 主要キャラクターを尊重し、各章に適切に配置
   - 章の内容に必要であれば、新しいキャラクターを追加提案
   - キャラクターの関係性や役割を考慮した登場タイミング
   - 既存キャラクターの性格・背景を活かした章の内容
   - 物語の展開に必要なサブキャラクターの適切な配置`;
      }
    } else {
      // 基本AI生成用のプロンプト
      if (settings.provider === 'local') {
        return `作品: ${context.title}
メインジャンル: ${currentProject?.mainGenre || '未設定'}

【最重要】構成詳細（必ず従う）:
${context.plot.structureDetails || '構成詳細が設定されていません'}

主要キャラクター: ${context.characters.length > 0 ? context.characters.slice(0, 3).map((c: { name: string; role: string }) => `${c.name}(${c.role})`).join(', ') : 'キャラクターが設定されていません'}

【既存章構成】
${context.existingChapters.map((ch: { title: string; summary: string; setting?: string; mood?: string; keyEvents?: string[] }, index: number) => {
  let chapterInfo = `${index + 1}. ${ch.title}: ${ch.summary}`;
  if (ch.setting) chapterInfo += `\n   設定・場所: ${ch.setting}`;
  if (ch.mood) chapterInfo += `\n   雰囲気・ムード: ${ch.mood}`;
  if (ch.keyEvents && ch.keyEvents.length > 0) {
    chapterInfo += `\n   重要な出来事: ${ch.keyEvents.join(', ')}`;
  }
  return chapterInfo;
}).join('\n') || '既存の章はありません'}

【必須出力形式】（この形式を厳密に守ってください）
第1章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

第2章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章は必ず上記の6項目（章タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクター）を含むこと
- 項目名は「概要:」「設定・場所:」等の形式を厳密に守ること
- 章番号は「第X章:」の形式を使用すること
- 各章の概要は200文字以内に収めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 重要な出来事は3つ以上、登場キャラクターは2つ以上含めること

【最重要指示】
1. 構成詳細の情報を最優先で従い、逸脱しない
2. メインジャンルに適した章構成
3. キャラクターの役割と性格を考慮
4. 既存の章との整合性を保つ
5. 登場キャラクターの提案：
   - 主要キャラクターを尊重し、各章に適切に配置
   - 章の内容に必要であれば、新しいキャラクターを追加提案
   - キャラクターの関係性や役割を考慮した登場タイミング
   - 既存キャラクターの性格・背景を活かした章の内容`;
      } else {
        return `以下のプロジェクト情報に基づいて、物語の章立てを提案してください。

【プロジェクト基本情報】
作品タイトル: ${context.title}
メインジャンル: ${currentProject?.mainGenre || '未設定'}

【最重要】構成詳細
${context.plot.structureDetails || '構成詳細が設定されていません'}

【主要キャラクター】
${context.characters.map(c => `・${c.name} (${c.role})
  外見: ${c.appearance}
  性格: ${c.personality}
  背景: ${c.background}`).join('\n') || 'キャラクターが設定されていません'}

【既存の章】
${context.existingChapters.map((c: { title: string; summary: string; setting?: string; mood?: string; keyEvents?: string[] }) => {
  let chapterInfo = `・${c.title}: ${c.summary}`;
  if (c.setting) chapterInfo += `\n  設定・場所: ${c.setting}`;
  if (c.mood) chapterInfo += `\n  雰囲気・ムード: ${c.mood}`;
  if (c.keyEvents && c.keyEvents.length > 0) {
    chapterInfo += `\n  重要な出来事: ${c.keyEvents.join(', ')}`;
  }
  return chapterInfo;
}).join('\n\n') || '既存の章はありません'}

【必須出力形式】（この形式を厳密に守ってください）
第1章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

第2章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章は必ず上記の6項目（章タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクター）を含むこと
- 項目名は「概要:」「設定・場所:」等の形式を厳密に守ること
- 章番号は「第X章:」の形式を使用すること
- 各章の概要は200文字以内に収めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 重要な出来事は3つ以上、登場キャラクターは2つ以上含めること

【最重要指示】
1. **構成詳細の情報を最優先で従い、逸脱しない**
   - 起承転結、三幕構成、四幕構成の詳細に厳密に従う
   - 各段階の役割と配置を正確に反映

2. **メインジャンルに適した章構成**
   - メインジャンルの特徴を活かした章の配置とペース
   - ジャンル特有の構成パターンを考慮

3. **キャラクターの役割と性格を考慮**
   - 各キャラクターの個性を活かした章の内容
   - キャラクター関係性の発展を考慮
   - 役割に応じた登場タイミング

4. **既存の章との整合性**
   - 既存の章がある場合は、それらとの流れを保つ
   - 物語の一貫性を維持

5. **章数と配置の最適化**
   - 構成詳細に基づいた適切な章数
   - 各段階の比重に応じた章の長さ配分
   - クライマックスの適切な配置

6. **登場キャラクターの提案**
   - 主要キャラクターを尊重し、各章に適切に配置
   - 章の内容に必要であれば、新しいキャラクターを追加提案
   - キャラクターの関係性や役割を考慮した登場タイミング
   - 既存キャラクターの性格・背景を活かした章の内容
   - 物語の展開に必要なサブキャラクターの適切な配置`;
      }
    }
  };

  const handleAIGenerate = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setIsGenerating(true);
    
    try {
      const prompt = buildAIPrompt('basic');
      const response = await aiService.generateContent({
        prompt,
        type: 'chapter',
        settings,
      });

      // ログを保存
      addAILog({
        type: 'basic',
        prompt,
        response: response.content || '',
        error: response.error,
        parsedChapters: []
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}\n\nログを確認するには「AIログ」ボタンをクリックしてください。`);
        setShowLogs(true);
        return;
      }

      const newChapters = parseAIResponse(response.content);
      
      // 解析結果をログに追加
      if (aiLogs.length > 0) {
        const latestLog = aiLogs[0];
        setAiLogs(prev => prev.map(log => 
          log.id === latestLog.id 
            ? { ...log, parsedChapters: newChapters }
            : log
        ));
      }
      
      if (newChapters.length > 0) {
        updateProject({
          chapters: [...currentProject!.chapters, ...newChapters],
        });
        
        // AI生成で追加された章の履歴を保存
        newChapters.forEach(chapter => {
          saveChapterHistory(chapter);
        });
        
        // 不完全な章があるかチェック
        const incompleteChapters = newChapters.filter((ch: {
          id: string;
          title: string;
          summary: string;
          characters?: string[];
          setting?: string;
          mood?: string;
          keyEvents?: string[];
        }) => 
          !ch.summary || !ch.setting || !ch.mood || !ch.keyEvents?.length || !ch.characters?.length
        );
        
        if (incompleteChapters.length > 0) {
          alert(`AI構成提案で${newChapters.length}章を追加しました。\n\n注意: ${incompleteChapters.length}章で情報が不完全です。必要に応じて手動で編集してください。`);
        } else {
          alert(`AI構成提案で${newChapters.length}章を追加しました。`);
        }
      } else {
        alert('章立ての解析に失敗しました。\n\n考えられる原因:\n1. AI出力の形式が期待と異なる\n2. 章の開始パターンが見つからない\n3. 必要な情報が不足している\n\nAIの応答内容を確認するには「AIログ」ボタンをクリックしてください。');
        setShowLogs(true);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      addAILog({
        type: 'basic',
        prompt: buildAIPrompt('basic'),
        response: '',
        error: errorMessage
      });
      alert(`AI生成中にエラーが発生しました: ${errorMessage}\n\nログを確認するには「AIログ」ボタンをクリックしてください。`);
      setShowLogs(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStructureBasedAIGenerate = async () => {
    if (!isConfigured || !currentProject) {
      alert('AI設定が完了していません。設定画面でAPIキーを入力してください。');
      return;
    }

    // 完了していない構成要素を特定
    const incompleteStructures = [];
    if (!structureProgress.introduction) incompleteStructures.push('導入部');
    if (!structureProgress.development) incompleteStructures.push('展開部');
    if (!structureProgress.climax) incompleteStructures.push('クライマックス');
    if (!structureProgress.conclusion) incompleteStructures.push('結末部');

    if (incompleteStructures.length === 0) {
      alert('すべての構成要素が完了しています。新しい章を追加する場合は「AI構成提案」をご利用ください。');
      return;
    }

    setIsGeneratingStructure(true);

    try {
      const prompt = buildAIPrompt('structure');
      const response = await aiService.generateContent({
        prompt: prompt,
        type: 'chapter',
        settings: settings,
      });

      // ログを保存
      addAILog({
        type: 'structure',
        prompt,
        response: response.content || '',
        error: response.error,
        parsedChapters: []
      });

      if (response.content && !response.error) {
        const newChapters = parseAIResponse(response.content);

        // 解析結果をログに追加
        if (aiLogs.length > 0) {
          const latestLog = aiLogs[0];
          setAiLogs(prev => prev.map(log => 
            log.id === latestLog.id 
              ? { ...log, parsedChapters: newChapters }
              : log
          ));
        }

        if (newChapters.length > 0) {
          updateProject({
            chapters: [...currentProject.chapters, ...newChapters],
          });
          
          // AI生成で追加された章の履歴を保存
          newChapters.forEach(chapter => {
            saveChapterHistory(chapter);
          });
          
          // 不完全な章があるかチェック
          const incompleteChapters = newChapters.filter((ch: {
            id: string;
            title: string;
            summary: string;
            characters?: string[];
            setting?: string;
            mood?: string;
            keyEvents?: string[];
          }) => 
            !ch.summary || !ch.setting || !ch.mood || !ch.keyEvents?.length || !ch.characters?.length
          );
          
          if (incompleteChapters.length > 0) {
            alert(`構成バランスAI提案で${newChapters.length}章を追加しました。\n対象: ${incompleteStructures.join('、')}\n\n注意: ${incompleteChapters.length}章で情報が不完全です。必要に応じて手動で編集してください。`);
          } else {
            alert(`構成バランスAI提案で${newChapters.length}章を追加しました。\n対象: ${incompleteStructures.join('、')}`);
          }
        } else {
          alert('章立ての解析に失敗しました。\n\n考えられる原因:\n1. AI出力の形式が期待と異なる\n2. 章の開始パターンが見つからない\n3. 必要な情報が不足している\n\nAIの応答内容を確認するには「AIログ」ボタンをクリックしてください。');
          setShowLogs(true);
        }
      } else {
        alert(`AI生成に失敗しました: ${response.error || '不明なエラー'}\n\nログを確認するには「AIログ」ボタンをクリックしてください。`);
        setShowLogs(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      addAILog({
        type: 'structure',
        prompt: buildAIPrompt('structure'),
        response: '',
        error: errorMessage
      });
      console.error('Structure-based AI generation error:', error);
      alert(`AI生成中にエラーが発生しました: ${errorMessage}\n\nログを確認するには「AIログ」ボタンをクリックしてください。`);
      setShowLogs(true);
    } finally {
      setIsGeneratingStructure(false);
    }
  };



  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500">
            <List className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            章立て構成
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          物語の章構成を設計しましょう。AIが自動的な構成展開案を作成します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    章構成一覧
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    {currentProject.chapters.length} 章設定済み
                    {searchQuery && (
                      <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                        （検索結果: {filterChapters(currentProject.chapters).length} 章）
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowLogs(true)}
                    className="flex items-center space-x-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    <span>AIログ</span>
                    {aiLogs.length > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                        {aiLogs.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>章を追加</span>
                  </button>
                </div>
              </div>
              
              {/* 検索バー */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="章を検索（タイトル、概要、キャラクター名など）"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* 折りたたみコントロール */}
              {currentProject.chapters.length > 0 && (
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={toggleAllChapters}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-['Noto_Sans_JP']"
                  >
                    {expandedChapters.size === currentProject.chapters.length ? 'すべて折りたたむ' : 'すべて展開する'}
                  </button>
                </div>
              )}
            </div>

            {/* Chapters List */}
            <div className="p-6">

              {currentProject.chapters.length === 0 ? (
                <div className="text-center py-12">
                  <List className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-xl text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                    まだ章が作成されていません
                  </p>
                  <p className="text-gray-500 dark:text-gray-500 mb-6 font-['Noto_Sans_JP']">
                    最初の章を作成して物語の構成を始めましょう
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    <Plus className="h-5 w-5" />
                    <span>最初の章を作成</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const filteredChapters = filterChapters(currentProject.chapters);
                    const originalIndices = new Map(filteredChapters.map(ch => [ch.id, currentProject.chapters.findIndex(c => c.id === ch.id)]));
                    
                    return filteredChapters.length === 0 ? (
                      <div className="text-center py-12">
                        <Search className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                        <p className="text-xl text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                          検索結果が見つかりませんでした
                        </p>
                        <p className="text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                          「{searchQuery}」に一致する章はありません
                        </p>
                      </div>
                    ) : (
                      filteredChapters.map((chapter) => {
                        const originalIndex = originalIndices.get(chapter.id) ?? 0;
                        const isExpanded = expandedChapters.has(chapter.id);
                        
                        return (
                          <div 
                            key={chapter.id}
                            ref={(el) => {
                              chapterRefs.current[chapter.id] = el;
                            }}
                            className={`bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-600 ${
                              draggedIndex === originalIndex ? 'opacity-50 scale-95' : ''
                            }`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, originalIndex)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, originalIndex)}
                          >
                            {/* 章ヘッダー（常に表示） */}
                            <div 
                              className="p-6 cursor-pointer"
                              onClick={() => toggleChapterExpansion(chapter.id)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleDoubleClickChapter(chapter);
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-4 flex-1">
                                  <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-bold text-lg">
                                      {originalIndex + 1}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleChapterExpansion(chapter.id);
                                        }}
                                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-5 w-5" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5" />
                                        )}
                                      </button>
                                      <h4 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                        {chapter.title}
                                      </h4>
                                    </div>
                                    {!isExpanded && (
                                      <div className="ml-7">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] line-clamp-2">
                                          {chapter.summary}
                                        </p>
                                        {chapter.characters && chapter.characters.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {chapter.characters.slice(0, 3).map((characterId) => {
                                              const character = currentProject.characters.find(c => c.id === characterId);
                                              const characterName = character ? character.name : characterId;
                                              return (
                                                <span
                                                  key={characterId}
                                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']"
                                                >
                                                  {characterName}
                                                </span>
                                              );
                                            })}
                                            {chapter.characters.length > 3 && (
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                                +{chapter.characters.length - 3}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2 ml-4">
                                  <div className="flex flex-col space-y-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveChapter(originalIndex, Math.max(0, originalIndex - 1));
                                      }}
                                      disabled={originalIndex === 0}
                                      className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="上に移動"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveChapter(originalIndex, Math.min(currentProject.chapters.length - 1, originalIndex + 1));
                                      }}
                                      disabled={originalIndex === currentProject.chapters.length - 1}
                                      className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="下に移動"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openHistoryModal(chapter.id);
                                    }}
                                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                    title="変更履歴"
                                  >
                                    <History className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditChapter(chapter);
                                    }}
                                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                    title="編集"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteChapter(chapter.id);
                                    }}
                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="削除"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* 章の詳細（折りたたみ可能） */}
                            {isExpanded && (
                              <div className="px-6 pb-6 pt-0 border-t border-gray-200 dark:border-gray-600">
                                <div className="ml-16 space-y-3">
                                  <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                    {chapter.summary}
                                  </p>
                                  
                                  {/* 設定・場所 */}
                                  {chapter.setting && (
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                        設定・場所:
                                      </span>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                                        {chapter.setting}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* 雰囲気・ムード */}
                                  {chapter.mood && (
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                        雰囲気・ムード:
                                      </span>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                                        {chapter.mood}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* 重要な出来事 */}
                                  {chapter.keyEvents && chapter.keyEvents.length > 0 && (
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                        重要な出来事:
                                      </span>
                                      <div className="mt-1 space-y-1">
                                        {chapter.keyEvents.map((event: string, eventIndex: number) => (
                                          <div key={eventIndex} className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                            • {event}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* 登場キャラクター */}
                                  {chapter.characters && chapter.characters.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                        登場キャラクター:
                                      </span>
                                      {chapter.characters.map((characterId) => {
                                        const character = currentProject.characters.find(c => c.id === characterId);
                                        const characterName = character ? character.name : characterId;
                                        return (
                                          <span
                                            key={characterId}
                                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']"
                                          >
                                            {characterName}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <div className="space-y-6">
          {sectionOrder.map((sectionId, index) => {
            const isExpanded = expandedSections.has(sectionId);
            const isDragging = draggedSectionIndex === index;
            const isDragOver = dragOverSectionIndex === index;

            // セクションのコンテンツをレンダリングする関数
            const renderSectionContent = () => {
              switch (sectionId) {
                case 'tableOfContents':
                  if (currentProject.chapters.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      {currentProject.chapters.map((chapter, chIndex) => {
                        const isChapterExpanded = expandedChapters.has(chapter.id);
                        const isVisible = !searchQuery || filterChapters(currentProject.chapters).some(ch => ch.id === chapter.id);
                        
                        if (!isVisible) return null;
                        
                        return (
                          <button
                            key={chapter.id}
                            onClick={() => scrollToChapter(chapter.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm font-['Noto_Sans_JP'] ${
                              isChapterExpanded
                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                {chIndex + 1}.
                              </span>
                              <span className="truncate">{chapter.title}</span>
                            </div>
                          </button>
                        );
                      })}
                      
                      {searchQuery && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                            検索中: {filterChapters(currentProject.chapters).length} / {currentProject.chapters.length} 章
                          </p>
                        </div>
                      )}
                    </div>
                  );

                case 'aiAssistant':
                  return (
                    <>
                      <div className="space-y-3 mb-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                          章立ての役割
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                            <span className="font-medium">• 物語の構成化:</span> 起承転結や三幕構成に沿った論理的な展開
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                            <span className="font-medium">• 読者の理解促進:</span> 明確な区切りで読みやすさを向上
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                            <span className="font-medium">• 執筆の指針:</span> 各章の目的と内容を事前に整理
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                            <span className="font-medium">• ペース管理:</span> 適切な緊張感と緩急のコントロール
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center space-x-2 mb-2">
                          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                            AI章立て機能
                          </span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP'] mb-3">
                          構成詳細（起承転結・三幕構成・四幕構成）を最重要視し、ジャンルに適した章立てを自動生成します。プロット基本設定から逸脱しないよう設計されています。
                        </p>
                        <button
                          onClick={handleAIGenerate}
                          disabled={isGenerating}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                        >
                          <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                          <span>{isGenerating ? '生成中...' : 'AI章立て提案'}</span>
                        </button>
                      </div>
                    </>
                  );

                case 'structureProgress':
                  return (
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">作成済み章数</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {currentProject.chapters.length} / 10
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-teal-500 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min((currentProject.chapters.length / 10) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-6 space-y-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">構成バランス</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mb-3">
                          各構成要素が実装できているかチェックしてください
                        </p>
                        <div className="space-y-3">
                          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleStructureProgressChange('introduction')}
                                  className="flex items-center justify-center w-5 h-5 rounded border-2 transition-colors"
                                  style={{
                                    backgroundColor: structureProgress.introduction ? '#10b981' : 'transparent',
                                    borderColor: structureProgress.introduction ? '#10b981' : '#d1d5db',
                                  }}
                                >
                                  {structureProgress.introduction && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                                <span className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">導入部</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                structureProgress.introduction 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                                  : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                              }`}>
                                {structureProgress.introduction ? '完了' : '未完了'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] ml-8">
                              世界観、キャラクター、基本設定を提示
                            </p>
                          </div>

                          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleStructureProgressChange('development')}
                                  className="flex items-center justify-center w-5 h-5 rounded border-2 transition-colors"
                                  style={{
                                    backgroundColor: structureProgress.development ? '#10b981' : 'transparent',
                                    borderColor: structureProgress.development ? '#10b981' : '#d1d5db',
                                  }}
                                >
                                  {structureProgress.development && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                                <span className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">展開部</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                structureProgress.development 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                                  : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                              }`}>
                                {structureProgress.development ? '完了' : '未完了'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] ml-8">
                              葛藤や問題を発展させ、物語を深める
                            </p>
                          </div>

                          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleStructureProgressChange('climax')}
                                  className="flex items-center justify-center w-5 h-5 rounded border-2 transition-colors"
                                  style={{
                                    backgroundColor: structureProgress.climax ? '#10b981' : 'transparent',
                                    borderColor: structureProgress.climax ? '#10b981' : '#d1d5db',
                                  }}
                                >
                                  {structureProgress.climax && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                                <span className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">クライマックス</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                structureProgress.climax 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                                  : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                              }`}>
                                {structureProgress.climax ? '完了' : '未完了'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] ml-8">
                              物語の最高潮、最大の転換点
                            </p>
                          </div>

                          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleStructureProgressChange('conclusion')}
                                  className="flex items-center justify-center w-5 h-5 rounded border-2 transition-colors"
                                  style={{
                                    backgroundColor: structureProgress.conclusion ? '#10b981' : 'transparent',
                                    borderColor: structureProgress.conclusion ? '#10b981' : '#d1d5db',
                                  }}
                                >
                                  {structureProgress.conclusion && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                                <span className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">結末部</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                structureProgress.conclusion 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                                  : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                              }`}>
                                {structureProgress.conclusion ? '完了' : '未完了'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] ml-8">
                              問題の解決、物語の締めくくり
                            </p>
                          </div>
                        </div>

                        {/* 全体の進捗表示 */}
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">構成完成度</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {Object.values(structureProgress).filter(Boolean).length} / 4
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${(Object.values(structureProgress).filter(Boolean).length / 4) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* 構成バランスAI提案ボタン */}
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h5 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                              構成バランスAI提案
                            </h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
                              未完了の構成要素に焦点を当て、構成詳細を最重要視した章立てをAIが提案します。ジャンルに適した構成で補完します。
                            </p>
                            <button
                              onClick={handleStructureBasedAIGenerate}
                              disabled={isGeneratingStructure || Object.values(structureProgress).every(Boolean)}
                              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-['Noto_Sans_JP']"
                            >
                              <Sparkles className={`h-4 w-4 ${isGeneratingStructure ? 'animate-spin' : ''}`} />
                              <span>
                                {isGeneratingStructure 
                                  ? '生成中...' 
                                  : Object.values(structureProgress).every(Boolean)
                                    ? 'すべて完了済み'
                                    : '構成バランス提案'
                                }
                              </span>
                            </button>
                            {Object.values(structureProgress).some(Boolean) && !Object.values(structureProgress).every(Boolean) && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-['Noto_Sans_JP']">
                                未完了: {Object.entries(structureProgress)
                                  .filter(([_key, completed]) => !completed)
                                  .map(([key, _value]) => {
                                    const labels = {
                                      introduction: '導入部',
                                      development: '展開部',
                                      climax: 'クライマックス',
                                      conclusion: '結末部'
                                    };
                                    return labels[key as keyof typeof labels];
                                  })
                                  .join('、')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  );

                default:
                  return null;
              }
            };

            // セクションのタイトルとアイコン
            const getSectionInfo = () => {
              switch (sectionId) {
                case 'tableOfContents':
                  return {
                    title: '章目次',
                    icon: BookOpen,
                    bgClass: 'bg-white dark:bg-gray-800',
                    borderClass: 'border-gray-100 dark:border-gray-700',
                    iconBgClass: 'bg-gradient-to-br from-indigo-500 to-purple-600',
                    maxHeight: 'max-h-[400px]'
                  };
                case 'aiAssistant':
                  return {
                    title: '構成アシスタント',
                    icon: Sparkles,
                    bgClass: 'bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20',
                    borderClass: 'border-blue-200 dark:border-blue-800',
                    iconBgClass: 'bg-gradient-to-br from-blue-500 to-teal-600',
                    maxHeight: ''
                  };
                case 'structureProgress':
                  return {
                    title: '構成進捗',
                    icon: Check,
                    bgClass: 'bg-white dark:bg-gray-800',
                    borderClass: 'border-gray-100 dark:border-gray-700',
                    iconBgClass: 'bg-gradient-to-br from-green-500 to-emerald-600',
                    maxHeight: ''
                  };
              }
            };

            const sectionInfo = getSectionInfo();
            const IconComponent = sectionInfo.icon;
            const content = renderSectionContent();

            // 章目次が空の場合は非表示
            if (sectionId === 'tableOfContents' && currentProject.chapters.length === 0) {
              return null;
            }

            return (
              <div
                key={sectionId}
                draggable
                onDragStart={(e) => handleSectionDragStart(e, index)}
                onDragOver={(e) => handleSectionDragOver(e, index)}
                onDragLeave={handleSectionDragLeave}
                onDrop={(e) => handleSectionDrop(e, index)}
                onDragEnd={handleSectionDragEnd}
                className={`${sectionInfo.bgClass} rounded-2xl shadow-lg border transition-all duration-200 ${
                  isDragging
                    ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                    : isDragOver
                      ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                      : `${sectionInfo.borderClass} cursor-move hover:shadow-xl`
                }`}
              >
                {/* ヘッダー */}
                <div
                  className="p-6 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
                  onClick={() => toggleSection(sectionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className={`${sectionInfo.iconBgClass} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {sectionInfo.title}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* コンテンツ */}
                {isExpanded && content && (
                  <div className={`p-6 overflow-y-auto ${sectionInfo.maxHeight}`}>
                    {content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Chapter Modal */}
      {showAddForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  新しい章を追加
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    章タイトル *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="例：第1章 異世界への扉"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    章の概要
                  </label>
                  <textarea
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    placeholder="この章で起こることや目標を簡潔に説明してください"
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                  <div className="mt-1 text-right">
                    <span className={`text-xs font-['Noto_Sans_JP'] ${
                      formData.summary.length > 300 
                        ? 'text-red-500 dark:text-red-400' 
                        : formData.summary.length > 200 
                          ? 'text-yellow-500 dark:text-yellow-400' 
                          : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formData.summary.length} 文字
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    設定・場所
                  </label>
                  <textarea
                    value={formData.setting}
                    onChange={(e) => setFormData({ ...formData, setting: e.target.value })}
                    placeholder="この章の舞台となる場所や設定を詳細に入力（例：学校の屋上、夕方、雨が降り始めている）"
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    雰囲気・ムード
                  </label>
                  <input
                    type="text"
                    value={formData.mood}
                    onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                    placeholder="この章の雰囲気やムードを入力（例：緊張感、和やか、悲壮感など）"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    登場キャラクター
                  </label>
                  <div className="space-y-3">
                    {/* キャラクター選択 */}
                    {currentProject.characters.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {currentProject.characters.map((character) => (
                          <button
                            key={character.id}
                            onClick={() => handleCharacterToggle(character.id)}
                            className={`px-3 py-1 rounded-full text-sm transition-all ${
                              formData.characters.includes(character.id)
                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-500'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {character.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center">
                          キャラクターが設定されていません。キャラクター設定からキャラクターを追加してください。
                        </p>
                      </div>
                    )}
                    
                    {/* 選択されたキャラクター表示 */}
                    {formData.characters.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.characters.map((characterId) => {
                          const character = currentProject.characters.find(c => c.id === characterId);
                          return character ? (
                            <div
                              key={characterId}
                              className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                            >
                              <span>{character.name}</span>
                              <button
                                onClick={() => handleCharacterToggle(characterId)}
                                className="ml-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"
                              >
                                ×
                              </button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                    
                    {/* 手動入力 */}
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="キャラクター名を手動入力"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.currentTarget.value.trim();
                            if (input && !formData.characters.includes(input)) {
                              // 手動入力の場合は文字列としてIDとして使用
                              setFormData(prev => ({
                                ...prev,
                                characters: [...prev.characters, input]
                              }));
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                          const value = input?.value.trim();
                          if (value && !formData.characters.includes(value)) {
                            setFormData(prev => ({
                              ...prev,
                              characters: [...prev.characters, value]
                            }));
                            input.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP'] text-sm"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    重要な出来事
                  </label>
                  <div className="space-y-2">
                    {formData.keyEvents.map((event, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={event}
                          onChange={(e) => handleKeyEventChange(index, e.target.value, false)}
                          placeholder="重要な出来事を入力"
                          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyEvent(index, false)}
                          className="p-2 text-red-500 hover:text-red-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddKeyEvent(false)}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors font-['Noto_Sans_JP']"
                    >
                      + 出来事を追加
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP'] font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddChapter}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] font-medium shadow-lg"
                >
                  章を追加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Chapter Modal */}
      {showEditForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseEditModal();
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  章を編集
                </h3>
                <button
                  onClick={handleCloseEditModal}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    章タイトル *
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    placeholder="例：第1章 異世界への扉"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    章の概要
                  </label>
                  <textarea
                    value={editFormData.summary}
                    onChange={(e) => setEditFormData({ ...editFormData, summary: e.target.value })}
                    placeholder="この章で起こることや目標を簡潔に説明してください"
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                  <div className="mt-1 text-right">
                    <span className={`text-xs font-['Noto_Sans_JP'] ${
                      editFormData.summary.length > 300 
                        ? 'text-red-500 dark:text-red-400' 
                        : editFormData.summary.length > 200 
                          ? 'text-yellow-500 dark:text-yellow-400' 
                          : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {editFormData.summary.length} 文字
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    設定・場所
                  </label>
                  <textarea
                    value={editFormData.setting}
                    onChange={(e) => setEditFormData({ ...editFormData, setting: e.target.value })}
                    placeholder="この章の舞台となる場所や設定を詳細に入力（例：学校の屋上、夕方、雨が降り始めている）"
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    雰囲気・ムード
                  </label>
                  <input
                    type="text"
                    value={editFormData.mood}
                    onChange={(e) => setEditFormData({ ...editFormData, mood: e.target.value })}
                    placeholder="この章の雰囲気やムードを入力（例：緊張感、和やか、悲壮感など）"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    登場キャラクター
                  </label>
                  <div className="space-y-3">
                    {/* キャラクター選択 */}
                    {currentProject.characters.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {currentProject.characters.map((character) => (
                          <button
                            key={character.id}
                            onClick={() => handleCharacterToggle(character.id, true)}
                            className={`px-3 py-1 rounded-full text-sm transition-all ${
                              editFormData.characters.includes(character.id)
                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-500'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {character.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center">
                          キャラクターが設定されていません。キャラクター設定からキャラクターを追加してください。
                        </p>
                      </div>
                    )}
                    
                    {/* 選択されたキャラクター表示 */}
                    {editFormData.characters.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {editFormData.characters.map((characterId) => {
                          const character = currentProject.characters.find(c => c.id === characterId);
                          return character ? (
                            <div
                              key={characterId}
                              className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                            >
                              <span>{character.name}</span>
                              <button
                                onClick={() => handleCharacterToggle(characterId, true)}
                                className="ml-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"
                              >
                                ×
                              </button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                    
                    {/* 手動入力 */}
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="キャラクター名を手動入力"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.currentTarget.value.trim();
                            if (input && !editFormData.characters.includes(input)) {
                              setEditFormData(prev => ({
                                ...prev,
                                characters: [...prev.characters, input]
                              }));
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                          const value = input?.value.trim();
                          if (value && !editFormData.characters.includes(value)) {
                            setEditFormData(prev => ({
                              ...prev,
                              characters: [...prev.characters, value]
                            }));
                            input.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP'] text-sm"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    重要な出来事
                  </label>
                  <div className="space-y-2">
                    {editFormData.keyEvents.map((event, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={event}
                          onChange={(e) => handleKeyEventChange(index, e.target.value, true)}
                          placeholder="重要な出来事を入力"
                          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyEvent(index, true)}
                          className="p-2 text-red-500 hover:text-red-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddKeyEvent(true)}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors font-['Noto_Sans_JP']"
                    >
                      + 出来事を追加
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseEditModal}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP'] font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdateChapter}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] font-medium shadow-lg"
                >
                  更新
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Logs Modal */}
      {showLogs && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogs(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  AI生成ログ
                </h3>
                <button
                  onClick={() => setShowLogs(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {aiLogs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-xl text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                    AIログがありません
                  </p>
                  <p className="text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                    AI章立て提案を実行すると、ここにログが表示されます
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {aiLogs.map((log) => (
                    <div key={log.id} className="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            log.type === 'basic' 
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                          }`}>
                            {log.type === 'basic' ? '基本AI章立て提案' : '構成バランスAI提案'}
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                            {log.timestamp.toLocaleString()}
                          </span>
                          {log.error && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                              エラー
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => copyToClipboard(log.response)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="応答をコピー"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => downloadLog(log)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="ログをダウンロード"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* エラー表示 */}
                      {log.error && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2 font-['Noto_Sans_JP']">
                            エラー内容
                          </h4>
                          <p className="text-red-700 dark:text-red-300 font-['Noto_Sans_JP'] text-sm">
                            {log.error}
                          </p>
                        </div>
                      )}

                      {/* プロンプト表示 */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 font-['Noto_Sans_JP']">
                          プロンプト
                        </h4>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP'] overflow-x-auto">
                            {log.prompt}
                          </pre>
                        </div>
                      </div>

                      {/* AI応答表示 */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 font-['Noto_Sans_JP']">
                          AI応答
                        </h4>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP'] overflow-x-auto">
                            {log.response || '応答なし'}
                          </pre>
                        </div>
                      </div>

                      {/* 解析結果表示 */}
                      {log.parsedChapters && log.parsedChapters.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 font-['Noto_Sans_JP']">
                            解析された章 ({log.parsedChapters.length}章)
                          </h4>
                          <div className="space-y-2">
                            {log.parsedChapters.map((chapter, index) => (
                              <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                  {index + 1}. {chapter.title}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                                  {chapter.summary}
                                </div>
                                {chapter.setting && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP'] mt-1">
                                    設定: {chapter.setting}
                                  </div>
                                )}
                                {chapter.mood && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                                    ムード: {chapter.mood}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chapter History Modal */}
      {showHistoryModal && selectedChapterId && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHistoryModal(false);
              setSelectedChapterId(null);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                    <History className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      変更履歴
                    </h3>
                    {currentProject && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                        {currentProject.chapters.find(c => c.id === selectedChapterId)?.title || '章の履歴'}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedChapterId(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {(() => {
                const histories = chapterHistories[selectedChapterId] || [];
                const currentChapter = currentProject?.chapters.find(c => c.id === selectedChapterId);
                
                if (histories.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <History className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <p className="text-xl text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                        変更履歴がありません
                      </p>
                      <p className="text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                        章を編集すると、ここに履歴が表示されます
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* 現在の状態 */}
                    {currentChapter && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="font-semibold text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                              現在の状態
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">タイトル:</span>
                            <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{currentChapter.title}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">概要:</span>
                            <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{currentChapter.summary || '（未設定）'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 履歴一覧 */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                        過去の履歴 ({histories.length}件)
                      </h4>
                      {histories.map((history, index) => (
                        <div 
                          key={history.id} 
                          className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                #{histories.length - index}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                {history.timestamp.toLocaleString('ja-JP', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (confirm('この履歴の状態に復元しますか？現在の状態は履歴として保存されます。')) {
                                  restoreChapterFromHistory(history);
                                }
                              }}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-['Noto_Sans_JP']"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>この状態に復元</span>
                            </button>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">タイトル:</span>
                              <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{history.data.title}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">概要:</span>
                              <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] line-clamp-2">
                                {history.data.summary || '（未設定）'}
                              </p>
                            </div>
                            {history.data.setting && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">設定・場所:</span>
                                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{history.data.setting}</p>
                              </div>
                            )}
                            {history.data.mood && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">雰囲気・ムード:</span>
                                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{history.data.mood}</p>
                              </div>
                            )}
                            {history.data.characters.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">登場キャラクター:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {history.data.characters.map((characterId, idx) => {
                                    const character = currentProject?.characters.find(c => c.id === characterId);
                                    const characterName = character ? character.name : characterId;
                                    return (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']"
                                      >
                                        {characterName}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {history.data.keyEvents.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">重要な出来事:</span>
                                <ul className="mt-1 space-y-1">
                                  {history.data.keyEvents.map((event, idx) => (
                                    <li key={idx} className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] text-sm">
                                      • {event}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};