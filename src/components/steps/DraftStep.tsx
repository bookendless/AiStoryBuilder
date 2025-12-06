import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { PenTool, BookOpen, ChevronDown, ChevronUp, AlignLeft, AlignJustify, Settings } from 'lucide-react';
import { diffLines, type Change } from 'diff';
import { aiService } from '../../services/aiService';
import { databaseService } from '../../services/databaseService';
import {
  HISTORY_AUTO_SAVE_DELAY,
  HISTORY_MAX_ENTRIES,
  HISTORY_TYPE_LABELS,
  MODAL_DEFAULT_FONT_SIZE,
  MODAL_DEFAULT_LINE_HEIGHT,
  MODAL_TEXTAREA_DEFAULT_HEIGHT,
  MODAL_TEXTAREA_MAX_HEIGHT,
  MODAL_TEXTAREA_MIN_HEIGHT,
} from './draft/constants';
// ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行
import { DisplaySettingsPanel } from './draft/DisplaySettingsPanel';
import { Toast } from './draft/Toast';
import { ImprovementLogModal } from './draft/ImprovementLogModal';
import { CustomPromptModal } from './draft/CustomPromptModal';
import { BackupDescriptionModal } from './draft/BackupDescriptionModal';
import { AIStatusBar } from './draft/AIStatusBar';
import { DraftHeader } from './draft/DraftHeader';
import { ChapterTabs } from './draft/ChapterTabs';
import { MainEditor, type MainEditorHandle } from './draft/MainEditor';
import { ForeshadowingPanel } from './draft/ForeshadowingPanel';
import { useAILog } from '../common/hooks/useAILog';
import { AILogPanel } from '../common/AILogPanel';
import { useChapterDraft } from './draft/hooks/useChapterDraft';
import { useExport } from './draft/hooks/useExport';
// AI生成機能はToolsSidebarのDraftAssistantPanelに移行
// テキスト選択機能は削除され、AI機能はToolsSidebarに移行
import { useAllChaptersGeneration } from './draft/hooks/useAllChaptersGeneration';
import { useToast } from '../Toast';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import type {
  AIStatusTone,
  ChapterHistoryEntry,
  HistoryEntryType,
  ImprovementLog,
  SecondaryTab,
} from './draft/types';


export const DraftStep: React.FC = () => {
  const { currentProject, updateProject, createManualBackup } = useProject();
  const { isConfigured, settings } = useAI();
  const { showError, showSuccess, showWarning } = useToast();
  
  // State variables
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState('');
  const [isVerticalWriting, setIsVerticalWriting] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isModalChapterInfoCollapsed, setIsModalChapterInfoCollapsed] = useState(false);
  const [isImprovementLogModalOpen, setIsImprovementLogModalOpen] = useState(false);
  const [chapterHistories, setChapterHistories] = useState<Record<string, ChapterHistoryEntry[]>>({});
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const [improvementLogs, setImprovementLogs] = useState<Record<string, ImprovementLog[]>>({});
  const [selectedImprovementLogId, setSelectedImprovementLogId] = useState<string | null>(null);
  
  // カスタムプロンプト用の状態
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);
  
  // バックアップモーダル用の状態
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isChapterInfoCollapsed, setIsChapterInfoCollapsed] = useState(false);
  const [mainTextareaHeight, setMainTextareaHeight] = useState(MODAL_TEXTAREA_DEFAULT_HEIGHT);
  const [mainFontSize, setMainFontSize] = useState<number>(MODAL_DEFAULT_FONT_SIZE);
  const [mainLineHeight, setMainLineHeight] = useState<number>(MODAL_DEFAULT_LINE_HEIGHT);
  
  // ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行
  
  // 伏線パネル用の状態
  const [isForeshadowingPanelCollapsed, setIsForeshadowingPanelCollapsed] = useState(false);
  
  // トースト通知用の状態
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // 章の草案管理フック
  const {
    draft,
    setDraft,
    chapterDrafts,
    setChapterDrafts,
    lastSavedAt,
    handleSaveChapterDraft: handleSaveChapterDraftFromHook,
  } = useChapterDraft({
    currentProject,
    updateProject,
    selectedChapter,
    onSaveError: (error) => {
      console.error('章草案保存エラー:', error);
    },
    onToastMessage: setToastMessage,
  });
  
  // エクスポート機能
  const { exportChapter, exportFull } = useExport({
    currentProject,
    chapterDrafts,
    onSuccess: showSuccess,
    onError: (message, title) => {
      showError(message, 7000, { title });
    },
    onWarning: (message, title) => {
      showWarning(message, 5000, { title });
    },
  });

  // AIログ管理
  const { aiLogs, addLog } = useAILog({
    projectId: currentProject?.id,
    chapterId: selectedChapter || undefined,
    autoLoad: true,
  });

  // 現在の章を取得（メモ化）
  const currentChapter = useMemo(() => {
    if (!selectedChapter || !currentProject) return null;
    return currentProject.chapters.find(c => c.id === selectedChapter) || null;
  }, [selectedChapter, currentProject]);

  // 章詳細情報を取得（メモ化）
  const getChapterDetails = useCallback((chapter: { characters?: string[]; setting?: string; mood?: string; keyEvents?: string[] }) => {
    if (!chapter || !currentProject) {
      return {
        characters: '未設定',
        setting: '未設定',
        mood: '未設定',
        keyEvents: '未設定'
      };
    }

    // キャラクター情報の取得を修正
    // chapter.charactersは文字列配列（キャラクター名またはキャラクターID）として保存されている
    // キャラクターIDの場合はキャラクター名に変換する
    const characters = chapter.characters && chapter.characters.length > 0
      ? chapter.characters.map(charIdOrName => {
          // キャラクターIDかどうかを判定（IDは通常UUIDやタイムスタンプベースの文字列）
          const character = currentProject.characters.find(c => c.id === charIdOrName);
          return character ? character.name : charIdOrName;
        }).join(', ')
      : '未設定';

    const setting = chapter.setting || '未設定';
    const mood = chapter.mood || '未設定';
    const keyEvents = chapter.keyEvents && chapter.keyEvents.length > 0
      ? chapter.keyEvents.join(', ')
      : '未設定';

    return { characters, setting, mood, keyEvents };
  }, [currentProject]);

  // 設定情報の取得ヘルパー
  const getProjectContextInfo = useCallback(() => {
    if (!currentProject) return { worldSettings: '', glossary: '', relationships: '', plotInfo: '' };

    // 1. 世界観設定・用語集
    const worldSettingsList = currentProject.worldSettings || [];
    const glossaryList = currentProject.glossary || [];
    
    // 重要度が高いものを優先的に抽出（ここでは簡易的に全件、ただし長すぎる場合は制限が必要）
    // プロンプトサイズ削減のため、タイトルと内容の要約のみを抽出するなどの工夫が可能
    const worldSettingsText = worldSettingsList.length > 0 
      ? worldSettingsList.map(w => `・${w.title}: ${w.content.substring(0, 100)}...`).join('\n')
      : '特になし';
      
    const glossaryText = glossaryList.length > 0
      ? glossaryList.map(g => `・${g.term}: ${g.definition.substring(0, 100)}...`).join('\n')
      : '特になし';

    // 2. キャラクター相関図
    const relationshipsList = currentProject.relationships || [];
    const relationshipsText = relationshipsList.length > 0
      ? relationshipsList.map(r => {
          const fromChar = currentProject.characters.find(c => c.id === r.from)?.name || '不明';
          const toChar = currentProject.characters.find(c => c.id === r.to)?.name || '不明';
          return `・${fromChar} → ${toChar}: ${r.type} (${r.description || ''})`;
        }).join('\n')
      : '特になし';

    // 3. 物語構造の進行度
    // PlotStep2の情報を活用
    const plot = currentProject.plot;
    let plotInfo = '構成情報なし';
    
    if (plot.structure === 'kishotenketsu') {
      plotInfo = `全体構造: 起承転結
起: ${plot.ki?.substring(0, 50) || '未設定'}...
承: ${plot.sho?.substring(0, 50) || '未設定'}...
転: ${plot.ten?.substring(0, 50) || '未設定'}...
結: ${plot.ketsu?.substring(0, 50) || '未設定'}...`;
    } else if (plot.structure === 'three-act') {
      plotInfo = `全体構造: 三幕構成
第1幕: ${plot.act1?.substring(0, 50) || '未設定'}...
第2幕: ${plot.act2?.substring(0, 50) || '未設定'}...
第3幕: ${plot.act3?.substring(0, 50) || '未設定'}...`;
    } else if (plot.structure === 'four-act') {
      plotInfo = `全体構造: 四幕構成
第1幕: ${plot.fourAct1?.substring(0, 50) || '未設定'}...
第2幕: ${plot.fourAct2?.substring(0, 50) || '未設定'}...
第3幕: ${plot.fourAct3?.substring(0, 50) || '未設定'}...
第4幕: ${plot.fourAct4?.substring(0, 50) || '未設定'}...`;
    } else if (plot.structure === 'heroes-journey') {
      plotInfo = `全体構造: ヒーローズ・ジャーニー
日常の世界: ${plot.hj1?.substring(0, 50) || '未設定'}...
冒険への誘い: ${plot.hj2?.substring(0, 50) || '未設定'}...
境界越え: ${plot.hj3?.substring(0, 50) || '未設定'}...
試練と仲間: ${plot.hj4?.substring(0, 50) || '未設定'}...
最大の試練: ${plot.hj5?.substring(0, 50) || '未設定'}...
報酬: ${plot.hj6?.substring(0, 50) || '未設定'}...
帰路: ${plot.hj7?.substring(0, 50) || '未設定'}...
復活と帰還: ${plot.hj8?.substring(0, 50) || '未設定'}...`;
    } else if (plot.structure === 'beat-sheet') {
      plotInfo = `全体構造: ビートシート
導入 (Setup): ${plot.bs1?.substring(0, 50) || '未設定'}...
決断 (Break into Two): ${plot.bs2?.substring(0, 50) || '未設定'}...
試練 (Fun and Games): ${plot.bs3?.substring(0, 50) || '未設定'}...
転換点 (Midpoint): ${plot.bs4?.substring(0, 50) || '未設定'}...
危機 (All Is Lost): ${plot.bs5?.substring(0, 50) || '未設定'}...
クライマックス (Finale): ${plot.bs6?.substring(0, 50) || '未設定'}...
結末 (Final Image): ${plot.bs7?.substring(0, 50) || '未設定'}...`;
    } else if (plot.structure === 'mystery-suspense') {
      plotInfo = `全体構造: ミステリー・サスペンス構成
発端（事件発生）: ${plot.ms1?.substring(0, 50) || '未設定'}...
捜査（初期）: ${plot.ms2?.substring(0, 50) || '未設定'}...
仮説とミスリード: ${plot.ms3?.substring(0, 50) || '未設定'}...
第二の事件/急展開: ${plot.ms4?.substring(0, 50) || '未設定'}...
手がかりの統合: ${plot.ms5?.substring(0, 50) || '未設定'}...
解決（真相解明）: ${plot.ms6?.substring(0, 50) || '未設定'}...
エピローグ: ${plot.ms7?.substring(0, 50) || '未設定'}...`;
    }

    return {
      worldSettings: worldSettingsText,
      glossary: glossaryText,
      relationships: relationshipsText,
      plotInfo
    };
  }, [currentProject]);

  // カスタムプロンプトの構築（メモ化）
  // フックのインターフェースに合わせて、オブジェクト形式で受け取る
  const buildCustomPrompt = useCallback((args: {
    currentChapter: { title: string; summary: string };
    chapterDetails: { characters: string; setting: string; mood: string; keyEvents: string };
    projectCharacters: string;
    previousStory: string;
    previousChapterEnd?: string;
    contextInfo?: { worldSettings: string; glossary: string; relationships: string; plotInfo: string };
  }) => {
    const { currentChapter, chapterDetails, projectCharacters, previousStory, previousChapterEnd = '', contextInfo = { worldSettings: '', glossary: '', relationships: '', plotInfo: '' } } = args;
    // 文体設定の取得（プロジェクト設定から、またはデフォルト値）
    const writingStyle = currentProject?.writingStyle || {};
    const style = writingStyle.style || '現代小説風';
    const perspective = writingStyle.perspective || '';
    const formality = writingStyle.formality || '';
    const rhythm = writingStyle.rhythm || '';
    const metaphor = writingStyle.metaphor || '';
    const dialogue = writingStyle.dialogue || '';
    const emotion = writingStyle.emotion || '';
    const tone = writingStyle.tone || '';

    // 文体の詳細指示を構築
    const styleDetailsArray: string[] = [];
    if (perspective || formality || rhythm || metaphor || dialogue || emotion || tone) {
      styleDetailsArray.push('【文体の詳細指示】');
      if (perspective) styleDetailsArray.push(`- **人称**: ${perspective} （一人称 / 三人称 / 神の視点）`);
      if (formality) styleDetailsArray.push(`- **硬軟**: ${formality} （硬め / 柔らかめ / 口語的 / 文語的）`);
      if (rhythm) styleDetailsArray.push(`- **リズム**: ${rhythm} （短文中心 / 長短混合 / 流れるような長文）`);
      if (metaphor) styleDetailsArray.push(`- **比喩表現**: ${metaphor} （多用 / 控えめ / 詩的 / 写実的）`);
      if (dialogue) styleDetailsArray.push(`- **会話比率**: ${dialogue} （会話多め / 描写重視 / バランス型）`);
      if (emotion) styleDetailsArray.push(`- **感情描写**: ${emotion} （内面重視 / 行動で示す / 抑制的）`);
      if (tone) {
        styleDetailsArray.push('');
        styleDetailsArray.push(`【参考となるトーン】`);
        styleDetailsArray.push(`${tone} （緊張感 / 穏やか / 希望 / 切なさ / 謎めいた）`);
      }
    }
    const styleDetails = styleDetailsArray.length > 0 ? styleDetailsArray.join('\n') + '\n' : '';

    // 物語の全体構成を構築
    let plotStructure = '';
    if (currentProject?.plot?.structure === 'kishotenketsu') {
      plotStructure = `起承転結構成\n起: ${currentProject.plot.ki || '未設定'}\n承: ${currentProject.plot.sho || '未設定'}\n転: ${currentProject.plot.ten || '未設定'}\n結: ${currentProject.plot.ketsu || '未設定'}`;
    } else if (currentProject?.plot?.structure === 'three-act') {
      plotStructure = `三幕構成\n第1幕: ${currentProject.plot.act1 || '未設定'}\n第2幕: ${currentProject.plot.act2 || '未設定'}\n第3幕: ${currentProject.plot.act3 || '未設定'}`;
    } else if (currentProject?.plot?.structure === 'four-act') {
      plotStructure = `四幕構成\n第1幕: ${currentProject.plot.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot.fourAct4 || '未設定'}`;
    } else if (currentProject?.plot?.structure === 'heroes-journey') {
      plotStructure = `ヒーローズ・ジャーニー\n日常の世界: ${currentProject.plot.hj1 || '未設定'}\n冒険への誘い: ${currentProject.plot.hj2 || '未設定'}\n境界越え: ${currentProject.plot.hj3 || '未設定'}\n試練と仲間: ${currentProject.plot.hj4 || '未設定'}\n最大の試練: ${currentProject.plot.hj5 || '未設定'}\n報酬: ${currentProject.plot.hj6 || '未設定'}\n帰路: ${currentProject.plot.hj7 || '未設定'}\n復活と帰還: ${currentProject.plot.hj8 || '未設定'}`;
    } else if (currentProject?.plot?.structure === 'beat-sheet') {
      plotStructure = `ビートシート\n導入 (Setup): ${currentProject.plot.bs1 || '未設定'}\n決断 (Break into Two): ${currentProject.plot.bs2 || '未設定'}\n試練 (Fun and Games): ${currentProject.plot.bs3 || '未設定'}\n転換点 (Midpoint): ${currentProject.plot.bs4 || '未設定'}\n危機 (All Is Lost): ${currentProject.plot.bs5 || '未設定'}\nクライマックス (Finale): ${currentProject.plot.bs6 || '未設定'}\n結末 (Final Image): ${currentProject.plot.bs7 || '未設定'}`;
    } else if (currentProject?.plot?.structure === 'mystery-suspense') {
      plotStructure = `ミステリー・サスペンス構成\n発端（事件発生）: ${currentProject.plot.ms1 || '未設定'}\n捜査（初期）: ${currentProject.plot.ms2 || '未設定'}\n仮説とミスリード: ${currentProject.plot.ms3 || '未設定'}\n第二の事件/急展開: ${currentProject.plot.ms4 || '未設定'}\n手がかりの統合: ${currentProject.plot.ms5 || '未設定'}\n解決（真相解明）: ${currentProject.plot.ms6 || '未設定'}\nエピローグ: ${currentProject.plot.ms7 || '未設定'}`;
    } else {
      plotStructure = contextInfo.plotInfo || '未設定';
    }

    const basePrompt = aiService.buildPrompt('draft', 'generateSingle', {
      chapterTitle: currentChapter.title,
      chapterSummary: currentChapter.summary,
      characters: chapterDetails.characters,
      setting: chapterDetails.setting,
      mood: chapterDetails.mood,
      keyEvents: chapterDetails.keyEvents,
      projectTitle: currentProject?.title || '未設定',
      mainGenre: currentProject?.mainGenre || '未設定',
      subGenre: currentProject?.subGenre || '未設定',
      targetReader: currentProject?.targetReader || '未設定',
      previousStory: previousStory || 'これが最初の章です。',
      previousChapterEnd: previousChapterEnd ? `\n【直前の章のラストシーン（接続用）】\n以下の文章は、直前の章の終わりの部分です。この流れを汲んで、自然に接続するように新しい章を書き始めてください。\n---\n${previousChapterEnd}\n---` : '',
      projectCharacters: `${projectCharacters}\n\n【キャラクター相関図】\n${contextInfo.relationships}\n\n【設定資料・世界観】\n${contextInfo.worldSettings}\n\n【重要用語集】\n${contextInfo.glossary}`,
      plotTheme: currentProject?.plot?.theme || '未設定',
      plotSetting: currentProject?.plot?.setting || '未設定',
      plotStructure: plotStructure,
      style: style,
      styleDetails: styleDetails,
      customPrompt: useCustomPrompt && customPrompt.trim() ? `\n\n【カスタム執筆指示】\n${customPrompt}` : '',
    });

    if (useCustomPrompt && customPrompt.trim()) {
      return `${basePrompt}${basePrompt.includes('【カスタム執筆指示】') ? '' : '\n\n【カスタム執筆指示】\n'}${customPrompt}`;
    }
    
    return basePrompt;
  }, [currentProject, useCustomPrompt, customPrompt]);

  // AI生成機能はToolsSidebarのDraftAssistantPanelに移行
  // AIStatusBar用の簡易状態は全章生成フックの後に定義

  // AIログをコピー（DraftStep特有の形式に対応）
  const handleCopyLog = useCallback((log: typeof aiLogs[0]) => {
    const typeLabels: Record<string, string> = {
      generateSingle: '章生成',
      continue: '続き生成',
      suggestions: '提案生成',
    };
    const typeLabel = typeLabels[log.type] || log.type;
    const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.chapterId ? `章ID: ${log.chapterId}\n` : ''}
${log.suggestionType ? `提案タイプ: ${log.suggestionType}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}`;

    navigator.clipboard.writeText(logText);
    setToastMessage('ログをクリップボードにコピーしました');
  }, [setToastMessage]);

  // AIログをダウンロード（DraftStep特有の形式に対応）
  const handleDownloadLogs = useCallback(() => {
    const typeLabels: Record<string, string> = {
      generateSingle: '章生成',
      continue: '続き生成',
      suggestions: '提案生成',
    };
    const logsText = aiLogs.map(log => {
      const typeLabel = typeLabels[log.type] || log.type;
      return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.chapterId ? `章ID: ${log.chapterId}\n` : ''}
${log.suggestionType ? `提案タイプ: ${log.suggestionType}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${'='.repeat(80)}`;
    }).join('\n\n');

    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `draft_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMessage('ログをダウンロードしました');
  }, [aiLogs, setToastMessage]);
  
  // ドロップダウンメニュー用の状態
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  
  const [showCompletionToast, setShowCompletionToast] = useState<string | null>(null);

  const mainEditorRef = useRef<MainEditorHandle | null>(null);
  const historyAutoSaveTimeoutRef = useRef<number | null>(null);
  const lastSnapshotContentRef = useRef<string>('');
  const historyLoadedChaptersRef = useRef<Set<string>>(new Set());
  const verticalPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    historyLoadedChaptersRef.current.clear();
    setChapterHistories({});
    setSelectedHistoryEntryId(null);
  }, [currentProject?.id]);

  const createHistorySnapshot = useCallback(
    async (type: HistoryEntryType, options?: { content?: string; label?: string; force?: boolean }) => {
      if (!currentProject || !selectedChapter) return false;
      const content = options?.content ?? draft;
      const normalizedContent = content ?? '';

      let entryWasAdded = false;
      const label = options?.label || HISTORY_TYPE_LABELS[type] || '履歴';

      // 既存の履歴を確認（重複チェック）
      const previousEntries = chapterHistories[selectedChapter] || [];
      if (!options?.force && previousEntries[0]?.content === normalizedContent) {
        return false;
      }

      try {
        // IndexedDBに保存
        const entryId = await databaseService.saveHistoryEntry(
          currentProject.id,
          selectedChapter,
          {
            content: normalizedContent,
            type,
            label,
          }
        );

        entryWasAdded = true;
        lastSnapshotContentRef.current = normalizedContent;

        // 状態を更新
        const newEntry: ChapterHistoryEntry = {
          id: entryId,
          timestamp: Date.now(),
          content: normalizedContent,
          type,
          label,
        };

        setChapterHistories(prev => {
          const updatedEntries = [newEntry, ...previousEntries].slice(0, HISTORY_MAX_ENTRIES);
          return {
            ...prev,
            [selectedChapter]: updatedEntries,
          };
        });

        if (entryWasAdded) {
          setSelectedHistoryEntryId(entryId);
        }
      } catch (error) {
        console.error('章履歴の保存に失敗しました:', error);
        return false;
      }

      return entryWasAdded;
    },
    [currentProject, selectedChapter, draft, chapterHistories]
  );

  // テキスト選択機能は削除され、AI機能はToolsSidebarに移行

  // 全章生成フック
  const {
    isGeneratingAllChapters,
    generationProgress,
    generationStatus,
    chapterProgressList,
    handleGenerateAllChapters,
    handleCancelAllChaptersGeneration,
  } = useAllChaptersGeneration({
    currentProject,
    settings,
    isConfigured,
    getChapterDetails,
    onError: showError,
    onWarning: showWarning,
    updateProject,
    setChapterDrafts,
    setShowCompletionToast,
  });
  
  // AIStatusBar用の簡易状態（全章生成のみを表示）
  const isGenerating = isGeneratingAllChapters;
  const currentGenerationAction = null;
  const handleCancelGeneration = () => {
    handleCancelAllChaptersGeneration();
  };

  const handleManualHistorySnapshot = useCallback(async () => {
    await createHistorySnapshot('manual', { force: true, label: '手動保存' });
  }, [createHistorySnapshot]);


  // カスタムプロンプトの保存・読み込み
  useEffect(() => {
    if (currentProject) {
      const savedCustomPrompt = localStorage.getItem(`customPrompt_${currentProject.id}`);
      const savedUseCustomPrompt = localStorage.getItem(`useCustomPrompt_${currentProject.id}`);
      
      if (savedCustomPrompt) {
        setCustomPrompt(savedCustomPrompt);
      }
      if (savedUseCustomPrompt === 'true') {
        setUseCustomPrompt(true);
      }
    }
  }, [currentProject]);

  // カスタムプロンプトの保存
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem(`customPrompt_${currentProject.id}`, customPrompt);
      localStorage.setItem(`useCustomPrompt_${currentProject.id}`, useCustomPrompt.toString());
    }
  }, [customPrompt, useCustomPrompt, currentProject]);
  
  useEffect(() => {
    setIsChapterInfoCollapsed(false);
    
    // sessionStorageに保存してDraftAssistantPanelと同期
    if (currentProject && selectedChapter) {
      sessionStorage.setItem(`draftSelectedChapter_${currentProject.id}`, selectedChapter);
      // CustomEventを発火してDraftAssistantPanelに通知
      window.dispatchEvent(new CustomEvent('draftChapterSelected', { detail: { chapterId: selectedChapter, projectId: currentProject.id, source: 'draftStep' } }));
    }
  }, [selectedChapter, currentProject]);
  
  // 初期化時にsessionStorageから読み込む
  useEffect(() => {
    if (currentProject && !selectedChapter && currentProject.chapters.length > 0) {
      const savedChapterId = sessionStorage.getItem(`draftSelectedChapter_${currentProject.id}`);
      if (savedChapterId && currentProject.chapters.some(c => c.id === savedChapterId)) {
        setSelectedChapter(savedChapterId);
      } else if (currentProject.chapters.length > 0) {
        // 保存された章がない場合は最初の章を選択
        setSelectedChapter(currentProject.chapters[0].id);
      }
    }
  }, [currentProject]);
  
  // DraftAssistantPanelからの章選択変更を監視して同期
  useEffect(() => {
    if (!currentProject) return;
    
    const handleChapterSelected = async (e: Event) => {
      const customEvent = e as CustomEvent<{ chapterId: string; projectId: string; source?: string }>;
      // 自分が発火したイベントは無視
      if (customEvent.detail.source === 'draftStep') return;
      
      if (customEvent.detail.projectId === currentProject.id && customEvent.detail.chapterId !== selectedChapter) {
        // 現在の章の内容を保存
        if (selectedChapter) {
          await handleSaveChapterDraftFromHook(selectedChapter, draft);
        }
        // 新しい章を設定
        setSelectedChapter(customEvent.detail.chapterId);
      }
    };
    
    window.addEventListener('draftChapterSelected', handleChapterSelected);
    
    return () => {
      window.removeEventListener('draftChapterSelected', handleChapterSelected);
    };
  }, [currentProject, selectedChapter, draft, handleSaveChapterDraftFromHook]);


  // データ管理側のバックアップ機能を利用
  const handleCreateManualBackup = async () => {
    if (!currentProject) return;
    
    // 現在の草案状態を保存してからバックアップを作成
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }
    
    // バックアップモーダルを表示
    setShowBackupModal(true);
  };

  // バックアップ作成の実行
  const handleConfirmBackup = async (description: string) => {
    if (!currentProject) return;
    
    try {
      await createManualBackup(description);
      setToastMessage('バックアップを作成しました');
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    } catch (error) {
      console.error('バックアップ作成エラー:', error);
      showError('バックアップの作成に失敗しました', 7000, {
        title: 'バックアップエラー',
      });
    }
  };

  // 章の草案管理はuseChapterDraftフックで処理される

  useEffect(() => {
    if (!isModalOpen) return;

    if (selectedChapter && chapterDrafts[selectedChapter] !== undefined) {
      setModalDraft(chapterDrafts[selectedChapter] ?? '');
    } else if (!selectedChapter) {
      setModalDraft('');
    }
  }, [isModalOpen, selectedChapter, chapterDrafts]);

useEffect(() => {
  if (isModalOpen) {
    setModalDraft(draft);
  }
}, [draft, isModalOpen]);


  useEffect(() => {
    if (!currentProject || !selectedChapter) {
      return;
    }

    if (historyLoadedChaptersRef.current.has(selectedChapter)) return;

    // IndexedDBから履歴を読み込む
    const loadHistory = async () => {
      try {
        const entries = await databaseService.getHistoryEntries(
          currentProject.id,
          selectedChapter
        );

        setChapterHistories(prev => ({
          ...prev,
          [selectedChapter]: entries,
        }));

        if (entries[0]) {
          lastSnapshotContentRef.current = entries[0].content;
        } else {
          const fallbackContent =
            currentProject.chapters.find(chapter => chapter.id === selectedChapter)?.draft || '';
          lastSnapshotContentRef.current = fallbackContent;
        }

        historyLoadedChaptersRef.current.add(selectedChapter);
      } catch (error) {
        console.error('章履歴の読み込みに失敗しました:', error);
        // エラー時は空配列を設定
        setChapterHistories(prev => ({
          ...prev,
          [selectedChapter]: [],
        }));
        historyLoadedChaptersRef.current.add(selectedChapter);
      }
    };

    loadHistory();
  }, [currentProject, selectedChapter]);

  useEffect(() => {
    if (!selectedChapter) {
      if (selectedHistoryEntryId !== null) {
        setSelectedHistoryEntryId(null);
      }
      return;
    }

    const entries = chapterHistories[selectedChapter] || [];
    if (!entries.length) {
      if (selectedHistoryEntryId !== null) {
        setSelectedHistoryEntryId(null);
      }
      return;
    }

    const exists = entries.some(entry => entry.id === selectedHistoryEntryId);
    if (!exists) {
      setSelectedHistoryEntryId(entries[0].id);
    }
  }, [chapterHistories, selectedChapter, selectedHistoryEntryId]);

  useEffect(() => {
    if (!selectedChapter) return;
    if (!historyLoadedChaptersRef.current.has(selectedChapter)) return;

    const entries = chapterHistories[selectedChapter] || [];
    if (entries.length === 0) {
      const baseContent =
        currentProject?.chapters.find(chapter => chapter.id === selectedChapter)?.draft || '';
      if (baseContent.trim()) {
        createHistorySnapshot('manual', {
          content: baseContent,
          label: '初期状態',
          force: true,
        }).catch(error => {
          console.error('初期状態の履歴保存エラー:', error);
        });
      }
    }
  }, [chapterHistories, selectedChapter, currentProject, createHistorySnapshot]);

  useEffect(() => {
    if (!currentProject || !selectedChapter) return;

    if (historyAutoSaveTimeoutRef.current) {
      clearTimeout(historyAutoSaveTimeoutRef.current);
      historyAutoSaveTimeoutRef.current = null;
    }

    if (draft === lastSnapshotContentRef.current) return;

    historyAutoSaveTimeoutRef.current = window.setTimeout(() => {
      createHistorySnapshot('auto').catch(error => {
        console.error('自動履歴保存エラー:', error);
      });
      historyAutoSaveTimeoutRef.current = null;
    }, HISTORY_AUTO_SAVE_DELAY);

    return () => {
      if (historyAutoSaveTimeoutRef.current) {
        clearTimeout(historyAutoSaveTimeoutRef.current);
        historyAutoSaveTimeoutRef.current = null;
      }
    };
  }, [draft, currentProject, selectedChapter, createHistorySnapshot]);

  // アンマウント時のクリーンアップは上記のuseEffectのreturnで処理されるため削除

  useEffect(() => {
    if (!selectedChapter) return;
    const entries = chapterHistories[selectedChapter];
    if (entries && entries[0]) {
      lastSnapshotContentRef.current = entries[0].content;
    }
  }, [chapterHistories, selectedChapter]);

  // 章が変更されたときに提案状態をクリア（フック内で処理されるため不要）
  // useEffect(() => {
  //   handleClearSuggestionState();
  // }, [selectedChapter, handleClearSuggestionState]);

  // 章選択ハンドラー
  const handleChapterSelect = async (chapterId: string) => {
    // 章が変更される場合は、進行中の生成をキャンセル
    if (selectedChapter !== chapterId && (isGenerating || isGeneratingAllChapters)) {
      handleCancelAllGeneration();
    }

    // 現在の章の内容を保存（章が選択されている場合）
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }
    
    // 選択された章を設定（草案はuseEffectで適切に初期化される）
    setSelectedChapter(chapterId);
    
    // sessionStorageに保存してDraftAssistantPanelと同期
    if (currentProject) {
      sessionStorage.setItem(`draftSelectedChapter_${currentProject.id}`, chapterId);
      // CustomEventを発火してDraftAssistantPanelに通知
      window.dispatchEvent(new CustomEvent('draftChapterSelected', { detail: { chapterId, projectId: currentProject.id, source: 'draftStep' } }));
    }
  };

  const handleNavigateChapter = useCallback(
    async (direction: 'prev' | 'next') => {
      if (!currentProject || !currentProject.chapters.length) return;

      const chapters = currentProject.chapters;
      const currentIndex = selectedChapter
        ? chapters.findIndex((chapter) => chapter.id === selectedChapter)
        : -1;

      if (currentIndex === -1) {
        const targetChapter = direction === 'next' ? chapters[0] : chapters[chapters.length - 1];
        if (targetChapter) {
          await handleChapterSelect(targetChapter.id);
        }
        return;
      }

      const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= chapters.length) return;

      const targetChapter = chapters[targetIndex];
      if (targetChapter) {
        await handleChapterSelect(targetChapter.id);
      }
    },
    [currentProject, selectedChapter, handleChapterSelect]
  );

  const handlePrevChapter = useCallback(() => {
    handleNavigateChapter('prev');
  }, [handleNavigateChapter]);

  const handleNextChapter = useCallback(() => {
    handleNavigateChapter('next');
  }, [handleNavigateChapter]);

  const mainControlButtonBase = 'rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const mainControlButtonActive = 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700';

  const adjustMainTextareaHeight = useCallback((delta: number) => {
    setMainTextareaHeight(prev => {
      const next = prev + delta;
      if (next < MODAL_TEXTAREA_MIN_HEIGHT) return MODAL_TEXTAREA_MIN_HEIGHT;
      if (next > MODAL_TEXTAREA_MAX_HEIGHT) return MODAL_TEXTAREA_MAX_HEIGHT;
      return next;
    });
  }, []);

  // ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevChapter();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNextChapter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevChapter, handleNextChapter]);

  // ドロップダウンメニューの外側クリックで閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMenuOpen]);

  const currentChapterIndex = useMemo(() => {
    if (!currentProject || !selectedChapter) return -1;
    return currentProject.chapters.findIndex(chapter => chapter.id === selectedChapter);
  }, [currentProject, selectedChapter]);

  // AI生成状態はDraftAssistantPanelで管理されるため、ここでは全章生成のみ

  // AIStatusBar用の状態（全章生成のみを表示）
  const aiStatus = useMemo<{
    tone: AIStatusTone;
    title: string;
    detail?: string;
  } | null>(() => {
    if (isGeneratingAllChapters) {
      const baseDetail =
        generationStatus ||
        (generationProgress.total > 0
          ? `${generationProgress.current} / ${generationProgress.total}章を処理中です`
          : 'AIが章を順番に執筆しています');
      return {
        tone: 'blue',
        title: '全章を生成しています…',
        detail: baseDetail,
      };
    }

    return null;
  }, [
    generationProgress.current,
    generationProgress.total,
    generationStatus,
    isGeneratingAllChapters,
  ]);

  const historyEntries = useMemo(
    () => (selectedChapter ? chapterHistories[selectedChapter] || [] : []),
    [chapterHistories, selectedChapter]
  );

  const selectedHistoryEntry = useMemo(() => {
    if (!selectedChapter || !selectedHistoryEntryId) return null;
    const entries = chapterHistories[selectedChapter] || [];
    return entries.find(entry => entry.id === selectedHistoryEntryId) || null;
  }, [chapterHistories, selectedChapter, selectedHistoryEntryId]);

  const historyDiffSegments = useMemo<Change[]>(() => {
    if (!selectedHistoryEntry) return [];
    return diffLines(selectedHistoryEntry.content ?? '', draft ?? '');
  }, [selectedHistoryEntry, draft]);

  const hasHistoryDiff = useMemo(
    () => historyDiffSegments.some(segment => segment.added || segment.removed),
    [historyDiffSegments]
  );


  // 章草案保存ハンドラー（フックから取得した関数をエイリアス）
  const handleSaveChapterDraft = handleSaveChapterDraftFromHook;

  const handleRestoreHistoryEntry = useCallback(async () => {
    if (!selectedChapter || !selectedHistoryEntry) return;

    if (selectedHistoryEntry.content === draft) return;

    await createHistorySnapshot('restore', {
      content: draft,
      label: '復元前スナップショット',
      force: true,
    });

    const nextContent = selectedHistoryEntry.content;
    setDraft(nextContent);
    setChapterDrafts(prev => ({
      ...prev,
      [selectedChapter]: nextContent,
    }));

    await handleSaveChapterDraft(selectedChapter, nextContent);

    setTimeout(() => {
      const textarea = mainEditorRef.current?.getTextareaRef();
      if (textarea) {
        textarea.focus();
        const cursorPosition = nextContent.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  }, [createHistorySnapshot, draft, handleSaveChapterDraft, selectedChapter, selectedHistoryEntry]);

  const handleDeleteHistoryEntry = useCallback(async (entryId: string) => {
    if (!currentProject || !selectedChapter) return;

    try {
      // IndexedDBから削除
      await databaseService.deleteHistoryEntry(entryId);

      // 状態を更新
      setChapterHistories(prev => {
        const entries = prev[selectedChapter] || [];
        const updatedEntries = entries.filter(e => e.id !== entryId);
        
        // 削除されたエントリが選択されていた場合、選択を解除
        if (selectedHistoryEntryId === entryId) {
          setSelectedHistoryEntryId(null);
        }

        return {
          ...prev,
          [selectedChapter]: updatedEntries,
        };
      });

      setToastMessage('履歴を削除しました');
    } catch (error) {
      console.error('履歴の削除エラー:', error);
      setToastMessage('履歴の削除に失敗しました');
    }
  }, [currentProject, selectedChapter, selectedHistoryEntryId, setToastMessage]);


  // 削除された章の草案データをクリーンアップ（機能停止）
  // const cleanupDeletedChapterDrafts = (project: typeof currentProject) => {
  //   if (!project) return;
  //   
  //   const existingChapterIds = new Set(project.chapters.map(chapter => chapter.id));
  //   const cleanedChapterDrafts = Object.keys(chapterDrafts).reduce((acc, chapterId) => {
  //     // 章が存在する場合のみ保持（空の草案も含む）
  //     if (existingChapterIds.has(chapterId)) {
  //       acc[chapterId] = chapterDrafts[chapterId];
  //     }
  //     return acc;
  //   }, {} as Record<string, string>);
  //   
  //   setChapterDrafts(cleanedChapterDrafts);
  // };

  // 文字数カウント（メモ化）
  const wordCount = useMemo(() => draft.length, [draft]);

  // 全章生成機能はuseAllChaptersGenerationフックに移動済み
  // 以下は削除対象（コメントアウト）
  /*
  const handleGenerateAllChapters = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (!currentProject || currentProject.chapters.length === 0) {
      showWarning('章が設定されていません。章立てステップで章を作成してから実行してください。', 7000, {
        title: '章が設定されていません',
      });
      return;
    }

    // 非ローカルLLM推奨の警告
    if (settings.provider === 'local') {
      const useNonLocal = confirm('全章生成には非ローカルLLM（OpenAI、Anthropic等）の使用を強く推奨します。\n\n理由：\n• 一貫性のある長文生成\n• キャラクター設定の維持\n• 物語の流れの統一\n• 高品質な文章生成\n\n続行しますか？');
      if (!useNonLocal) return;
    }

    // 確認ダイアログ
    const confirmMessage = `全${currentProject.chapters.length}章の草案を一括生成します。\n\n⚠️ 重要な注意事項：\n• 生成には5-15分程度かかる場合があります\n• ネットワーク状況により失敗する可能性があります\n• 既存の章草案は上書きされます\n• 生成中はページを閉じないでください\n\n実行しますか？`;
    if (!confirm(confirmMessage)) return;

    setIsGeneratingAllChapters(true);
    setGenerationProgress({ current: 0, total: currentProject.chapters.length });
    setGenerationStatus('準備中...');
    
    // 章ごとの進捗リストを初期化
    const initialChapterProgress = currentProject.chapters.map(chapter => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      status: 'pending' as const,
    }));
    setChapterProgressList(initialChapterProgress);

    // キャンセル用のAbortControllerを作成
    const abortController = new AbortController();
    generationAbortControllerRef.current = abortController;

    try {
      // プロジェクト全体の情報を整理
      const projectInfo = {
        title: currentProject.title,
        mainGenre: currentProject.mainGenre || '未設定',
        subGenre: currentProject.subGenre || '未設定',
        targetReader: currentProject.targetReader || '未設定',
        projectTheme: currentProject.projectTheme || '未設定'
      };

      // キャラクター情報を整理
      const charactersInfo = currentProject.characters.map((char: { name: string; role: string; appearance: string; personality: string; background: string }) => 
        `【${char.name}】\n役割: ${char.role}\n外見: ${char.appearance}\n性格: ${char.personality}\n背景: ${char.background}`
      ).join('\n\n');

      // プロット情報を整理
      const plotInfo = {
        theme: currentProject.plot?.theme || '未設定',
        setting: currentProject.plot?.setting || '未設定',
        hook: currentProject.plot?.hook || '未設定',
        protagonistGoal: currentProject.plot?.protagonistGoal || '未設定',
        mainObstacle: currentProject.plot?.mainObstacle || '未設定',
        structure: currentProject.plot?.structure || 'kishotenketsu'
      };

      // 物語構造の詳細を取得
      let structureDetails = '';
      if (plotInfo.structure === 'kishotenketsu') {
        structureDetails = `起承転結構造:\n起: ${currentProject.plot?.ki || '未設定'}\n承: ${currentProject.plot?.sho || '未設定'}\n転: ${currentProject.plot?.ten || '未設定'}\n結: ${currentProject.plot?.ketsu || '未設定'}`;
      } else if (plotInfo.structure === 'three-act') {
        structureDetails = `三幕構成:\n第1幕: ${currentProject.plot?.act1 || '未設定'}\n第2幕: ${currentProject.plot?.act2 || '未設定'}\n第3幕: ${currentProject.plot?.act3 || '未設定'}`;
      } else if (plotInfo.structure === 'four-act') {
        structureDetails = `四幕構成:\n第1幕: ${currentProject.plot?.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot?.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot?.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot?.fourAct4 || '未設定'}`;
      }

      // 各章の情報を整理
      const chaptersInfo = currentProject.chapters.map((chapter, index) => {
        const chapterDetails = getChapterDetails(chapter);
        return `【第${index + 1}章: ${chapter.title}】
概要: ${chapter.summary}
登場キャラクター: ${chapterDetails.characters}
設定・場所: ${chapterDetails.setting}
雰囲気: ${chapterDetails.mood}
重要な出来事: ${chapterDetails.keyEvents}`;
      }).join('\n\n');

      // 全章生成用のプロンプトを作成
      const fullPrompt = aiService.buildPrompt('draft', 'generateFull', {
        title: projectInfo.title,
        mainGenre: projectInfo.mainGenre,
        subGenre: projectInfo.subGenre,
        targetReader: projectInfo.targetReader,
        projectTheme: projectInfo.projectTheme,
        plotTheme: plotInfo.theme,
        plotSetting: plotInfo.setting,
        plotHook: plotInfo.hook,
        protagonistGoal: plotInfo.protagonistGoal,
        mainObstacle: plotInfo.mainObstacle,
        structureDetails: structureDetails,
        charactersInfo: charactersInfo,
        chaptersInfo: chaptersInfo,
      });

      setGenerationStatus('AI生成中...（全章の一貫性を保ちながら執筆中）');
      
      // 最初の章を生成中に設定
      if (initialChapterProgress.length > 0) {
        setChapterProgressList(prev => 
          prev.map((ch, idx) => idx === 0 ? { ...ch, status: 'generating' } : ch)
        );
      }
      
      // 全章生成は長時間かかる可能性があるため、タイムアウトを600秒（10分）に設定
      const response = await aiService.generateContent({
        prompt: fullPrompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
        timeout: 600000, // 600秒 = 10分
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
        return;
      }

      if (response && response.content) {
        setGenerationStatus('結果を解析中...');
        
        // 生成された内容を解析して各章に分割
        const content = response.content;
        const chapterSections = content.split(/=== 第\d+章: .+? ===/);
        
        // 最初の要素は空文字列なので削除
        chapterSections.shift();
        
        // 各章の内容を抽出
        const generatedChapters: Record<string, string> = {};
        let chapterIndex = 0;
        
        for (let i = 0; i < currentProject.chapters.length && i < chapterSections.length; i++) {
          const chapter = currentProject.chapters[i];
          const chapterContent = chapterSections[i]?.trim() || '';
          
          // 進捗を更新
          setGenerationProgress({ current: i + 1, total: currentProject.chapters.length });
          setChapterProgressList(prev => 
            prev.map((ch, idx) => {
              if (idx === i) {
                return { ...ch, status: chapterContent ? 'completed' : 'error' };
              }
              if (idx === i + 1 && chapterContent) {
                return { ...ch, status: 'generating' };
              }
              return ch;
            })
          );
          
          if (chapterContent) {
            generatedChapters[chapter.id] = chapterContent;
            chapterIndex++;
          }
        }

        // 章草案を更新
        setChapterDrafts(prev => ({ ...prev, ...generatedChapters }));

        // プロジェクトの章に草案を保存
        const updatedChapters = currentProject.chapters.map(chapter => {
          if (generatedChapters[chapter.id]) {
            return { ...chapter, draft: generatedChapters[chapter.id] };
          }
          return chapter;
        });

        updateProject({ chapters: updatedChapters });

        setGenerationStatus(`完了！${chapterIndex}章の草案を生成しました。各章の内容を確認してください。`);
        
        // 成功メッセージ
        setShowCompletionToast(`全章生成が完了しました（${chapterIndex}/${currentProject.chapters.length}章）`);
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 5000);
        
      } else {
        throw new Error('AI生成に失敗しました');
      }

    } catch (error) {
      console.error('全章生成エラー:', error);
      
      // キャンセルされた場合
      if ((error as Error).name === 'AbortError') {
        setGenerationStatus('キャンセルされました');
        setChapterProgressList(prev => 
          prev.map(ch => ch.status === 'generating' ? { ...ch, status: 'pending' } : ch)
        );
        return;
      }
      
      if ((error as Error).name !== 'AbortError') {
        // エラーが発生した章をマーク
        setChapterProgressList(prev => 
          prev.map(ch => ch.status === 'generating' ? { ...ch, status: 'error' } : ch)
        );
        let errorMessage = '不明なエラーが発生しました';
        let errorDetails = '';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // エラーの種類に応じた詳細メッセージ
          if (error.message.includes('network') || error.message.includes('fetch')) {
            errorDetails = '\n\nネットワークエラーが発生しました。インターネット接続を確認してください。';
          } else if (error.message.includes('timeout')) {
            errorDetails = '\n\nタイムアウトエラーが発生しました。時間をおいて再度お試しください。';
          } else if (error.message.includes('quota') || error.message.includes('limit')) {
            errorDetails = '\n\nAPIの利用制限に達しました。しばらく時間をおいてから再度お試しください。';
          } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
            errorDetails = '\n\nAPIキーが無効です。AI設定でAPIキーを確認してください。';
          } else if (error.message.includes('rate limit')) {
            errorDetails = '\n\nリクエスト制限に達しました。しばらく時間をおいてから再度お試しください。';
          }
        }
        
        const fullErrorMessage = `全章生成中にエラーが発生しました: ${errorMessage}${errorDetails}`;
        const errorDetailsText = '対処方法：\n• ネットワーク接続を確認してください\n• AI設定でAPIキーが正しく設定されているか確認してください\n• しばらく時間をおいてから再度お試しください\n• 問題が続く場合は、個別に章を生成してください';
        
        showError(fullErrorMessage, 10000, {
          title: '全章生成エラー',
          details: errorDetailsText,
        });
        setGenerationStatus('エラーが発生しました');
      }
    } finally {
      setIsGeneratingAllChapters(false);
      setGenerationProgress({ current: 0, total: 0 });
      setChapterProgressList([]);
    }
  };
  */

  // エクスポート機能
  // エクスポートハンドラー（フックから取得した関数を使用）
  const handleExportChapter = useCallback(async () => {
    if (!currentChapter) return;
    await exportChapter(currentChapter.title, draft);
  }, [currentChapter, draft, exportChapter]);

  const handleExportFull = useCallback(async () => {
    await exportFull();
  }, [exportFull]);

  // 自動保存用のタイマー
  const autoSaveTimeoutRef = useRef<number | null>(null);

  // 自動保存タイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, []);

  // アンマウント時の保存処理はuseChapterDraftフック内で処理される

  // モーダル関連
  const handleOpenViewer = () => {
    setModalDraft(draft);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalDraft('');
  };

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (isModalOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCloseModal();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isModalOpen]);

  // 縦書きプレビューのホイールイベント処理（非passiveリスナー）
  useEffect(() => {
    const element = verticalPreviewRef.current;
    if (!element || !isModalOpen || !isVerticalWriting) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      // マウスホイールの回転（deltaY）を横スクロール（scrollLeft）に変換
      // 通常のマウス：下に回す（deltaY > 0）→ 左へスクロール（文章が進む）
      // 縦書き（vertical-rl）の仕様上、スクロール位置は負の値になるブラウザが多い
      // 左へスクロール = scrollLeft を減らす（マイナス方向へ進む）
      element.scrollLeft -= e.deltaY;
      e.preventDefault();
    };

    // 非passiveイベントリスナーとして登録
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [isModalOpen, isVerticalWriting]);

  // 統合されたキャンセル処理（全章生成のキャンセル）
  const handleCancelAllGeneration = useCallback(() => {
    // 全章生成をキャンセル
    handleCancelAllChaptersGeneration();
    
    setToastMessage('生成をキャンセルしました');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, [handleCancelAllChaptersGeneration]);

  // 章全体改善とSelf-RefineはuseAIGenerationフックに移動済み

  // 統合されたAI生成状態
  const unifiedAIStatus = useMemo(() => {
    if (isGeneratingAllChapters) {
      return {
        visible: true,
        title: '全章を生成しています…',
        detail: generationStatus || 
          (generationProgress.total > 0
            ? `${generationProgress.current} / ${generationProgress.total}章を処理中です`
            : 'AIが章を順番に執筆しています'),
        tone: 'blue' as AIStatusTone,
        canCancel: true,
      };
    }
    
    // 個別のAI生成はDraftAssistantPanelで管理されるため、ここでは全章生成のみ
    return { visible: false };
  }, [isGeneratingAllChapters, generationStatus, generationProgress]);

  // プロジェクトが存在しない場合の表示
  if (!currentProject) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          草案作成
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          プロジェクトを作成してから草案作成を開始してください。
        </p>
      </div>
    );
  }

  // 章が存在しない場合の表示
  if (currentProject.chapters.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          草案作成
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-4">
          草案を作成するには、まず章立てを完成させてください。
        </p>
        <div className="text-center">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            「章立て」ステップで章を作成してから戻ってきてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <DraftHeader onBackup={handleCreateManualBackup} />

      {/* 統合AI生成状態バー */}
      <AIStatusBar
        visible={unifiedAIStatus.visible}
        title={unifiedAIStatus.title || ''}
        detail={unifiedAIStatus.detail}
        tone={unifiedAIStatus.tone}
        canCancel={unifiedAIStatus.canCancel}
        onCancel={handleCancelAllGeneration}
      />

      {/* メインコンテンツ */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* メインエディタエリア - サイドバー削除により最大化 */}
          <div className="flex-1 min-w-0 space-y-6 max-w-6xl mx-auto">
            {/* 章選択 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-6">
              <ChapterTabs
                chapters={currentProject.chapters}
                selectedChapterId={selectedChapter}
                chapterDrafts={chapterDrafts}
                onChapterSelect={handleChapterSelect}
                onPrevChapter={handlePrevChapter}
                onNextChapter={handleNextChapter}
                currentChapterIndex={currentChapterIndex}
              />
            </div>

            {/* 章情報と表示設定を統合したアコーディオンパネル */}
            {currentChapter && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsChapterInfoCollapsed(prev => !prev)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Settings className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        章情報と表示設定
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mt-0.5">
                        {currentChapter.title}
                      </p>
                    </div>
                  </div>
                  {isChapterInfoCollapsed ? (
                    <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  )}
                </button>

                {!isChapterInfoCollapsed && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    {/* 章情報セクション */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP']">
                          章情報
                        </h5>
                      </div>
                      <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                        {(() => {
                          if (!currentChapter.summary || !currentProject) {
                            return currentChapter.summary || '';
                          }
                          let summary = currentChapter.summary;
                          currentProject.characters.forEach(character => {
                            const regex = new RegExp(`\\b${character.id}\\b`, 'g');
                            summary = summary.replace(regex, character.name);
                          });
                          return summary;
                        })()}
                      </p>
                      {(() => {
                        const chapterDetails = getChapterDetails(currentChapter);
                        const hasDetails = Object.values(chapterDetails).some(value => value !== '未設定');
                        if (!hasDetails) return null;
                        return (
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              {chapterDetails.characters !== '未設定' && (
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">登場キャラクター:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.characters}</span>
                                </div>
                              )}
                              {chapterDetails.setting !== '未設定' && (
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">設定・場所:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.setting}</span>
                                </div>
                              )}
                              {chapterDetails.mood !== '未設定' && (
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">雰囲気:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.mood}</span>
                                </div>
                              )}
                              {chapterDetails.keyEvents !== '未設定' && (
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">重要な出来事:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.keyEvents}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 表示設定セクション */}
                    <div>
                      <DisplaySettingsPanel
                        mainFontSize={mainFontSize}
                        setMainFontSize={setMainFontSize}
                        mainLineHeight={mainLineHeight}
                        setMainLineHeight={setMainLineHeight}
                        mainTextareaHeight={mainTextareaHeight}
                        adjustMainTextareaHeight={adjustMainTextareaHeight}
                        setMainTextareaHeight={setMainTextareaHeight}
                        handleResetDisplaySettings={() => {
                          setMainFontSize(MODAL_DEFAULT_FONT_SIZE);
                          setMainLineHeight(MODAL_DEFAULT_LINE_HEIGHT);
                          setMainTextareaHeight(MODAL_TEXTAREA_DEFAULT_HEIGHT);
                        }}
                        mainControlButtonBase={mainControlButtonBase}
                        mainControlButtonActive={mainControlButtonActive}
                        isVerticalWriting={isVerticalWriting}
                        setIsVerticalWriting={setIsVerticalWriting}
                        isZenMode={isZenMode}
                        setIsZenMode={setIsZenMode}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <MainEditor
              ref={mainEditorRef}
              selectedChapterId={selectedChapter}
              currentChapter={currentChapter}
              draft={draft}
              onDraftChange={(value) => {
                const newContent = value;
                setDraft(newContent);
                
                // 即座にchapterDraftsを更新（保存はしない）
                if (selectedChapter) {
                  setChapterDrafts(prev => ({
                    ...prev,
                    [selectedChapter]: newContent
                  }));
                  
                  // 自動保存のタイマーを設定（2秒後に保存）
                  if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                  }
                  
                  autoSaveTimeoutRef.current = setTimeout(() => {
                    if (selectedChapter && newContent.trim()) {
                      handleSaveChapterDraft(selectedChapter, newContent, true);
                    }
                  }, 2000);
                }
              }}
              mainFontSize={mainFontSize}
              mainLineHeight={mainLineHeight}
              mainTextareaHeight={mainTextareaHeight}
              wordCount={wordCount}
              lastSavedAt={lastSavedAt}
              selectedChapter={selectedChapter}
              onSave={async () => {
                if (selectedChapter) {
                  await handleSaveChapterDraft(selectedChapter, undefined, false);
                  setToastMessage('保存しました');
                  setTimeout(() => {
                    setToastMessage(null);
                  }, 3000);
                }
              }}
              onOpenViewer={handleOpenViewer}
              onExportChapter={handleExportChapter}
              isVerticalWriting={isVerticalWriting}
              isZenMode={isZenMode}
              onExitZenMode={() => setIsZenMode(false)}
            />

            {/* 伏線パネル */}
            {selectedChapter && !isZenMode && (
              <ForeshadowingPanel
                currentChapterId={selectedChapter}
                onInsertText={(text) => {
                  if (mainEditorRef.current) {
                    mainEditorRef.current.insertText(text);
                  }
                }}
                isCollapsed={isForeshadowingPanelCollapsed}
                onToggleCollapse={() => setIsForeshadowingPanelCollapsed(prev => !prev)}
                currentDraft={draft}
              />
            )}
          </div>

          {/* ワークスペースサイドバーは削除され、AI機能はToolsSidebarに移行 */}
        </div>
      </div>

      {/* カスタムプロンプトモーダル */}
      <CustomPromptModal
        isOpen={showCustomPromptModal}
        customPrompt={customPrompt}
        useCustomPrompt={useCustomPrompt}
        onClose={() => setShowCustomPromptModal(false)}
        onCustomPromptChange={setCustomPrompt}
        onUseCustomPromptChange={setUseCustomPrompt}
        onReset={() => {
          setCustomPrompt('');
          setUseCustomPrompt(false);
        }}
      />

      {/* バックアップ説明モーダル */}
      <BackupDescriptionModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onConfirm={handleConfirmBackup}
        defaultDescription="草案作業時のバックアップ"
      />

      {/* プレビュー／編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* オーバーレイ */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCloseModal}
            />

            {/* モーダルコンテンツ */}
            <div className="relative w-full max-w-7xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
              {/* モーダルヘッダー */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-8 h-8 rounded-full flex items-center justify-center">
                    <PenTool className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {currentChapter ? `${currentChapter.title} の草案プレビュー` : '草案プレビュー'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {modalDraft.length.toLocaleString()} 文字
                      {currentChapter && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          ({currentChapter.title})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsVerticalWriting(!isVerticalWriting)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP'] text-sm"
                  >
                    {isVerticalWriting ? (
                      <>
                        <AlignLeft className="h-4 w-4" />
                        <span>横書き</span>
                      </>
                    ) : (
                      <>
                        <AlignJustify className="h-4 w-4" />
                        <span>縦書き</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* モーダルボディ */}
              <div className="p-4">
                {/* 章内容表示 */}
                {currentChapter && (
                  <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                    {/* アコーディオンヘッダー */}
                    <button
                      onClick={() => setIsModalChapterInfoCollapsed(!isModalChapterInfoCollapsed)}
                      className="w-full p-4 flex items-start space-x-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP'] ${!isModalChapterInfoCollapsed ? 'mb-2' : ''}`}>
                            {currentChapter.title}
                          </h4>
                          {isModalChapterInfoCollapsed ? (
                            <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                          )}
                        </div>
                        {!isModalChapterInfoCollapsed && (
                          <>
                            <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                              {(() => {
                                // 章の説明内のキャラクターIDをキャラクター名に変換
                                if (!currentChapter.summary || !currentProject) {
                                  return currentChapter.summary || '';
                                }
                                let summary = currentChapter.summary;
                                // プロジェクト内のすべてのキャラクターIDをキャラクター名に置換
                                currentProject.characters.forEach(character => {
                                  // キャラクターIDがテキスト内に含まれている場合、キャラクター名に置換
                                  // 単語境界を考慮して置換（IDが単独で出現する場合のみ）
                                  const regex = new RegExp(`\\b${character.id}\\b`, 'g');
                                  summary = summary.replace(regex, character.name);
                                });
                                return summary;
                              })()}
                            </p>

                            {/* 章詳細情報 */}
                            {(() => {
                              const chapterDetails = getChapterDetails(currentChapter);
                              const hasDetails = Object.values(chapterDetails).some(value => value !== '未設定');

                              if (!hasDetails) return null;

                              return (
                                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    {chapterDetails.characters !== '未設定' && (
                                      <div>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">登場キャラクター:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.characters}</span>
                                      </div>
                                    )}
                                    {chapterDetails.setting !== '未設定' && (
                                      <div>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">設定・場所:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.setting}</span>
                                      </div>
                                    )}
                                    {chapterDetails.mood !== '未設定' && (
                                      <div>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">雰囲気:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.mood}</span>
                                      </div>
                                    )}
                                    {chapterDetails.keyEvents !== '未設定' && (
                                      <div className="sm:col-span-2">
                                        <span className="font-medium text-blue-700 dark:text-blue-300">重要な出来事:</span>
                                        <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.keyEvents}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {/* テキストエリア（読み取り専用） */}
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  <div
                    ref={verticalPreviewRef}
                    className={`${isVerticalWriting ? 'h-[600px] font-serif-jp' : 'h-[400px] font-[\'Noto_Sans_JP\']'} w-full p-4 border-0 rounded-lg bg-transparent text-gray-900 dark:text-white leading-relaxed overflow-auto whitespace-pre-wrap`}
                    style={{
                      lineHeight: isVerticalWriting ? '2.0' : '1.8',
                      letterSpacing: isVerticalWriting ? '0.05em' : 'normal',
                      writingMode: isVerticalWriting ? 'vertical-rl' : 'horizontal-tb',
                      textOrientation: isVerticalWriting ? 'upright' : 'mixed',
                    }}
                  >
                    {modalDraft || (
                      <div className="text-gray-400 dark:text-gray-500 italic">
                        草案がまだ作成されていません。メインエディタで執筆を開始してください。
                      </div>
                    )}
                  </div>
                </div>

                {/* モーダルフッター */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    文字数: {modalDraft.length.toLocaleString()}
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-['Noto_Sans_JP']"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 改善ログモーダル */}
      <ImprovementLogModal
        isOpen={isImprovementLogModalOpen}
        chapterTitle={currentChapter?.title || null}
        logs={selectedChapter && improvementLogs[selectedChapter] ? improvementLogs[selectedChapter] : []}
        selectedLogId={selectedImprovementLogId}
        onClose={() => setIsImprovementLogModalOpen(false)}
        onSelectLog={setSelectedImprovementLogId}
      />

      {/* トースト通知 */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* 生成完了通知 */}
      {showCompletionToast && (
        <Toast
          message={showCompletionToast}
          type="info"
          onClose={() => setShowCompletionToast(null)}
        />
      )}
    </div>
  );
};