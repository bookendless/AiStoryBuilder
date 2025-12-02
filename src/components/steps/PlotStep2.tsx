import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Check, Play, Zap, Target, Heart, RotateCcw, Loader2, Layers, ChevronDown, ChevronUp, Copy, Trash2, AlertCircle, Undo2, Redo2, MoreVertical, Clock, GripVertical, Download, FileText } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';
import { AILogPanel } from '../common/AILogPanel';

// 新しい型定義とユーティリティのインポート
import type { PlotStep2Props, PlotStructureType, PlotFormData, HistoryState } from './plot2/types';
import { CHARACTER_LIMIT, HISTORY_SAVE_DELAY, AI_LOG_TYPE_LABELS, PLOT_STRUCTURE_CONFIGS } from './plot2/constants';
import { getProjectContext, getStructureFields, hasAnyOverLimit, getLastSavedText, formatCharactersInfo, getProgressBarColor, getCharacterCountColor, isOverLimit } from './plot2/utils';
import { usePlotForm } from './plot2/hooks/usePlotForm';
import { usePlotHistory } from './plot2/hooks/usePlotHistory';
import { useSidebarState } from './plot2/hooks/useSidebarState';
import { PlotStructureSection } from './plot2/components/PlotStructureSection';

export const PlotStep2: React.FC<PlotStep2Props> = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showSuccess, showWarning } = useToast();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // AIログ管理
  const { aiLogs, addLog } = useAILog();

  // 新しいカスタムフックを使用
  const {
    formData,
    setFormData,
    plotStructure,
    setPlotStructure,
    isSaving,
    saveStatus,
    lastSaved,
    resetFormData,
  } = usePlotForm({ currentProject, updateProject });

  // 履歴管理フック
  const {
    saveToHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    initializeHistory,
  } = usePlotHistory({
    formData,
    plotStructure,
    projectId: currentProject?.id,
  });

  // 自動保存はusePlotFormフック内で処理されます

  // 折りたたみ状態管理
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // サイドバー管理（新しいフックを使用）
  const {
    sidebarSections,
    draggedSectionId,
    dragOverSectionId,
    toggleSidebarSection,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useSidebarState(() => {
    showSuccess('サイドバー項目の並び順を変更しました');
  });

  // 一貫性チェック結果
  const [consistencyCheck, setConsistencyCheck] = useState<{
    hasIssues: boolean;
    issues: string[];
  } | null>(null);

  // 履歴の初期化
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
          // ヒーローズ・ジャーニー
          hj1: currentProject.plot?.hj1 || '',
          hj2: currentProject.plot?.hj2 || '',
          hj3: currentProject.plot?.hj3 || '',
          hj4: currentProject.plot?.hj4 || '',
          hj5: currentProject.plot?.hj5 || '',
          hj6: currentProject.plot?.hj6 || '',
          hj7: currentProject.plot?.hj7 || '',
          hj8: currentProject.plot?.hj8 || '',
          // ビートシート
          bs1: currentProject.plot?.bs1 || '',
          bs2: currentProject.plot?.bs2 || '',
          bs3: currentProject.plot?.bs3 || '',
          bs4: currentProject.plot?.bs4 || '',
          bs5: currentProject.plot?.bs5 || '',
          bs6: currentProject.plot?.bs6 || '',
          bs7: currentProject.plot?.bs7 || '',
          // ミステリー・サスペンス
          ms1: currentProject.plot?.ms1 || '',
          ms2: currentProject.plot?.ms2 || '',
          ms3: currentProject.plot?.ms3 || '',
          ms4: currentProject.plot?.ms4 || '',
          ms5: currentProject.plot?.ms5 || '',
          ms6: currentProject.plot?.ms6 || '',
          ms7: currentProject.plot?.ms7 || '',
        },
        plotStructure: (currentProject.plot?.structure || 'kishotenketsu') as PlotStructureType,
        timestamp: Date.now(),
      };
      initializeHistory(initialState);
    }
  }, [currentProject?.id, initializeHistory]);

  // formData変更時に履歴に保存（デバウンス付き）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToHistory(formData, plotStructure);
    }, HISTORY_SAVE_DELAY);

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
    const typeLabel = AI_LOG_TYPE_LABELS[log.type] || log.type;
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
    const logsText = aiLogs.map(log => {
      const typeLabel = AI_LOG_TYPE_LABELS[log.type] || log.type;
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




  // ユーティリティ関数は utils.ts からインポート済み

  // クイックアクション：コピー
  const handleCopy = useCallback((fieldKey: keyof PlotFormData) => {
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
  const handleClear = useCallback((fieldKey: keyof PlotFormData) => {
    if (confirm('このセクションの内容をクリアしますか？')) {
      setFormData(prev => ({ ...prev, [fieldKey]: '' }));
      showSuccess('セクションをクリアしました');
      setOpenMenuId(null);
    }
  }, [setFormData, showSuccess]);

  // クイックアクション：AI補完
  const handleAISupplement = useCallback(async (fieldKey: keyof PlotFormData, fieldLabel: string) => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setIsGenerating(`supplement-${fieldKey}`);

    try {
      const context = getProjectContext(currentProject);
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
      const context = getProjectContext(currentProject);
      if (!context) {
        alert('プロジェクト情報が見つかりません。');
        return;
      }

      const structureFields = getStructureFields(plotStructure, formData);

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
      updatedPlot.hj1 = '';
      updatedPlot.hj2 = '';
      updatedPlot.hj3 = '';
      updatedPlot.hj4 = '';
      updatedPlot.hj5 = '';
      updatedPlot.hj6 = '';
      updatedPlot.hj7 = '';
      updatedPlot.hj8 = '';
      updatedPlot.bs1 = '';
      updatedPlot.bs2 = '';
      updatedPlot.bs3 = '';
      updatedPlot.bs4 = '';
      updatedPlot.bs5 = '';
      updatedPlot.bs6 = '';
      updatedPlot.bs7 = '';
      updatedPlot.ms1 = '';
      updatedPlot.ms2 = '';
      updatedPlot.ms3 = '';
      updatedPlot.ms4 = '';
      updatedPlot.ms5 = '';
      updatedPlot.ms6 = '';
      updatedPlot.ms7 = '';
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
      updatedPlot.hj1 = '';
      updatedPlot.hj2 = '';
      updatedPlot.hj3 = '';
      updatedPlot.hj4 = '';
      updatedPlot.hj5 = '';
      updatedPlot.hj6 = '';
      updatedPlot.hj7 = '';
      updatedPlot.hj8 = '';
      updatedPlot.bs1 = '';
      updatedPlot.bs2 = '';
      updatedPlot.bs3 = '';
      updatedPlot.bs4 = '';
      updatedPlot.bs5 = '';
      updatedPlot.bs6 = '';
      updatedPlot.bs7 = '';
      updatedPlot.ms1 = '';
      updatedPlot.ms2 = '';
      updatedPlot.ms3 = '';
      updatedPlot.ms4 = '';
      updatedPlot.ms5 = '';
      updatedPlot.ms6 = '';
      updatedPlot.ms7 = '';
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
      updatedPlot.hj1 = '';
      updatedPlot.hj2 = '';
      updatedPlot.hj3 = '';
      updatedPlot.hj4 = '';
      updatedPlot.hj5 = '';
      updatedPlot.hj6 = '';
      updatedPlot.hj7 = '';
      updatedPlot.hj8 = '';
      updatedPlot.bs1 = '';
      updatedPlot.bs2 = '';
      updatedPlot.bs3 = '';
      updatedPlot.bs4 = '';
      updatedPlot.bs5 = '';
      updatedPlot.bs6 = '';
      updatedPlot.bs7 = '';
      updatedPlot.ms1 = '';
      updatedPlot.ms2 = '';
      updatedPlot.ms3 = '';
      updatedPlot.ms4 = '';
      updatedPlot.ms5 = '';
      updatedPlot.ms6 = '';
      updatedPlot.ms7 = '';
    } else if (plotStructure === 'heroes-journey') {
      updatedPlot.hj1 = formData.hj1;
      updatedPlot.hj2 = formData.hj2;
      updatedPlot.hj3 = formData.hj3;
      updatedPlot.hj4 = formData.hj4;
      updatedPlot.hj5 = formData.hj5;
      updatedPlot.hj6 = formData.hj6;
      updatedPlot.hj7 = formData.hj7;
      updatedPlot.hj8 = formData.hj8;
      // 他の構成のデータはクリア
      updatedPlot.ki = '';
      updatedPlot.sho = '';
      updatedPlot.ten = '';
      updatedPlot.ketsu = '';
      updatedPlot.act1 = '';
      updatedPlot.act2 = '';
      updatedPlot.act3 = '';
      updatedPlot.fourAct1 = '';
      updatedPlot.fourAct2 = '';
      updatedPlot.fourAct3 = '';
      updatedPlot.fourAct4 = '';
      updatedPlot.bs1 = '';
      updatedPlot.bs2 = '';
      updatedPlot.bs3 = '';
      updatedPlot.bs4 = '';
      updatedPlot.bs5 = '';
      updatedPlot.bs6 = '';
      updatedPlot.bs7 = '';
      updatedPlot.ms1 = '';
      updatedPlot.ms2 = '';
      updatedPlot.ms3 = '';
      updatedPlot.ms4 = '';
      updatedPlot.ms5 = '';
      updatedPlot.ms6 = '';
      updatedPlot.ms7 = '';
    } else if (plotStructure === 'beat-sheet') {
      updatedPlot.bs1 = formData.bs1;
      updatedPlot.bs2 = formData.bs2;
      updatedPlot.bs3 = formData.bs3;
      updatedPlot.bs4 = formData.bs4;
      updatedPlot.bs5 = formData.bs5;
      updatedPlot.bs6 = formData.bs6;
      updatedPlot.bs7 = formData.bs7;
      // 他の構成のデータはクリア
      updatedPlot.ki = '';
      updatedPlot.sho = '';
      updatedPlot.ten = '';
      updatedPlot.ketsu = '';
      updatedPlot.act1 = '';
      updatedPlot.act2 = '';
      updatedPlot.act3 = '';
      updatedPlot.fourAct1 = '';
      updatedPlot.fourAct2 = '';
      updatedPlot.fourAct3 = '';
      updatedPlot.fourAct4 = '';
      updatedPlot.hj1 = '';
      updatedPlot.hj2 = '';
      updatedPlot.hj3 = '';
      updatedPlot.hj4 = '';
      updatedPlot.hj5 = '';
      updatedPlot.hj6 = '';
      updatedPlot.hj7 = '';
      updatedPlot.hj8 = '';
      updatedPlot.ms1 = '';
      updatedPlot.ms2 = '';
      updatedPlot.ms3 = '';
      updatedPlot.ms4 = '';
      updatedPlot.ms5 = '';
      updatedPlot.ms6 = '';
      updatedPlot.ms7 = '';
    } else if (plotStructure === 'mystery-suspense') {
      updatedPlot.ms1 = formData.ms1;
      updatedPlot.ms2 = formData.ms2;
      updatedPlot.ms3 = formData.ms3;
      updatedPlot.ms4 = formData.ms4;
      updatedPlot.ms5 = formData.ms5;
      updatedPlot.ms6 = formData.ms6;
      updatedPlot.ms7 = formData.ms7;
      // 他の構成のデータはクリア
      updatedPlot.ki = '';
      updatedPlot.sho = '';
      updatedPlot.ten = '';
      updatedPlot.ketsu = '';
      updatedPlot.act1 = '';
      updatedPlot.act2 = '';
      updatedPlot.act3 = '';
      updatedPlot.fourAct1 = '';
      updatedPlot.fourAct2 = '';
      updatedPlot.fourAct3 = '';
      updatedPlot.fourAct4 = '';
      updatedPlot.hj1 = '';
      updatedPlot.hj2 = '';
      updatedPlot.hj3 = '';
      updatedPlot.hj4 = '';
      updatedPlot.hj5 = '';
      updatedPlot.hj6 = '';
      updatedPlot.hj7 = '';
      updatedPlot.hj8 = '';
      updatedPlot.bs1 = '';
      updatedPlot.bs2 = '';
      updatedPlot.bs3 = '';
      updatedPlot.bs4 = '';
      updatedPlot.bs5 = '';
      updatedPlot.bs6 = '';
      updatedPlot.bs7 = '';
    }

    // 即座に保存
    await updateProject({ plot: updatedPlot }, true);
    showSuccess('保存しました');
  }, [currentProject, updateProject, formData, plotStructure, showSuccess]);

  // プロット構成部分のみをリセット
  const handleResetPlotStructure = () => {
    const structureNames: Record<PlotStructureType, string> = {
      'kishotenketsu': '起承転結',
      'three-act': '三幕構成',
      'four-act': '四幕構成',
      'heroes-journey': 'ヒーローズ・ジャーニー',
      'beat-sheet': 'ビートシート',
      'mystery-suspense': 'ミステリー・サスペンス',
    };
    const structureName = structureNames[plotStructure];
    if (confirm(`${structureName}の内容をすべてリセットしますか？`)) {
      resetFormData(plotStructure);
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
      const context = getProjectContext(currentProject);
      if (!context) {
        alert('プロジェクト情報が見つかりません。');
        return;
      }

      // キャラクター情報の文字列化
      const charactersInfo = formatCharactersInfo(context.characters);


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
      } else if (plotStructure === 'heroes-journey') {
        structureType = 'ヒーローズ・ジャーニー';
        structureDescription = `ヒーローズ・ジャーニー（神話の法則）について：
- 日常の世界：主人公の現状、平穏な日常
- 冒険への誘い：事件の始まり、冒険への呼びかけ
- 境界越え：非日常への旅立ち、新しい世界への入り口
- 試練と仲間：最初の試練、仲間との出会い、敵との遭遇
- 最大の試練：物語の底、敗北や死の危険、絶望の瞬間
- 報酬：剣（力）の獲得、勝利の報酬、重要な発見
- 帰路：追跡される帰路、最後の試練、脱出
- 復活と帰還：成長した主人公の帰還、新しい日常、変化の完成`;
        outputFormat = `{
  "日常の世界": "日常の世界を500文字以内で記述",
  "冒険への誘い": "冒険への誘いを500文字以内で記述",
  "境界越え": "境界越えを500文字以内で記述",
  "試練と仲間": "試練と仲間を500文字以内で記述",
  "最大の試練": "最大の試練を500文字以内で記述",
  "報酬": "報酬を500文字以内で記述",
  "帰路": "帰路を500文字以内で記述",
  "復活と帰還": "復活と帰還を500文字以内で記述"
}`;
      } else if (plotStructure === 'beat-sheet') {
        structureType = 'ビートシート';
        structureDescription = `ビートシート（Save the Cat! 風）について：
- 導入 (Setup)：日常、テーマの提示、きっかけ（事件発生）
- 決断 (Break into Two)：葛藤の末の決断、新しい世界への旅立ち
- 試練 (Fun and Games)：新しい世界での試行錯誤、サブプロットの展開
- 転換点 (Midpoint)：物語の中間点、状況の一変（偽の勝利または敗北）
- 危機 (All Is Lost)：迫り来る敵、絶望、魂の暗夜
- クライマックス (Finale)：再起、解決への最後の戦い
- 結末 (Final Image)：変化した世界、新たな日常`;
        outputFormat = `{
  "導入 (Setup)": "導入 (Setup)を500文字以内で記述",
  "決断 (Break into Two)": "決断 (Break into Two)を500文字以内で記述",
  "試練 (Fun and Games)": "試練 (Fun and Games)を500文字以内で記述",
  "転換点 (Midpoint)": "転換点 (Midpoint)を500文字以内で記述",
  "危機 (All Is Lost)": "危機 (All Is Lost)を500文字以内で記述",
  "クライマックス (Finale)": "クライマックス (Finale)を500文字以内で記述",
  "結末 (Final Image)": "結末 (Final Image)を500文字以内で記述"
}`;
      } else if (plotStructure === 'mystery-suspense') {
        structureType = 'ミステリー・サスペンス構成';
        structureDescription = `ミステリー・サスペンス構成について：
- 発端（事件発生）：不可解な事件の提示、謎の始まり
- 捜査（初期）：状況確認、関係者への聴取、初期の手がかり
- 仮説とミスリード：誤った推理、ミスリード、謎が深まる
- 第二の事件/急展開：捜査の行き詰まり、新たな事件、急展開
- 手がかりの統合：手がかりの統合、真相への気づき、重要な発見
- 解決（真相解明）：犯人の指摘、トリックの暴き、真相の解明
- エピローグ：事件後の余韻、影響、物語の結末`;
        outputFormat = `{
  "発端（事件発生）": "発端（事件発生）を500文字以内で記述",
  "捜査（初期）": "捜査（初期）を500文字以内で記述",
  "仮説とミスリード": "仮説とミスリードを500文字以内で記述",
  "第二の事件/急展開": "第二の事件/急展開を500文字以内で記述",
  "手がかりの統合": "手がかりの統合を500文字以内で記述",
  "解決（真相解明）": "解決（真相解明）を500文字以内で記述",
  "エピローグ": "エピローグを500文字以内で記述"
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
          } else if (plotStructure === 'heroes-journey') {
            setFormData(prev => ({
              ...prev,
              hj1: parsed['日常の世界'] || prev.hj1,
              hj2: parsed['冒険への誘い'] || prev.hj2,
              hj3: parsed['境界越え'] || prev.hj3,
              hj4: parsed['試練と仲間'] || prev.hj4,
              hj5: parsed['最大の試練'] || prev.hj5,
              hj6: parsed['報酬'] || prev.hj6,
              hj7: parsed['帰路'] || prev.hj7,
              hj8: parsed['復活と帰還'] || prev.hj8,
            }));
          } else if (plotStructure === 'beat-sheet') {
            setFormData(prev => ({
              ...prev,
              bs1: parsed['導入 (Setup)'] || prev.bs1,
              bs2: parsed['決断 (Break into Two)'] || prev.bs2,
              bs3: parsed['試練 (Fun and Games)'] || prev.bs3,
              bs4: parsed['転換点 (Midpoint)'] || prev.bs4,
              bs5: parsed['危機 (All Is Lost)'] || prev.bs5,
              bs6: parsed['クライマックス (Finale)'] || prev.bs6,
              bs7: parsed['結末 (Final Image)'] || prev.bs7,
            }));
          } else if (plotStructure === 'mystery-suspense') {
            setFormData(prev => ({
              ...prev,
              ms1: parsed['発端（事件発生）'] || prev.ms1,
              ms2: parsed['捜査（初期）'] || prev.ms2,
              ms3: parsed['仮説とミスリード'] || prev.ms3,
              ms4: parsed['第二の事件/急展開'] || prev.ms4,
              ms5: parsed['手がかりの統合'] || prev.ms5,
              ms6: parsed['解決（真相解明）'] || prev.ms6,
              ms7: parsed['エピローグ'] || prev.ms7,
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

  // ユーティリティ関数は utils.ts からインポート済み

  // プロット構成完成度を計算する関数
  const calculateStructureProgress = () => {
    const structureFields = getStructureFields(plotStructure, formData);
    const completedFields = structureFields.filter(field => field.value.trim().length > 0);
    const progressPercentage = (completedFields.length / structureFields.length) * 100;

    return {
      completed: completedFields.length,
      total: structureFields.length,
      percentage: progressPercentage,
      fields: structureFields.map(field => ({
        key: field.key,
        label: field.label,
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
                  <span className="font-['Noto_Sans_JP']">{getLastSavedText(lastSaved)}</span>
                </div>
              </div>

              {/* 2段目: 構成スタイル切り替え（ドロップダウン） */}
              <div className="relative">
                <select
                  value={plotStructure}
                  onChange={(e) => setPlotStructure(e.target.value as PlotStructureType)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP'] appearance-none cursor-pointer"
                >
                  {Object.entries(PLOT_STRUCTURE_CONFIGS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label} - {config.description}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </div>
              </div>

              {/* 3段目: 履歴管理、一貫性チェック、構成提案ボタン */}
              <div className="flex items-center justify-end space-x-3">
                {/* 履歴管理ボタン */}
                <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => {
                      const state = handleUndo();
                      if (state) {
                        setFormData(state.formData);
                        setPlotStructure(state.plotStructure);
                      }
                    }}
                    disabled={!canUndo()}
                    className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="元に戻す (Ctrl+Z)"
                  >
                    <Undo2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={() => {
                      const state = handleRedo();
                      if (state) {
                        setFormData(state.formData);
                        setPlotStructure(state.plotStructure);
                      }
                    }}
                    disabled={!canRedo()}
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
                  title={`${PLOT_STRUCTURE_CONFIGS[plotStructure].label}の内容をAI提案`}
                >
                  {isGenerating === 'structure' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>{PLOT_STRUCTURE_CONFIGS[plotStructure].label}提案</span>
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

            {/* プロット構成の表示 */}
            <PlotStructureSection
              structure={plotStructure}
              formData={formData}
              collapsedSections={collapsedSections}
              isGenerating={isGenerating}
              onFieldChange={(fieldKey, value) => setFormData(prev => ({ ...prev, [fieldKey]: value }))}
              onToggleCollapse={toggleSection}
              onAISupplement={handleAISupplement}
              onCopy={handleCopy}
              onClear={handleClear}
            />
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
                  if (hasAnyOverLimit(plotStructure, formData)) {
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
                  : hasAnyOverLimit(plotStructure, formData)
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:scale-105'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-105'
                  } text-white flex items-center space-x-2`}
              >
                {hasAnyOverLimit(plotStructure, formData) && !isSaving && <AlertCircle className="h-5 w-5" />}
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
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                            <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 font-['Noto_Sans_JP']">
                            {PLOT_STRUCTURE_CONFIGS[plotStructure].label}
                            </h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] mb-2">
                            {PLOT_STRUCTURE_CONFIGS[plotStructure].description}
                            </p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-['Noto_Sans_JP']">
                            {PLOT_STRUCTURE_CONFIGS[plotStructure].fields.map((field) => (
                              <li key={field.key}>• {field.label}：{field.description}</li>
                            ))}
                            </ul>
                          </div>
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
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            メインテーマ
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.theme || '未設定'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            舞台設定
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.setting || '未設定'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            フック要素
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.hook || '未設定'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            主人公の目標
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.protagonistGoal || '未設定'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 font-['Noto_Sans_JP']">
                            主要な障害
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {currentProject?.plot?.mainObstacle || '未設定'}
                          </p>
                        </div>
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
                        <li>• <span className="font-semibold text-purple-600 dark:text-purple-400">{PLOT_STRUCTURE_CONFIGS[plotStructure].label}提案</span>：{PLOT_STRUCTURE_CONFIGS[plotStructure].label}の内容をAI提案</li>
                        <li>• キャラクター設定との連携強化</li>
                        <li>• ジャンルに適した展開パターン</li>
                        <li>• 文字数制限による適切なボックスサイズ対応</li>
                      </ul>
                      <div className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-purple-200 dark:border-purple-700">
                        <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3 font-['Noto_Sans_JP']">
                          AI構成詳細提案について
                        </h4>
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP'] mb-3">
                          プロジェクトの基本設定とキャラクター情報に基づいて、選択した構成（{PLOT_STRUCTURE_CONFIGS[plotStructure].label}）の詳細な内容を自動生成します。
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
                              <span>{PLOT_STRUCTURE_CONFIGS[plotStructure].label}をAI提案</span>
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
                        {PLOT_STRUCTURE_CONFIGS[plotStructure].label}{section.title}
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
                                    {PLOT_STRUCTURE_CONFIGS[plotStructure].label}完成！
                                  </span>
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
                                  すべての{PLOT_STRUCTURE_CONFIGS[plotStructure].label}項目が設定されました。次のステップに進むことができます。
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
