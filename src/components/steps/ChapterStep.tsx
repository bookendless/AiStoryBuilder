import React, { useState, useEffect, useCallback } from 'react';
import { List, Plus, Sparkles, Edit3, Trash2, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';

// ProjectContextの型を使用するため、ローカルのChapterインターフェースは削除

interface StructureProgress {
  introduction: boolean;
  development: boolean;
  climax: boolean;
  conclusion: boolean;
}

export const ChapterStep: React.FC = () => {
  const { currentProject, updateProject, deleteChapter } = useProject();
  const { settings, isConfigured } = useAI();
  
  // 状態管理
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
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

  // プロジェクトが変更されたときに構成バランスの状態を初期化
  useEffect(() => {
    if (currentProject) {
      const project = currentProject as any;
      setStructureProgress({
        introduction: project.structureProgress?.introduction || false,
        development: project.structureProgress?.development || false,
        climax: project.structureProgress?.climax || false,
        conclusion: project.structureProgress?.conclusion || false,
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
        synopsis: '',
        plot: {
          theme: '',
          setting: '',
          structure: '',
          hook: '',
          structureDetails: '',
        },
        characters: [],
        existingChapters: [],
        imageBoard: []
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
      
      // あらすじ（最重要）
      synopsis: currentProject.synopsis || '',
      
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
        setting: (c as any).setting || '',
        mood: (c as any).mood || '',
        keyEvents: (c as any).keyEvents || []
      })),
      
      // イメージボード情報
      imageBoard: currentProject.imageBoard?.map(img => ({
        description: img.description,
        url: img.url
      })) || []
    };
  };

  const parseAIResponse = (content: string) => {
    const newChapters: Array<{id: string; title: string; summary: string; characters?: string[]; setting?: string; mood?: string; keyEvents?: string[]}> = [];
    const lines = content.split('\n').filter(line => line.trim());
    let currentChapter = null;

    for (const line of lines) {
      const chapterMatch = line.match(/第(\d+)章:\s*(.+)/) || line.match(/(\d+)\.\s*(.+)/);
      if (chapterMatch) {
        if (currentChapter) {
          newChapters.push(currentChapter);
        }
        currentChapter = {
          id: Date.now().toString() + Math.random(),
          title: chapterMatch[2].trim(),
          summary: '',
          setting: '',
          mood: '',
          keyEvents: [] as string[],
          characters: [] as string[],
        };
      } else if (currentChapter) {
        if (line.includes('概要:') || line.includes('概要：')) {
          currentChapter.summary = line.replace(/概要[：:]\s*/, '').trim();
        } else if (line.includes('設定・場所:') || line.includes('設定・場所：')) {
          currentChapter.setting = line.replace(/設定・場所[：:]\s*/, '').trim();
        } else if (line.includes('雰囲気・ムード:') || line.includes('雰囲気・ムード：')) {
          currentChapter.mood = line.replace(/雰囲気・ムード[：:]\s*/, '').trim();
        } else if (line.includes('重要な出来事:') || line.includes('重要な出来事：')) {
          const eventsText = line.replace(/重要な出来事[：:]\s*/, '').trim();
          currentChapter.keyEvents = eventsText.split(/[,、]/).map(event => event.trim()).filter(event => event) as string[];
        } else if (line.includes('登場キャラクター:') || line.includes('登場キャラクター：') || line.includes('登場人物:') || line.includes('登場人物：')) {
          const charactersText = line.replace(/登場(キャラクター|人物)[：:]\s*/, '').trim();
          currentChapter.characters = charactersText.split(/[,、]/).map(char => char.trim()).filter(char => char) as string[];
        } else if (currentChapter.summary === '' && !line.startsWith('役割:') && !line.startsWith('ペース:') && !line.includes('設定・場所') && !line.includes('雰囲気・ムード') && !line.includes('重要な出来事') && !line.includes('登場')) {
          currentChapter.summary = line.trim();
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
      } as any);
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
      if (e.key === 'Escape' && (showAddForm || showEditForm)) {
        if (showAddForm) {
          handleCloseModal();
        } else if (showEditForm) {
          handleCloseEditModal();
        }
      }
    };

    if (showAddForm || showEditForm) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showAddForm, showEditForm, handleCloseModal, handleCloseEditModal]);

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

    updateProject({
      chapters: currentProject.chapters.map(c => 
        c.id === editingId 
          ? { 
              ...c, 
              title: editFormData.title.trim(), 
              summary: editFormData.summary.trim(), 
              characters: editFormData.characters,
              setting: editFormData.setting.trim(),
              mood: editFormData.mood.trim(),
              keyEvents: editFormData.keyEvents
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

【最重要】構成詳細（必ず従う）
${context.plot?.structureDetails || '構成詳細が設定されていません'}

【未完了構成要素】
${incompleteStructures.join('、')}

【キャラクター】
${context.characters.slice(0, 3).map((c: any) => `${c.name}(${c.role})`).join(', ')}

【出力形式】
第1章: [章タイトル]
概要: [章の概要（200文字程度）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, ...]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2, ...]

【出力制約】
- 最低4章以上作成すること
- 各章の概要は200文字程度に収めること
- 設定・場所、雰囲気・ムード、重要な出来事、登場キャラクターも含めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 必ず指定された形式で出力すること

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

【最重要】構成詳細（必ず従う）
${context.plot?.structureDetails || '構成詳細が設定されていません'}

【キャラクター情報】
${context.characters.map((c: any) => 
  `・${c.name} (${c.role})
  外見: ${c.appearance}
  性格: ${c.personality}
  背景: ${c.background}`
).join('\n')}

【既存章構成】
${context.existingChapters.map((ch: any, index: number) => {
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

【出力形式】
第1章: [章タイトル]
概要: [章の概要（200文字程度）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, ...]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2, ...]

【出力制約】
- 最低4章以上作成すること
- 各章の概要は200文字程度に収めること
- 設定・場所、雰囲気・ムード、重要な出来事、登場キャラクターも含めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 必ず指定された形式で出力すること

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

主要キャラクター: ${context.characters.length > 0 ? context.characters.slice(0, 3).map((c: any) => `${c.name}(${c.role})`).join(', ') : 'キャラクターが設定されていません'}

【出力形式】
第1章: [章タイトル]
概要: [章の概要（200文字程度）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, ...]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2, ...]

【出力制約】
- 最低4章以上作成すること
- 各章の概要は200文字程度に収めること
- 設定・場所、雰囲気・ムード、重要な出来事、登場キャラクターも含めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 必ず指定された形式で出力すること

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

【最重要】構成詳細（必ず従う）
${context.plot.structureDetails || '構成詳細が設定されていません'}

【主要キャラクター】
${context.characters.map(c => `・${c.name} (${c.role})
  外見: ${c.appearance}
  性格: ${c.personality}
  背景: ${c.background}`).join('\n') || 'キャラクターが設定されていません'}

【既存の章】
${context.existingChapters.map((c: any) => {
  let chapterInfo = `・${c.title}: ${c.summary}`;
  if (c.setting) chapterInfo += `\n  設定・場所: ${c.setting}`;
  if (c.mood) chapterInfo += `\n  雰囲気・ムード: ${c.mood}`;
  if (c.keyEvents && c.keyEvents.length > 0) {
    chapterInfo += `\n  重要な出来事: ${c.keyEvents.join(', ')}`;
  }
  return chapterInfo;
}).join('\n\n') || '既存の章はありません'}

【出力形式】
以下の形式で必ず出力してください。各章は番号付きで、タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクターを含めてください。

第1章: [章タイトル]
概要: [章の概要（200文字程度）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, ...]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2, ...]

第2章: [章タイトル]
概要: [章の概要（200文字程度）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, ...]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2, ...]

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章の概要は200文字程度に収めること
- 設定・場所、雰囲気・ムード、重要な出来事、登場キャラクターも含めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 必ず指定された形式で出力すること

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

      if (response.error) {
        alert(`AI生成エラー: ${response.error}`);
        return;
      }

      const newChapters = parseAIResponse(response.content);
      
      if (newChapters.length > 0) {
        updateProject({
          chapters: [...currentProject!.chapters, ...newChapters],
        });
        alert(`AI構成提案で${newChapters.length}章を追加しました。`);
      } else {
        alert('章立ての解析に失敗しました。手動で追加してください。');
      }
      
    } catch (error) {
      alert('AI生成中にエラーが発生しました');
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

      if (response.content && !response.error) {
        const newChapters = parseAIResponse(response.content);

        if (newChapters.length > 0) {
          updateProject({
            chapters: [...currentProject.chapters, ...newChapters],
          });
          alert(`構成バランスAI提案で${newChapters.length}章を追加しました。\n対象: ${incompleteStructures.join('、')}`);
        } else {
          alert('章立ての解析に失敗しました。手動で追加してください。');
        }
      } else {
        alert(`AI生成に失敗しました: ${response.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('Structure-based AI generation error:', error);
      alert('AI生成中にエラーが発生しました。ブラウザのコンソールを確認してください。');
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          章立て構成
        </h1>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          物語の章構成を設計しましょう。AIが自動的な構成展開案を作成します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-10 h-10 rounded-full flex items-center justify-center">
                    <List className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      章構成一覧
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {currentProject.chapters.length} 章設定済み
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>章を追加</span>
                  </button>
                </div>
              </div>
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
                  {currentProject.chapters.map((chapter, index) => (
                    <div 
                      key={chapter.id} 
                      className={`bg-gray-50 dark:bg-gray-700 p-6 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                        draggedIndex === index ? 'opacity-50 scale-95' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onDoubleClick={() => handleDoubleClickChapter(chapter)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-4">
                          <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-lg">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                              {chapter.title}
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-2">
                              {chapter.summary}
                            </p>
                            
                            {/* 設定・場所 */}
                            {(chapter as any).setting && (
                              <div className="mb-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                  設定・場所:
                                </span>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                                  {(chapter as any).setting}
                                </p>
                              </div>
                            )}
                            
                            {/* 雰囲気・ムード */}
                            {(chapter as any).mood && (
                              <div className="mb-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                  雰囲気・ムード:
                                </span>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                                  {(chapter as any).mood}
                                </p>
                              </div>
                            )}
                            
                            {/* 重要な出来事 */}
                            {(chapter as any).keyEvents && (chapter as any).keyEvents.length > 0 && (
                              <div className="mb-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                  重要な出来事:
                                </span>
                                <div className="mt-1 space-y-1">
                                  {(chapter as any).keyEvents.map((event: string, index: number) => (
                                    <div key={index} className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                      • {event}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {chapter.characters && chapter.characters.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                  登場キャラクター:
                                </span>
                                {chapter.characters.map((characterId) => {
                                  const character = currentProject.characters.find(c => c.id === characterId);
                                  // キャラクターが見つからない場合は手動入力された名前として扱う
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
                        
                        <div className="flex items-center space-x-2">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveChapter(index, Math.max(0, index - 1));
                              }}
                              disabled={index === 0}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="上に移動"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveChapter(index, Math.min(currentProject.chapters.length - 1, index + 1));
                              }}
                              disabled={index === currentProject.chapters.length - 1}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="下に移動"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-10 h-10 rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                構成アシスタント
              </h3>
            </div>
            
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
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
              構成進捗
            </h3>
            
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
                        .filter(([_, completed]) => !completed)
                        .map(([key, _]) => {
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
          </div>
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
    </div>
  );
};