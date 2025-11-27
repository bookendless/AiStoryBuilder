import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles, Check, Play, Zap, Target, Heart, RotateCcw, Loader2, Layers, ChevronDown, ChevronUp, Copy, Trash2, AlertCircle, Undo2, Redo2, MoreVertical, Clock, GripVertical, Download, FileText } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';
import { useAutoSave } from '../common/hooks/useAutoSave';
import { AILogPanel } from '../common/AILogPanel';

type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'export';

interface PlotStep2Props {
  onNavigateToStep?: (step: Step) => void;
}

// 履歴管理用の型定義
interface HistoryState {
  formData: {
    ki: string;
    sho: string;
    ten: string;
    ketsu: string;
    act1: string;
    act2: string;
    act3: string;
    fourAct1: string;
    fourAct2: string;
    fourAct3: string;
    fourAct4: string;
  };
  plotStructure: 'kishotenketsu' | 'three-act' | 'four-act';
  timestamp: number;
}

export const PlotStep2: React.FC<PlotStep2Props> = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showSuccess, showWarning } = useToast();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [plotStructure, setPlotStructure] = useState<'kishotenketsu' | 'three-act' | 'four-act'>('kishotenketsu');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // AIログ管理
  const { aiLogs, addLog } = useAILog();

  const [formData, setFormData] = useState({
    ki: currentProject?.plot?.ki || '',
    sho: currentProject?.plot?.sho || '',
    ten: currentProject?.plot?.ten || '',
    ketsu: currentProject?.plot?.ketsu || '',
    act1: currentProject?.plot?.act1 || '',
    act2: currentProject?.plot?.act2 || '',
    act3: currentProject?.plot?.act3 || '',
    fourAct1: currentProject?.plot?.fourAct1 || '',
    fourAct2: currentProject?.plot?.fourAct2 || '',
    fourAct3: currentProject?.plot?.fourAct3 || '',
    fourAct4: currentProject?.plot?.fourAct4 || '',
  });

  // 自動保存用の統合データ
  const saveData = useMemo(() => ({
    formData,
    plotStructure,
  }), [formData, plotStructure]);

  // 自動保存
  const { isSaving, saveStatus, lastSaved } = useAutoSave(
    saveData,
    async (value: typeof saveData) => {
      if (!currentProject) return;
      const updatedPlot = {
        ...currentProject.plot,
        structure: value.plotStructure,
      };

      if (value.plotStructure === 'kishotenketsu') {
        updatedPlot.ki = value.formData.ki;
        updatedPlot.sho = value.formData.sho;
        updatedPlot.ten = value.formData.ten;
        updatedPlot.ketsu = value.formData.ketsu;
      } else if (value.plotStructure === 'three-act') {
        updatedPlot.act1 = value.formData.act1;
        updatedPlot.act2 = value.formData.act2;
        updatedPlot.act3 = value.formData.act3;
      } else if (value.plotStructure === 'four-act') {
        updatedPlot.fourAct1 = value.formData.fourAct1;
        updatedPlot.fourAct2 = value.formData.fourAct2;
        updatedPlot.fourAct3 = value.formData.fourAct3;
        updatedPlot.fourAct4 = value.formData.fourAct4;
      }

      await updateProject({ plot: updatedPlot }, false);
    }
  );

  // 折りたたみ状態管理
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // サイドバーセクションの折りたたみ状態と順序管理
  const [sidebarSections, setSidebarSections] = useState([
    { id: 'guide', title: '構成スタイルガイド', collapsed: true },
    { id: 'settings', title: 'プロット基礎設定', collapsed: true },
    { id: 'assistant', title: 'AI提案アシスタント', collapsed: true },
    { id: 'progress', title: '完成度', collapsed: true },
    { id: 'aiLogs', title: 'AIログ', collapsed: true },
  ]);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  // サイドバーセクションの折りたたみ切り替え
  const toggleSidebarSection = useCallback((sectionId: string) => {
    setSidebarSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, collapsed: !section.collapsed }
          : section
      )
    );
  }, []);

  // ドラッグ開始
  const handleDragStart = useCallback((e: React.DragEvent, sectionId: string) => {
    setDraggedSectionId(sectionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', sectionId);
  }, []);

  // ドラッグオーバー
  const handleDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSectionId !== null && draggedSectionId !== sectionId) {
      setDragOverSectionId(sectionId);
    }
  }, [draggedSectionId]);

  // ドラッグ離脱
  const handleDragLeave = useCallback(() => {
    setDragOverSectionId(null);
  }, []);

  // ドロップ
  const handleDrop = useCallback((e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();

    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    setSidebarSections(prev => {
      const newSections = [...prev];
      const draggedIndex = newSections.findIndex(s => s.id === draggedSectionId);
      const targetIndex = newSections.findIndex(s => s.id === targetSectionId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const [removed] = newSections.splice(draggedIndex, 1);
      newSections.splice(targetIndex, 0, removed);

      return newSections;
    });

    setDraggedSectionId(null);
    setDragOverSectionId(null);
    showSuccess('サイドバー項目の並び順を変更しました');
  }, [draggedSectionId, showSuccess]);

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    setDraggedSectionId(null);
    setDragOverSectionId(null);
  }, []);


  // 一貫性チェック結果
  const [consistencyCheck, setConsistencyCheck] = useState<{
    hasIssues: boolean;
    issues: string[];
  } | null>(null);

  // 履歴管理
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef(-1);
  const maxHistorySize = 50;

  // 履歴に状態を保存
  const saveToHistory = useCallback((data: typeof formData, structure: typeof plotStructure) => {
    const newState: HistoryState = {
      formData: { ...data },
      plotStructure: structure,
      timestamp: Date.now(),
    };

    // 現在の位置より後ろの履歴を削除（分岐した履歴を削除）
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // 新しい状態を追加
    historyRef.current.push(newState);

    // 履歴サイズ制限
    if (historyRef.current.length > maxHistorySize) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
  }, [maxHistorySize]);

  // Undo機能
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const previousState = historyRef.current[historyIndexRef.current];
      setFormData(previousState.formData);
      setPlotStructure(previousState.plotStructure);
    }
  }, []);

  // Redo機能
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      setFormData(nextState.formData);
      setPlotStructure(nextState.plotStructure);
    }
  }, []);

  // 初期状態を履歴に保存
  useEffect(() => {
    if (currentProject) {
      const initialState: HistoryState = {
        formData: {
          ki: currentProject.plot?.ki || '',
          sho: currentProject.plot?.sho || '',
          ten: currentProject.plot?.ten || '',
          ketsu: currentProject.plot?.ketsu || '',
          act1: currentProject.plot?.act1 || '',
          act2: currentProject.plot?.act2 || '',
          act3: currentProject.plot?.act3 || '',
          fourAct1: currentProject.plot?.fourAct1 || '',
          fourAct2: currentProject.plot?.fourAct2 || '',
          fourAct3: currentProject.plot?.fourAct3 || '',
          fourAct4: currentProject.plot?.fourAct4 || '',
        },
        plotStructure: currentProject.plot?.structure || 'kishotenketsu',
        timestamp: Date.now(),
      };
      historyRef.current = [initialState];
      historyIndexRef.current = 0;
    }
  }, [currentProject?.id]); // プロジェクトIDが変わったときのみ初期化

  // プロジェクトが変更されたときにformDataを更新
  useEffect(() => {
    if (currentProject) {
      setFormData({
        ki: currentProject.plot?.ki || '',
        sho: currentProject.plot?.sho || '',
        ten: currentProject.plot?.ten || '',
        ketsu: currentProject.plot?.ketsu || '',
        act1: currentProject.plot?.act1 || '',
        act2: currentProject.plot?.act2 || '',
        act3: currentProject.plot?.act3 || '',
        fourAct1: currentProject.plot?.fourAct1 || '',
        fourAct2: currentProject.plot?.fourAct2 || '',
        fourAct3: currentProject.plot?.fourAct3 || '',
        fourAct4: currentProject.plot?.fourAct4 || '',
      });
      // 構成スタイルも更新
      if (currentProject.plot?.structure) {
        setPlotStructure(currentProject.plot.structure);
      }
    }
  }, [currentProject]);

  // formData変更時に履歴に保存（デバウンス付き）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (historyRef.current.length > 0) {
        // 現在の状態と最後の履歴を比較して、変更がある場合のみ保存
        const lastState = historyRef.current[historyIndexRef.current];
        const hasChanged =
          JSON.stringify(formData) !== JSON.stringify(lastState.formData) ||
          plotStructure !== lastState.plotStructure;

        if (hasChanged) {
          saveToHistory(formData, plotStructure);
        }
      }
    }, 1000); // 1秒後に履歴に保存

    return () => clearTimeout(timeoutId);
  }, [formData, plotStructure, saveToHistory]);

  // 折りたたみ機能
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // メニュー外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // AIログをコピー（PlotStep2特有の形式に対応）
  const handleCopyLog = useCallback((log: typeof aiLogs[0]) => {
    const typeLabels: Record<string, string> = {
      supplement: '補完',
      consistency: '一貫性チェック',
      generateStructure: '構造生成',
    };
    const typeLabel = typeLabels[log.type] || log.type;
    const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.fieldLabel ? `フィールド: ${log.fieldLabel}\n` : ''}
${log.structureType ? `構造タイプ: ${log.structureType}\n` : ''}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}`;

    navigator.clipboard.writeText(logText);
    showSuccess('ログをクリップボードにコピーしました');
  }, [showSuccess]);

  // AIログをダウンロード（PlotStep2特有の形式に対応）
  const handleDownloadLogs = useCallback(() => {
    const typeLabels: Record<string, string> = {
      supplement: '補完',
      consistency: '一貫性チェック',
      generateStructure: '構造生成',
    };
    const logsText = aiLogs.map(log => {
      const typeLabel = typeLabels[log.type] || log.type;
      return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}
${log.fieldLabel ? `フィールド: ${log.fieldLabel}\n` : ''}
${log.structureType ? `構造タイプ: ${log.structureType}\n` : ''}

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
    a.download = `plot_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('ログをダウンロードしました');
  }, [aiLogs, showSuccess]);




  // 文字数に応じた色を取得
  const getCharacterCountColor = useCallback((count: number, max: number) => {
    if (count > max) return 'text-red-500 dark:text-red-400';
    if (count > max * 0.9) return 'text-orange-500 dark:text-orange-400';
    if (count > max * 0.8) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-gray-500 dark:text-gray-400';
  }, []);

  // 文字数に応じたプログレスバーの色を取得
  const getProgressBarColor = useCallback((count: number, max: number) => {
    if (count > max) return 'bg-red-500';
    if (count > max * 0.9) return 'bg-orange-500';
    if (count > max * 0.8) return 'bg-yellow-500';
    return 'bg-blue-500';
  }, []);

  // クイックアクション：コピー
  const handleCopy = useCallback((fieldKey: keyof typeof formData) => {
    const text = formData[fieldKey];
    if (text) {
      navigator.clipboard.writeText(text);
      showSuccess('クリップボードにコピーしました');
      setOpenMenuId(null);
    } else {
      showWarning('コピーする内容がありません');
    }
  }, [formData, showSuccess, showWarning]);

  // クイックアクション：クリア
  const handleClear = useCallback((fieldKey: keyof typeof formData) => {
    if (confirm('このセクションの内容をクリアしますか？')) {
      setFormData(prev => ({ ...prev, [fieldKey]: '' }));
      showSuccess('セクションをクリアしました');
      setOpenMenuId(null);
    }
  }, [showSuccess]);

  // クイックアクション：AI補完
  const handleAISupplement = useCallback(async (fieldKey: keyof typeof formData, fieldLabel: string) => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setIsGenerating(`supplement-${fieldKey}`);

    try {
      const context = getProjectContext();
      if (!context) {
        alert('プロジェクト情報が見つかりません。');
        return;
      }

      const currentText = formData[fieldKey];
      const prompt = aiService.buildPrompt('plot', 'supplement', {
        fieldLabel: fieldLabel,
        title: context.title,
        mainGenre: context.mainGenre || context.genre,
        projectTheme: context.projectTheme,
        plotTheme: currentProject?.plot?.theme || '未設定',
        plotSetting: currentProject?.plot?.setting || '未設定',
        protagonistGoal: currentProject?.plot?.protagonistGoal || '未設定',
        currentText: currentText || '未記入',
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'plot',
        settings,
      });

      // AIログに記録
      addLog({
        type: 'supplement',
        prompt,
        response: response.content || '',
        error: response.error,
        fieldLabel: fieldLabel,
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}`);
        return;
      }

      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const improvedText = parsed[fieldLabel] || currentText;
          setFormData(prev => ({ ...prev, [fieldKey]: improvedText }));
        } catch (error) {
          console.error('JSON解析エラー:', error);
          alert('AI出力の解析に失敗しました。');
        }
      }
    } catch (error) {
      console.error('AI補完エラー:', error);
      alert('AI補完中にエラーが発生しました。');
    } finally {
      setIsGenerating(null);
    }
  }, [isConfigured, formData, currentProject, settings]);

  // 一貫性チェック機能
  const checkConsistency = useCallback(async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setIsGenerating('consistency');

    try {
      const context = getProjectContext();
      if (!context) {
        alert('プロジェクト情報が見つかりません。');
        return;
      }

      const structureFields = plotStructure === 'kishotenketsu'
        ? [
          { key: 'ki', label: '起', value: formData.ki },
          { key: 'sho', label: '承', value: formData.sho },
          { key: 'ten', label: '転', value: formData.ten },
          { key: 'ketsu', label: '結', value: formData.ketsu },
        ]
        : plotStructure === 'three-act'
          ? [
            { key: 'act1', label: '第1幕', value: formData.act1 },
            { key: 'act2', label: '第2幕', value: formData.act2 },
            { key: 'act3', label: '第3幕', value: formData.act3 },
          ]
          : [
            { key: 'fourAct1', label: '第1幕', value: formData.fourAct1 },
            { key: 'fourAct2', label: '第2幕', value: formData.fourAct2 },
            { key: 'fourAct3', label: '第3幕', value: formData.fourAct3 },
            { key: 'fourAct4', label: '第4幕', value: formData.fourAct4 },
          ];

      const structureText = structureFields.map(f => `${f.label}: ${f.value}`).join('\n\n');

      const prompt = aiService.buildPrompt('plot', 'consistency', {
        title: context.title,
        mainGenre: context.mainGenre || context.genre,
        projectTheme: context.projectTheme,
        plotTheme: currentProject?.plot?.theme || '未設定',
        plotSetting: currentProject?.plot?.setting || '未設定',
        protagonistGoal: currentProject?.plot?.protagonistGoal || '未設定',
        mainObstacle: currentProject?.plot?.mainObstacle || '未設定',
        structureText: structureText,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'plot',
        settings,
      });

      // AIログに記録
      addLog({
        type: 'consistency',
        prompt,
        response: response.content || '',
        error: response.error,
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}`);
        return;
      }

      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          setConsistencyCheck({
            hasIssues: parsed.hasIssues || false,
            issues: parsed.issues || [],
          });
        } catch (error) {
          console.error('JSON解析エラー:', error);
          alert('AI出力の解析に失敗しました。');
        }
      }
    } catch (error) {
      console.error('一貫性チェックエラー:', error);
      alert('一貫性チェック中にエラーが発生しました。');
    } finally {
      setIsGenerating(null);
    }
  }, [isConfigured, formData, plotStructure, currentProject, settings]);

  // 手動保存（即座に保存し、他の構成のデータをクリア）
  const handleManualSave = useCallback(async () => {
    if (!currentProject) return;

    const updatedPlot = {
      ...currentProject.plot,
      structure: plotStructure,
    };

    if (plotStructure === 'kishotenketsu') {
      updatedPlot.ki = formData.ki;
      updatedPlot.sho = formData.sho;
      updatedPlot.ten = formData.ten;
      updatedPlot.ketsu = formData.ketsu;
      // 他の構成のデータはクリア
      updatedPlot.act1 = '';
      updatedPlot.act2 = '';
      updatedPlot.act3 = '';
      updatedPlot.fourAct1 = '';
      updatedPlot.fourAct2 = '';
      updatedPlot.fourAct3 = '';
      updatedPlot.fourAct4 = '';
    } else if (plotStructure === 'three-act') {
      updatedPlot.act1 = formData.act1;
      updatedPlot.act2 = formData.act2;
      updatedPlot.act3 = formData.act3;
      // 他の構成のデータはクリア
      updatedPlot.ki = '';
      updatedPlot.sho = '';
      updatedPlot.ten = '';
      updatedPlot.ketsu = '';
      updatedPlot.fourAct1 = '';
      updatedPlot.fourAct2 = '';
      updatedPlot.fourAct3 = '';
      updatedPlot.fourAct4 = '';
    } else if (plotStructure === 'four-act') {
      updatedPlot.fourAct1 = formData.fourAct1;
      updatedPlot.fourAct2 = formData.fourAct2;
      updatedPlot.fourAct3 = formData.fourAct3;
      updatedPlot.fourAct4 = formData.fourAct4;
      // 他の構成のデータはクリア
      updatedPlot.ki = '';
      updatedPlot.sho = '';
      updatedPlot.ten = '';
      updatedPlot.ketsu = '';
      updatedPlot.act1 = '';
      updatedPlot.act2 = '';
      updatedPlot.act3 = '';
    }

    // 即座に保存
    await updateProject({ plot: updatedPlot }, true);
    showSuccess('保存しました');
  }, [currentProject, updateProject, formData, plotStructure, showSuccess]);

  // プロット構成部分のみをリセット
  const handleResetPlotStructure = () => {
    const structureName = plotStructure === 'kishotenketsu' ? '起承転結' :
      plotStructure === 'three-act' ? '三幕構成' : '四幕構成';
    if (confirm(`${structureName}の内容をすべてリセットしますか？`)) {
      if (plotStructure === 'kishotenketsu') {
        setFormData(prev => ({
          ...prev,
          ki: '',
          sho: '',
          ten: '',
          ketsu: ''
        }));
      } else if (plotStructure === 'three-act') {
        setFormData(prev => ({
          ...prev,
          act1: '',
          act2: '',
          act3: ''
        }));
      } else if (plotStructure === 'four-act') {
        setFormData(prev => ({
          ...prev,
          fourAct1: '',
          fourAct2: '',
          fourAct3: '',
          fourAct4: ''
        }));
      }
    }
  };


  // プロット構成専用のAI生成関数
  const handleStructureAIGenerate = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setIsGenerating('structure');

    try {
      // プロジェクトの詳細情報を取得
      const context = getProjectContext();
      if (!context) {
        alert('プロジェクト情報が見つかりません。');
        return;
      }

      // キャラクター情報の文字列化
      const charactersInfo = context.characters.length > 0
        ? context.characters.map(c => `・${c.name} (${c.role})\n  性格: ${c.personality}\n  背景: ${c.background}`).join('\n')
        : 'キャラクター未設定';


      // 構成スタイルに応じたプロンプト変数の構築
      const ending = currentProject?.plot?.ending ? `物語の結末: ${currentProject.plot.ending}` : '';
      const reversePrompting = currentProject?.plot?.ending 
        ? `【逆算プロンプティング（Goal-Oriented Prompting）】
上記の「物語の結末」から逆算して、その結末に至るための物語構成を構築してください。
結末を目標として、そこに到達するための{structureType}の各段階を設計してください。
結末に自然に繋がるように、各段階で必要な要素や展開を配置してください。`
        : '【重要】上記のプロット基礎設定を必ず反映し、一貫性のある物語構成を提案してください。';

      let structureType = '';
      let structureDescription = '';
      let outputFormat = '';

      if (plotStructure === 'kishotenketsu') {
        structureType = '起承転結';
        structureDescription = `起承転結の構成について：
- 起：物語の始まり、登場人物の紹介、日常の描写、事件の発端
- 承：事件の発展、状況の変化、新たな登場人物、問題の詳細化
- 転：大きな転換点、予想外の展開、クライマックス、物語の核心
- 結：問題の解決、物語の終結、キャラクターの成長、新たな始まり`;
        outputFormat = `{
  "起（導入）": "起（導入）を500文字以内で記述",
  "承（展開）": "承（展開）を500文字以内で記述",
  "転（転換）": "転（転換）を500文字以内で記述",
  "結（結末）": "結（結末）を500文字以内で記述"
}`;
      } else if (plotStructure === 'three-act') {
        structureType = '三幕構成';
        structureDescription = `三幕構成について：
- 第1幕：導入、設定、事件の発端、登場人物の紹介、世界観の設定
- 第2幕：展開、対立の激化、主人公の試練、クライマックスへの準備、物語の核心部分
- 第3幕：クライマックス、問題の解決、物語の結末、キャラクターの成長、最終的な解決`;
        outputFormat = `{
  "第1幕（導入）": "第1幕を500文字以内で記述",
  "第2幕（展開）": "第2幕を500文字以内で記述",
  "第3幕（結末）": "第3幕を500文字以内で記述"
}`;
      } else if (plotStructure === 'four-act') {
        structureType = '四幕構成';
        structureDescription = `四幕構成（ダン・ハーモンの秩序と混沌の対比）について：
- 第1幕（秩序）：日常の確立、キャラクター紹介、世界観の設定、平穏な状態
- 第2幕（混沌）：問題の発生、状況の悪化、困難の増大、秩序の崩壊
- 第3幕（秩序）：解決への取り組み、希望の光、状況の改善、秩序の回復への努力
- 第4幕（混沌）：最終的な試練、真の解決、物語の結末、新しい秩序の確立`;
        outputFormat = `{
  "第1幕（秩序）": "第1幕（秩序）を500文字以内で記述",
  "第2幕（混沌）": "第2幕（混沌）を500文字以内で記述",
  "第3幕（秩序）": "第3幕（秩序）を500文字以内で記述",
  "第4幕（混沌）": "第4幕（混沌）を500文字以内で記述"
}`;
      }

      const prompt = aiService.buildPrompt('plot', 'generateStructure', {
        structureType: structureType,
        title: context.title,
        mainGenre: context.mainGenre || context.genre,
        subGenre: context.subGenre || '未設定',
        projectTheme: context.projectTheme,
        charactersInfo: charactersInfo,
        plotTheme: currentProject?.plot?.theme || '未設定',
        plotSetting: currentProject?.plot?.setting || '未設定',
        plotHook: currentProject?.plot?.hook || '未設定',
        protagonistGoal: currentProject?.plot?.protagonistGoal || '未設定',
        mainObstacle: currentProject?.plot?.mainObstacle || '未設定',
        ending: ending,
        reversePrompting: reversePrompting.replace('{structureType}', structureType),
        structureDescription: structureDescription,
        outputFormat: outputFormat,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'plot',
        settings,
      });

      // AIログに記録
      addLog({
        type: 'generateStructure',
        prompt,
        response: response.content || '',
        error: response.error,
        structureType: structureType,
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}`);
        return;
      }

      // 簡易的なJSON解析
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);

          // フォームデータを更新（構成スタイルに応じて）
          if (plotStructure === 'kishotenketsu') {
            setFormData(prev => ({
              ...prev,
              ki: parsed['起（導入）'] || prev.ki,
              sho: parsed['承（展開）'] || prev.sho,
              ten: parsed['転（転換）'] || prev.ten,
              ketsu: parsed['結（結末）'] || prev.ketsu,
            }));
          } else if (plotStructure === 'three-act') {
            setFormData(prev => ({
              ...prev,
              act1: parsed['第1幕（導入）'] || prev.act1,
              act2: parsed['第2幕（展開）'] || prev.act2,
              act3: parsed['第3幕（結末）'] || prev.act3,
            }));
          } else if (plotStructure === 'four-act') {
            setFormData(prev => ({
              ...prev,
              fourAct1: parsed['第1幕（秩序）'] || prev.fourAct1,
              fourAct2: parsed['第2幕（混沌）'] || prev.fourAct2,
              fourAct3: parsed['第3幕（秩序）'] || prev.fourAct3,
              fourAct4: parsed['第4幕（混沌）'] || prev.fourAct4,
            }));
          }
        } catch (error) {
          console.error('JSON解析エラー:', error);
          alert('AI出力の解析に失敗しました。');
        }
      } else {
        alert('AI出力の形式が正しくありません。');
      }

    } catch (error) {
      console.error('AI生成エラー:', error);
      alert('AI生成中にエラーが発生しました。');
    } finally {
      setIsGenerating(null);
    }
  };

  // プロジェクトの詳細情報を取得する関数
  const getProjectContext = () => {
    if (!currentProject) return null;

    return {
      title: currentProject.title,
      description: currentProject.description,
      genre: currentProject.genre || '一般小説',
      mainGenre: currentProject.mainGenre || currentProject.genre || '一般小説',
      subGenre: currentProject.subGenre || '未設定',
      targetReader: currentProject.targetReader || '全年齢',
      projectTheme: currentProject.projectTheme || '成長・自己発見',
      characters: currentProject.characters.map(c => ({
        name: c.name,
        role: c.role,
        personality: c.personality,
        background: c.background
      }))
    };
  };

  // 最終保存時刻の表示
  const getLastSavedText = useCallback(() => {
    if (!lastSaved) return '未保存';

    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

    if (diff < 10) return '数秒前に保存';
    if (diff < 60) return `${diff}秒前に保存`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分前に保存`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前に保存`;
    return lastSaved.toLocaleDateString('ja-JP');
  }, [lastSaved]);

  // 文字数が制限を超えているかチェック
  const isOverLimit = useCallback((fieldKey: keyof typeof formData, limit: number = 500) => {
    return formData[fieldKey].length > limit;
  }, [formData]);

  // 任意のフィールドが制限超過しているかチェック
  const hasAnyOverLimit = useCallback(() => {
    const fieldsToCheck = plotStructure === 'kishotenketsu'
      ? ['ki', 'sho', 'ten', 'ketsu']
      : plotStructure === 'three-act'
        ? ['act1', 'act2', 'act3']
        : ['fourAct1', 'fourAct2', 'fourAct3', 'fourAct4'];

    return fieldsToCheck.some(field => isOverLimit(field as keyof typeof formData));
  }, [plotStructure, isOverLimit]);

  // プロット構成完成度を計算する関数
  const calculateStructureProgress = () => {
    const structureFields = plotStructure === 'kishotenketsu'
      ? [
        { key: 'ki', label: '起 - 導入', value: formData.ki },
        { key: 'sho', label: '承 - 展開', value: formData.sho },
        { key: 'ten', label: '転 - 転換', value: formData.ten },
        { key: 'ketsu', label: '結 - 結末', value: formData.ketsu },
      ]
      : plotStructure === 'three-act'
        ? [
          { key: 'act1', label: '第1幕 - 導入', value: formData.act1 },
          { key: 'act2', label: '第2幕 - 展開', value: formData.act2 },
          { key: 'act3', label: '第3幕 - 結末', value: formData.act3 },
        ]
        : [
          { key: 'fourAct1', label: '第1幕 - 秩序', value: formData.fourAct1 },
          { key: 'fourAct2', label: '第2幕 - 混沌', value: formData.fourAct2 },
          { key: 'fourAct3', label: '第3幕 - 秩序', value: formData.fourAct3 },
          { key: 'fourAct4', label: '第4幕 - 混沌', value: formData.fourAct4 },
        ];

    const completedFields = structureFields.filter(field => field.value.trim().length > 0);
    const progressPercentage = (completedFields.length / structureFields.length) * 100;

    return {
      completed: completedFields.length,
      total: structureFields.length,
      percentage: progressPercentage,
      fields: structureFields.map(field => ({
        ...field,
        completed: field.value.trim().length > 0
      }))
    };
  };

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            プロット構成の詳細
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          物語の展開を詳細に設計しましょう。AIが一貫性のある物語構成を提案します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* プロット構成の詳細セクション */}
          <div className="space-y-6">
            {/* ヘッダー部分 */}
            <div className="space-y-4">
              {/* 1段目: タイトルと自動保存表示 */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  プロット構成の詳細
                </h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span className="font-['Noto_Sans_JP']">{getLastSavedText()}</span>
                </div>
              </div>

              {/* 2段目: 構成スタイル切り替え（タブUI） */}
              <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex space-x-1">
                <button
                  onClick={() => setPlotStructure('kishotenketsu')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 font-['Noto_Sans_JP'] ${plotStructure === 'kishotenketsu'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  title="日本伝統の4段階構成"
                >
                  起承転結
                </button>
                <button
                  onClick={() => setPlotStructure('three-act')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 font-['Noto_Sans_JP'] ${plotStructure === 'three-act'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  title="西洋古典の3段階構成"
                >
                  三幕構成
                </button>
                <button
                  onClick={() => setPlotStructure('four-act')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 font-['Noto_Sans_JP'] ${plotStructure === 'four-act'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  title="秩序と混沌の対比を重視した現代的な4段階構成"
                >
                  四幕構成
                </button>
              </div>

              {/* 3段目: 履歴管理、一貫性チェック、構成提案ボタン */}
              <div className="flex items-center justify-end space-x-3">
                {/* 履歴管理ボタン */}
                <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndexRef.current <= 0}
                    className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="元に戻す (Ctrl+Z)"
                  >
                    <Undo2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={historyIndexRef.current >= historyRef.current.length - 1}
                    className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="やり直す (Ctrl+Y)"
                  >
                    <Redo2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
                {/* 一貫性チェックボタン */}
                <button
                  onClick={checkConsistency}
                  disabled={isGenerating === 'consistency'}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  title="構成要素の一貫性をチェック"
                >
                  {isGenerating === 'consistency' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>一貫性チェック</span>
                </button>
                {/* 構成提案ボタン */}
                <button
                  onClick={handleStructureAIGenerate}
                  disabled={isGenerating === 'structure'}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  title={`${plotStructure === 'kishotenketsu' ? '起承転結' : plotStructure === 'three-act' ? '三幕構成' : '四幕構成'}の内容をAI提案`}
                >
                  {isGenerating === 'structure' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>{plotStructure === 'kishotenketsu' ? '起承転結提案' : plotStructure === 'three-act' ? '三幕構成提案' : '四幕構成提案'}</span>
                </button>
              </div>
            </div>

            {/* 一貫性チェック結果表示 */}
            {consistencyCheck && (
              <div className={`p-4 rounded-lg border ${consistencyCheck.hasIssues
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className={`h-5 w-5 ${consistencyCheck.hasIssues
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-green-600 dark:text-green-400'
                    }`} />
                  <h4 className={`font-semibold font-['Noto_Sans_JP'] ${consistencyCheck.hasIssues
                      ? 'text-amber-800 dark:text-amber-200'
                      : 'text-green-800 dark:text-green-200'
                    }`}>
                    {consistencyCheck.hasIssues ? '一貫性の問題が見つかりました' : '一貫性チェック完了：問題なし'}
                  </h4>
                </div>
                {consistencyCheck.hasIssues && consistencyCheck.issues.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                    {consistencyCheck.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 起承転結、三幕構成、または四幕構成の表示 */}
            {plotStructure === 'kishotenketsu' ? (
              <>
                {/* 起 - 導入 */}
                <div id="section-ki" className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP']">
                          起 - 導入
                        </h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">
                          物語の始まり
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* AI補完ボタン */}
                      <button
                        onClick={() => handleAISupplement('ki', '起 - 導入')}
                        disabled={isGenerating === 'supplement-ki'}
                        className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="AI補完"
                      >
                        {isGenerating === 'supplement-ki' ? (
                          <Loader2 className="h-5 w-5 text-blue-700 dark:text-blue-300 animate-spin" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        )}
                      </button>
                      {/* その他のアクションメニュー */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === 'ki' ? null : 'ki')}
                          className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="その他のアクション"
                        >
                          <MoreVertical className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        </button>
                        {openMenuId === 'ki' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button
                              onClick={() => handleCopy('ki')}
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"
                            >
                              <Copy className="h-4 w-4" />
                              <span>コピー</span>
                            </button>
                            <button
                              onClick={() => handleClear('ki')}
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>クリア</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {/* 折りたたみボタン */}
                      <button
                        onClick={() => toggleSection('ki')}
                        className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title={collapsedSections.has('ki') ? '展開' : '折りたたみ'}
                      >
                        {collapsedSections.has('ki') ? (
                          <ChevronDown className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        )}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('ki') && (
                    <div>
                      <textarea
                        value={formData.ki}
                        onChange={(e) => setFormData({ ...formData, ki: e.target.value })}
                        placeholder="登場人物の紹介、日常の描写、事件の発端..."
                        rows={8}
                        className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('ki')
                            ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                            : 'border-blue-300 dark:border-blue-600 focus:ring-blue-500'
                          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`}
                      />
                      <div className="mt-2 space-y-2">
                        {/* 文字数超過警告 */}
                        {isOverLimit('ki') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">
                              文字数が上限を{formData.ki.length - 500}文字超過しています
                            </span>
                          </div>
                        )}
                        {/* 文字数プログレスバー */}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.ki.length, 500)}`}
                            style={{ width: `${Math.min((formData.ki.length / 500) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">
                            500文字以内で記述してください
                          </p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.ki.length, 500)}`}>
                            {formData.ki.length}/500
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 承 - 展開 */}
                <div id="section-sho" className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-900 dark:text-green-100 font-['Noto_Sans_JP']">
                          承 - 展開
                        </h3>
                        <p className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                          事件の発展
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('sho', '承 - 展開')} disabled={isGenerating === 'supplement-sho'} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-sho' ? <Loader2 className="h-5 w-5 text-green-700 dark:text-green-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-green-700 dark:text-green-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'sho' ? null : 'sho')} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-green-700 dark:text-green-300" />
                        </button>
                        {openMenuId === 'sho' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('sho')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('sho')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('sho')} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('sho') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('sho') ? <ChevronDown className="h-5 w-5 text-green-700 dark:text-green-300" /> : <ChevronUp className="h-5 w-5 text-green-700 dark:text-green-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('sho') && (
                    <div>
                      <textarea value={formData.sho} onChange={(e) => setFormData({ ...formData, sho: e.target.value })} placeholder="問題の詳細化、新たな登場人物、状況の発展..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('sho') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-green-300 dark:border-green-600 focus:ring-green-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('sho') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.sho.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.sho.length, 500)}`} style={{ width: `${Math.min((formData.sho.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.sho.length, 500)}`}>{formData.sho.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 転 - 転換 */}
                <div id="section-ten" className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-2xl border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-orange-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Target className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100 font-['Noto_Sans_JP']">転 - 転換</h3>
                        <p className="text-sm text-orange-700 dark:text-orange-300 font-['Noto_Sans_JP']">大きな変化</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('ten', '転 - 転換')} disabled={isGenerating === 'supplement-ten'} className="p-2.5 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-ten' ? <Loader2 className="h-5 w-5 text-orange-700 dark:text-orange-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-orange-700 dark:text-orange-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'ten' ? null : 'ten')} className="p-2.5 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-orange-700 dark:text-orange-300" />
                        </button>
                        {openMenuId === 'ten' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('ten')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('ten')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('ten')} className="p-2.5 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('ten') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('ten') ? <ChevronDown className="h-5 w-5 text-orange-700 dark:text-orange-300" /> : <ChevronUp className="h-5 w-5 text-orange-700 dark:text-orange-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('ten') && (
                    <div>
                      <textarea value={formData.ten} onChange={(e) => setFormData({ ...formData, ten: e.target.value })} placeholder="予想外の展開、大きな転換点、クライマックス..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('ten') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-orange-300 dark:border-orange-600 focus:ring-orange-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('ten') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.ten.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.ten.length, 500)}`} style={{ width: `${Math.min((formData.ten.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-orange-600 dark:text-orange-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.ten.length, 500)}`}>{formData.ten.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 結 - 結末 */}
                <div id="section-ketsu" className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-purple-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Heart className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-['Noto_Sans_JP']">結 - 結末</h3>
                        <p className="text-sm text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">物語の終結</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('ketsu', '結 - 結末')} disabled={isGenerating === 'supplement-ketsu'} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-ketsu' ? <Loader2 className="h-5 w-5 text-purple-700 dark:text-purple-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-purple-700 dark:text-purple-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'ketsu' ? null : 'ketsu')} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                        </button>
                        {openMenuId === 'ketsu' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('ketsu')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('ketsu')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('ketsu')} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('ketsu') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('ketsu') ? <ChevronDown className="h-5 w-5 text-purple-700 dark:text-purple-300" /> : <ChevronUp className="h-5 w-5 text-purple-700 dark:text-purple-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('ketsu') && (
                    <div>
                      <textarea value={formData.ketsu} onChange={(e) => setFormData({ ...formData, ketsu: e.target.value })} placeholder="問題の解決、キャラクターの成長、新たな始まり..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('ketsu') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-purple-300 dark:border-purple-600 focus:ring-purple-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('ketsu') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.ketsu.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.ketsu.length, 500)}`} style={{ width: `${Math.min((formData.ketsu.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.ketsu.length, 500)}`}>{formData.ketsu.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : plotStructure === 'three-act' ? (
              <>
                {/* 第1幕 - 導入 */}
                <div id="section-act1" className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP']">第1幕 - 導入</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">物語の始まりと設定</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('act1', '第1幕 - 導入')} disabled={isGenerating === 'supplement-act1'} className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-act1' ? <Loader2 className="h-5 w-5 text-blue-700 dark:text-blue-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-blue-700 dark:text-blue-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'act1' ? null : 'act1')} className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        </button>
                        {openMenuId === 'act1' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('act1')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('act1')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('act1')} className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('act1') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('act1') ? <ChevronDown className="h-5 w-5 text-blue-700 dark:text-blue-300" /> : <ChevronUp className="h-5 w-5 text-blue-700 dark:text-blue-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('act1') && (
                    <div>
                      <textarea value={formData.act1} onChange={(e) => setFormData({ ...formData, act1: e.target.value })} placeholder="登場人物の紹介、世界観の設定、事件の発端..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('act1') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-blue-300 dark:border-blue-600 focus:ring-blue-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('act1') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.act1.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.act1.length, 500)}`} style={{ width: `${Math.min((formData.act1.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.act1.length, 500)}`}>{formData.act1.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 第2幕 - 展開 */}
                <div id="section-act2" className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-900 dark:text-green-100 font-['Noto_Sans_JP']">第2幕 - 展開</h3>
                        <p className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">物語の核心部分</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('act2', '第2幕 - 展開')} disabled={isGenerating === 'supplement-act2'} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-act2' ? <Loader2 className="h-5 w-5 text-green-700 dark:text-green-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-green-700 dark:text-green-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'act2' ? null : 'act2')} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-green-700 dark:text-green-300" />
                        </button>
                        {openMenuId === 'act2' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('act2')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('act2')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('act2')} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('act2') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('act2') ? <ChevronDown className="h-5 w-5 text-green-700 dark:text-green-300" /> : <ChevronUp className="h-5 w-5 text-green-700 dark:text-green-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('act2') && (
                    <div>
                      <textarea value={formData.act2} onChange={(e) => setFormData({ ...formData, act2: e.target.value })} placeholder="主人公の試練、対立の激化、クライマックスへの準備..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('act2') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-green-300 dark:border-green-600 focus:ring-green-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('act2') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.act2.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.act2.length, 500)}`} style={{ width: `${Math.min((formData.act2.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.act2.length, 500)}`}>{formData.act2.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 第3幕 - 結末 */}
                <div id="section-act3" className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-purple-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Heart className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-['Noto_Sans_JP']">第3幕 - 結末</h3>
                        <p className="text-sm text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">物語の解決と結末</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('act3', '第3幕 - 結末')} disabled={isGenerating === 'supplement-act3'} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-act3' ? <Loader2 className="h-5 w-5 text-purple-700 dark:text-purple-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-purple-700 dark:text-purple-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'act3' ? null : 'act3')} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                        </button>
                        {openMenuId === 'act3' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('act3')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('act3')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('act3')} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('act3') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('act3') ? <ChevronDown className="h-5 w-5 text-purple-700 dark:text-purple-300" /> : <ChevronUp className="h-5 w-5 text-purple-700 dark:text-purple-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('act3') && (
                    <div>
                      <textarea value={formData.act3} onChange={(e) => setFormData({ ...formData, act3: e.target.value })} placeholder="クライマックス、問題の解決、物語の結末、キャラクターの成長..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('act3') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-purple-300 dark:border-purple-600 focus:ring-purple-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('act3') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.act3.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.act3.length, 500)}`} style={{ width: `${Math.min((formData.act3.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.act3.length, 500)}`}>{formData.act3.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* 第1幕 - 秩序 */}
                <div id="section-fourAct1" className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP']">第1幕 - 秩序</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">日常の確立</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('fourAct1', '第1幕 - 秩序')} disabled={isGenerating === 'supplement-fourAct1'} className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-fourAct1' ? <Loader2 className="h-5 w-5 text-blue-700 dark:text-blue-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-blue-700 dark:text-blue-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'fourAct1' ? null : 'fourAct1')} className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        </button>
                        {openMenuId === 'fourAct1' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('fourAct1')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('fourAct1')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('fourAct1')} className="p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('fourAct1') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('fourAct1') ? <ChevronDown className="h-5 w-5 text-blue-700 dark:text-blue-300" /> : <ChevronUp className="h-5 w-5 text-blue-700 dark:text-blue-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('fourAct1') && (
                    <div>
                      <textarea value={formData.fourAct1} onChange={(e) => setFormData({ ...formData, fourAct1: e.target.value })} placeholder="キャラクター紹介、世界観の設定、日常の確立..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('fourAct1') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-blue-300 dark:border-blue-600 focus:ring-blue-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('fourAct1') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.fourAct1.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.fourAct1.length, 500)}`} style={{ width: `${Math.min((formData.fourAct1.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.fourAct1.length, 500)}`}>{formData.fourAct1.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 第2幕 - 混沌 */}
                <div id="section-fourAct2" className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-2xl border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-red-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-red-900 dark:text-red-100 font-['Noto_Sans_JP']">第2幕 - 混沌</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">問題発生と状況悪化</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('fourAct2', '第2幕 - 混沌')} disabled={isGenerating === 'supplement-fourAct2'} className="p-2.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-fourAct2' ? <Loader2 className="h-5 w-5 text-red-700 dark:text-red-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-red-700 dark:text-red-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'fourAct2' ? null : 'fourAct2')} className="p-2.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-red-700 dark:text-red-300" />
                        </button>
                        {openMenuId === 'fourAct2' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('fourAct2')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('fourAct2')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('fourAct2')} className="p-2.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('fourAct2') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('fourAct2') ? <ChevronDown className="h-5 w-5 text-red-700 dark:text-red-300" /> : <ChevronUp className="h-5 w-5 text-red-700 dark:text-red-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('fourAct2') && (
                    <div>
                      <textarea value={formData.fourAct2} onChange={(e) => setFormData({ ...formData, fourAct2: e.target.value })} placeholder="問題の発生、状況の悪化、困難の増大..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('fourAct2') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-red-300 dark:border-red-600 focus:ring-red-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('fourAct2') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.fourAct2.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.fourAct2.length, 500)}`} style={{ width: `${Math.min((formData.fourAct2.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.fourAct2.length, 500)}`}>{formData.fourAct2.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 第3幕 - 秩序 */}
                <div id="section-fourAct3" className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Target className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-900 dark:text-green-100 font-['Noto_Sans_JP']">第3幕 - 秩序</h3>
                        <p className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">解決への取り組み</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('fourAct3', '第3幕 - 秩序')} disabled={isGenerating === 'supplement-fourAct3'} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-fourAct3' ? <Loader2 className="h-5 w-5 text-green-700 dark:text-green-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-green-700 dark:text-green-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'fourAct3' ? null : 'fourAct3')} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-green-700 dark:text-green-300" />
                        </button>
                        {openMenuId === 'fourAct3' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('fourAct3')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('fourAct3')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('fourAct3')} className="p-2.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('fourAct3') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('fourAct3') ? <ChevronDown className="h-5 w-5 text-green-700 dark:text-green-300" /> : <ChevronUp className="h-5 w-5 text-green-700 dark:text-green-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('fourAct3') && (
                    <div>
                      <textarea value={formData.fourAct3} onChange={(e) => setFormData({ ...formData, fourAct3: e.target.value })} placeholder="解決への取り組み、希望の光、状況の改善..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('fourAct3') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-green-300 dark:border-green-600 focus:ring-green-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('fourAct3') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.fourAct3.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.fourAct3.length, 500)}`} style={{ width: `${Math.min((formData.fourAct3.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.fourAct3.length, 500)}`}>{formData.fourAct3.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 第4幕 - 混沌 */}
                <div id="section-fourAct4" className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-purple-500 w-8 h-8 rounded-full flex items-center justify-center">
                        <Heart className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-['Noto_Sans_JP']">第4幕 - 混沌</h3>
                        <p className="text-sm text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">最終的な試練と真の解決</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAISupplement('fourAct4', '第4幕 - 混沌')} disabled={isGenerating === 'supplement-fourAct4'} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center" title="AI補完">
                        {isGenerating === 'supplement-fourAct4' ? <Loader2 className="h-5 w-5 text-purple-700 dark:text-purple-300 animate-spin" /> : <Sparkles className="h-5 w-5 text-purple-700 dark:text-purple-300" />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === 'fourAct4' ? null : 'fourAct4')} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="その他のアクション">
                          <MoreVertical className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                        </button>
                        {openMenuId === 'fourAct4' && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button onClick={() => handleCopy('fourAct4')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP'] transition-colors"><Copy className="h-4 w-4" /><span>コピー</span></button>
                            <button onClick={() => handleClear('fourAct4')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 text-red-600 dark:text-red-400 font-['Noto_Sans_JP'] transition-colors"><Trash2 className="h-4 w-4" /><span>クリア</span></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleSection('fourAct4')} className="p-2.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title={collapsedSections.has('fourAct4') ? '展開' : '折りたたみ'}>
                        {collapsedSections.has('fourAct4') ? <ChevronDown className="h-5 w-5 text-purple-700 dark:text-purple-300" /> : <ChevronUp className="h-5 w-5 text-purple-700 dark:text-purple-300" />}
                      </button>
                    </div>
                  </div>
                  {!collapsedSections.has('fourAct4') && (
                    <div>
                      <textarea value={formData.fourAct4} onChange={(e) => setFormData({ ...formData, fourAct4: e.target.value })} placeholder="最終的な試練、真の解決、物語の結末..." rows={8} className={`w-full px-4 py-3 rounded-lg border ${isOverLimit('fourAct4') ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-purple-300 dark:border-purple-600 focus:ring-purple-500'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[200px]`} />
                      <div className="mt-2 space-y-2">
                        {isOverLimit('fourAct4') && (
                          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-medium font-['Noto_Sans_JP']">文字数が上限を{formData.fourAct4.length - 500}文字超過しています</span>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(formData.fourAct4.length, 500)}`} style={{ width: `${Math.min((formData.fourAct4.length / 500) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP']">500文字以内で記述してください</p>
                          <span className={`text-xs font-['Noto_Sans_JP'] ${getCharacterCountColor(formData.fourAct4.length, 500)}`}>{formData.fourAct4.length}/500</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* リセットボタンと保存ボタン */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleResetPlotStructure}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2 font-['Noto_Sans_JP']"
              title="入力内容をすべてリセット"
            >
              <RotateCcw className="h-4 w-4" />
              <span>入力内容をリセット</span>
            </button>

            <div className="flex items-center space-x-4">
              {saveStatus === 'saved' && (
                <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-['Noto_Sans_JP']">保存完了</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                  <span className="text-sm font-['Noto_Sans_JP']">保存エラー</span>
                </div>
              )}
              <button
                onClick={() => {
                  if (hasAnyOverLimit()) {
                    if (confirm('⚠️ 一部のセクションで文字数が上限を超えています。\nこのまま保存しますか？')) {
                      handleManualSave();
                    }
                  } else {
                    handleManualSave();
                  }
                }}
                disabled={isSaving}
                className={`px-6 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] ${isSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : hasAnyOverLimit()
                      ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:scale-105'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-105'
                  } text-white flex items-center space-x-2`}
              >
                {hasAnyOverLimit() && !isSaving && <AlertCircle className="h-5 w-5" />}
                <span>{isSaving ? '保存中...' : '保存する'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <div className="space-y-6">
          {sidebarSections.map((section) => {
            const isCollapsed = section.collapsed;
            const isDragging = draggedSectionId === section.id;
            const isDragOver = dragOverSectionId === section.id;

            // 構成スタイルガイド
            if (section.id === 'guide') {
              return (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, section.id)}
                  onDragOver={(e) => handleDragOver(e, section.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-2xl border transition-all duration-200 ${isDragging
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-indigo-200 dark:border-indigo-800 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 rounded-t-2xl transition-colors"
                    onClick={() => toggleSidebarSection(section.id)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 w-10 h-10 rounded-full flex items-center justify-center">
                        <Target className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {section.title}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div
                        className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSidebarSection(section.id);
                        }}
                        className="p-1 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                        aria-label={isCollapsed ? 'セクションを展開' : 'セクションを折りたたむ'}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="p-6 pt-0">
                      <div className="space-y-4">
                        {plotStructure === 'kishotenketsu' && (
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                            <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 font-['Noto_Sans_JP']">
                              起承転結（日本伝統）
                            </h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-2">
                              物語の自然な流れを重視した4段階構成
                            </p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-['Noto_Sans_JP']">
                              <li>• 起：物語の始まり、日常の描写</li>
                              <li>• 承：事件の発展、状況の変化</li>
                              <li>• 転：大きな転換点、クライマックス</li>
                              <li>• 結：解決、物語の終結</li>
                            </ul>
                          </div>
                        )}

                        {plotStructure === 'three-act' && (
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                            <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 font-['Noto_Sans_JP']">
                              三幕構成（西洋古典）
                            </h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-2">
                              劇的な構造を重視した3段階構成
                            </p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-['Noto_Sans_JP']">
                              <li>• 第1幕：導入、設定、事件の発端</li>
                              <li>• 第2幕：展開、対立の激化、試練</li>
                              <li>• 第3幕：クライマックス、解決、結末</li>
                            </ul>
                          </div>
                        )}

                        {plotStructure === 'four-act' && (
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                            <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 font-['Noto_Sans_JP']">
                              四幕構成（ダン・ハーモン）
                            </h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-2">
                              秩序と混沌の対比を重視した現代的な4段階構成
                            </p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-['Noto_Sans_JP']">
                              <li>• 第1幕（秩序）：日常の確立、キャラクター紹介</li>
                              <li>• 第2幕（混沌）：問題発生、状況の悪化</li>
                              <li>• 第3幕（秩序）：解決への取り組み、希望の光</li>
                              <li>• 第4幕（混沌）：最終的な試練、真の解決</li>
                            </ul>
                            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-700">
                              <p className="text-xs text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                                💡 起承転結との違い：秩序と混沌の対比により、より現代的な物語構造を提供。短い作品にも適応しやすい。
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // プロット基礎設定
            if (section.id === 'settings') {
              return (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, section.id)}
                  onDragOver={(e) => handleDragOver(e, section.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border transition-all duration-200 ${isDragging
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-amber-200 dark:border-amber-800 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 rounded-t-2xl transition-colors"
                    onClick={() => toggleSidebarSection(section.id)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-gradient-to-br from-amber-500 to-orange-600 w-10 h-10 rounded-full flex items-center justify-center">
                        <Target className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {section.title}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div
                        className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSidebarSection(section.id);
                        }}
                        className="p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                        aria-label={isCollapsed ? 'セクションを展開' : 'セクションを折りたたむ'}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="p-6 pt-0">
                      <div className="space-y-4">
                        {/* メインテーマ */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            メインテーマ
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.theme || '未設定'}
                          </p>
                        </div>

                        {/* 舞台設定 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            舞台設定
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.setting || '未設定'}
                          </p>
                        </div>

                        {/* フック要素 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            フック要素
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.hook || '未設定'}
                          </p>
                        </div>

                        {/* 主人公の目標 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            主人公の目標
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.protagonistGoal || '未設定'}
                          </p>
                        </div>

                        {/* 主要な障害 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            主要な障害
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.mainObstacle || '未設定'}
                          </p>
                        </div>

                        {/* 物語の結末 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            物語の結末
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.ending || '未設定'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                        {currentProject?.plot?.theme && currentProject?.plot?.setting && currentProject?.plot?.hook && currentProject?.plot?.protagonistGoal && currentProject?.plot?.mainObstacle ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                            💡 これらの基礎設定を参考に、一貫性のあるプロット構成を作成しましょう
                            {currentProject?.plot?.ending && (
                              <span className="block mt-1">✨ 結末が設定されているため、逆算プロンプティング機能が利用可能です</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                            ⚠️ プロット基礎設定が未完了です。より良いプロット作成のため、PlotStep1で基礎設定を完了することをお勧めします。
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // AI提案アシスタント
            if (section.id === 'assistant') {
              return (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, section.id)}
                  onDragOver={(e) => handleDragOver(e, section.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl border transition-all duration-200 ${isDragging
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-purple-200 dark:border-purple-800 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/30 rounded-t-2xl transition-colors"
                    onClick={() => toggleSidebarSection(section.id)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-gradient-to-br from-purple-900 to-purple-800 w-10 h-10 rounded-full flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {section.title}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div
                        className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSidebarSection(section.id);
                        }}
                        className="p-1 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                        aria-label={isCollapsed ? 'セクションを展開' : 'セクションを折りたたむ'}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="p-6 pt-0">
                      <p className="text-gray-700 dark:text-gray-300 mb-4 font-['Noto_Sans_JP']">
                        一貫性のある物語構成を生成します：
                      </p>

                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-4">
                        <li>• <span className="font-semibold text-purple-600 dark:text-purple-400">{plotStructure === 'kishotenketsu' ? '起承転結提案' : plotStructure === 'three-act' ? '三幕構成提案' : '四幕構成提案'}</span>：{plotStructure === 'kishotenketsu' ? '起承転結' : plotStructure === 'three-act' ? '三幕構成' : '四幕構成'}の内容をAI提案</li>
                        <li>• キャラクター設定との連携強化</li>
                        <li>• ジャンルに適した展開パターン</li>
                        <li>• 文字数制限による適切なボックスサイズ対応</li>
                      </ul>

                      <div className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-purple-200 dark:border-purple-700">
                        <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3 font-['Noto_Sans_JP']">
                          AI構成詳細提案について
                        </h4>
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP'] mb-3">
                          プロジェクトの基本設定とキャラクター情報に基づいて、選択した構成（{plotStructure === 'kishotenketsu' ? '起承転結' : plotStructure === 'three-act' ? '三幕構成' : '四幕構成'}）の詳細な内容を自動生成します。
                        </p>
                        <ul className="space-y-1 text-xs text-purple-500 dark:text-purple-400 font-['Noto_Sans_JP'] mb-4">
                          <li>• 基本設定（テーマ、舞台、フック要素など）を反映した一貫性のある構成</li>
                          <li>• キャラクターの関係性と成長を考慮した展開パターン</li>
                          <li>• ジャンルに適した物語の流れと各段階の詳細設定</li>
                          {currentProject?.plot?.ending && (
                            <li>• <span className="font-semibold text-purple-600 dark:text-purple-400">逆算プロンプティング</span>：結末から逆算して物語を構築（Goal-Oriented Prompting）</li>
                          )}
                        </ul>

                        <button
                          onClick={handleStructureAIGenerate}
                          disabled={isGenerating === 'structure'}
                          className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP'] shadow-lg hover:shadow-xl"
                        >
                          {isGenerating === 'structure' ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>生成中...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-5 w-5" />
                              <span>{plotStructure === 'kishotenketsu' ? '起承転結をAI提案' : plotStructure === 'three-act' ? '三幕構成をAI提案' : '四幕構成をAI提案'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // 完成度
            if (section.id === 'progress') {
              return (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, section.id)}
                  onDragOver={(e) => handleDragOver(e, section.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border transition-all duration-200 ${isDragging
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-100 dark:border-gray-700 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-2xl transition-colors"
                    onClick={() => toggleSidebarSection(section.id)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-10 h-10 rounded-full flex items-center justify-center">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {plotStructure === 'kishotenketsu' ? '起承転結' : plotStructure === 'three-act' ? '三幕構成' : '四幕構成'}{section.title}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div
                        className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSidebarSection(section.id);
                        }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        aria-label={isCollapsed ? 'セクションを展開' : 'セクションを折りたたむ'}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="p-6 pt-0">
                      {(() => {
                        const progress = calculateStructureProgress();
                        return (
                          <>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">設定項目</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {progress.completed} / {progress.total}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all duration-500 ${progress.percentage === 100
                                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                                    }`}
                                  style={{ width: `${progress.percentage}%` }}
                                />
                              </div>
                              <div className="text-center">
                                <span className={`text-sm font-semibold ${progress.percentage === 100
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-gray-900 dark:text-white'
                                  }`}>
                                  {progress.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>

                            <div className="mt-4 space-y-2 text-sm">
                              {progress.fields.map((field) => (
                                <div key={field.key} className="flex items-center space-x-2">
                                  <div className={`w-2 h-2 rounded-full ${field.completed
                                      ? 'bg-green-500'
                                      : 'bg-gray-300 dark:bg-gray-600'
                                    }`} />
                                  <span className={`font-['Noto_Sans_JP'] ${field.completed
                                      ? 'text-gray-700 dark:text-gray-300'
                                      : 'text-gray-500 dark:text-gray-500'
                                    }`}>
                                    {field.label}
                                  </span>
                                  {field.completed && (
                                    <Check className="h-3 w-3 text-green-500 ml-auto" />
                                  )}
                                </div>
                              ))}
                            </div>

                            {progress.percentage === 100 && (
                              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center space-x-2">
                                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  <span className="text-sm font-semibold text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                                    {plotStructure === 'kishotenketsu' ? '起承転結完成！' : plotStructure === 'three-act' ? '三幕構成完成！' : '四幕構成完成！'}
                                  </span>
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
                                  すべての{plotStructure === 'kishotenketsu' ? '起承転結' : plotStructure === 'three-act' ? '三幕構成' : '四幕構成'}項目が設定されました。次のステップに進むことができます。
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            }

            // AIログセクション
            if (section.id === 'aiLogs') {
              return (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, section.id)}
                  onDragOver={(e) => handleDragOver(e, section.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border transition-all duration-200 ${isDragging
                    ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                    : isDragOver
                      ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-100 dark:border-gray-700 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleSidebarSection(section.id)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        AIログ
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!section.collapsed && aiLogs.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadLogs();
                          }}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="ログをダウンロード"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}
                      <div
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSidebarSection(section.id);
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={section.collapsed ? 'セクションを展開' : 'セクションを折りたたむ'}
                      >
                        {section.collapsed ? (
                          <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {!section.collapsed && (
                    <div className="px-4 pb-4">
                      <AILogPanel
                        logs={aiLogs}
                        onCopyLog={handleCopyLog}
                        onDownloadLogs={handleDownloadLogs}
                        typeLabels={{
                          supplement: '補完',
                          consistency: '一貫性チェック',
                          generateStructure: '構造生成',
                        }}
                        maxHeight="max-h-96"
                      />
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};
