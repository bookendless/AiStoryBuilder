import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, Play, Zap, Target, Heart, RotateCcw, Loader2, Layers, ChevronDown, ChevronUp, Copy, Trash2, AlertCircle, Undo2, Redo2, MoreVertical, Clock, GripVertical } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';

// 新しい型定義とユーティリティのインポート
import type { PlotStep2Props, PlotStructureType, PlotFormData, HistoryState } from './plot2/types';
import { CHARACTER_LIMIT, HISTORY_SAVE_DELAY, AI_LOG_TYPE_LABELS, PLOT_STRUCTURE_CONFIGS } from './plot2/constants';
import { getProjectContext, getStructureFields, hasAnyOverLimit, getLastSavedText, getProgressBarColor, getCharacterCountColor, isOverLimit } from './plot2/utils';
import { usePlotForm } from './plot2/hooks/usePlotForm';
import { usePlotHistory } from './plot2/hooks/usePlotHistory';
import { useSidebarState } from './plot2/hooks/useSidebarState';
import { PlotStructureSection } from './plot2/components/PlotStructureSection';

export const PlotStep2: React.FC<PlotStep2Props> = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showSuccess, showWarning, showError, showInfo } = useToast();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenuIdRef = useRef<string | null>(null);

  // openMenuIdの変更をrefに同期
  useEffect(() => {
    openMenuIdRef.current = openMenuId;
  }, [openMenuId]);

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


  // プロジェクトID変更を追跡するref
  const previousProjectIdRef = useRef<string | undefined>(currentProject?.id);
  // plotStructure変更を追跡するref
  const previousPlotStructureRef = useRef<PlotStructureType>(plotStructure);
  // 履歴初期化フラグ（初期化直後は保存をスキップ）
  const isInitializingHistoryRef = useRef(false);

  // 履歴の初期化
  useEffect(() => {
    if (currentProject) {
      // プロジェクトIDが変更された場合のみ履歴を初期化
      if (previousProjectIdRef.current !== currentProject.id) {
        previousProjectIdRef.current = currentProject.id;
        isInitializingHistoryRef.current = true;
        
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
        // 初期化完了後、フラグをリセット
        setTimeout(() => {
          isInitializingHistoryRef.current = false;
        }, 0);
      }
    }
  }, [currentProject?.id, initializeHistory, currentProject]);

  // plotStructureが変更されたときに履歴をリセット
  useEffect(() => {
    if (previousPlotStructureRef.current !== plotStructure) {
      previousPlotStructureRef.current = plotStructure;
      isInitializingHistoryRef.current = true;
      // 構造が変更されたときは、現在の状態を履歴の初期状態として設定
      const newInitialState: HistoryState = {
        formData: { ...formData },
        plotStructure: plotStructure,
        timestamp: Date.now(),
      };
      initializeHistory(newInitialState);
      // 初期化完了後、フラグをリセット
      setTimeout(() => {
        isInitializingHistoryRef.current = false;
      }, 0);
    }
  }, [plotStructure, initializeHistory, formData]);

  // formData変更時に履歴に保存（デバウンス付き）
  useEffect(() => {
    // 初期化中は履歴に保存しない
    if (isInitializingHistoryRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      // 再度チェック（非同期処理中に初期化が開始された場合）
      if (!isInitializingHistoryRef.current) {
        saveToHistory(formData, plotStructure);
      }
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
      if (openMenuIdRef.current) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);





  // ユーティリティ関数は utils.ts からインポート済み

  // クイックアクション：コピー
  const handleCopy = useCallback(async (fieldKey: keyof PlotFormData) => {
    const text = formData[fieldKey];
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        showSuccess('クリップボードにコピーしました');
        setOpenMenuId(null);
      } catch (error) {
        console.error('クリップボードへのコピーに失敗しました:', error);
        showError('クリップボードへのコピーに失敗しました。', 5000, {
          title: 'コピーエラー',
        });
      }
    } else {
      showWarning('コピーする内容がありません');
    }
  }, [formData, showSuccess, showWarning, showError]);

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
    // 既に生成中の場合は実行しない（競合状態の防止）
    if (isGenerating) {
      return;
    }

    if (!isConfigured) {
      showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    setIsGenerating(`supplement-${fieldKey}`);

    try {
      const context = getProjectContext(currentProject);
      if (!context) {
        showError('プロジェクト情報が見つかりません。', 5000, {
          title: 'プロジェクトエラー',
        });
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
        showError(`AI生成エラー: ${response.error}`, 7000, {
          title: 'AI生成エラー',
        });
        return;
      }

      const content = response.content;
      // {{ と }} で囲まれたJSONを正しく処理するため、まず正規化
      let normalizedContent = content.trim();
      // {{ で始まり }} で終わる場合、外側の波括弧を1つ削除
      if (normalizedContent.startsWith('{{') && normalizedContent.endsWith('}}')) {
        normalizedContent = normalizedContent.slice(1, -1);
      }
      
      const jsonMatch = normalizedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          let jsonString = jsonMatch[0];
          // さらに {{ と }} が残っている場合は削除
          if (jsonString.startsWith('{{')) {
            jsonString = jsonString.slice(1);
          }
          if (jsonString.endsWith('}}')) {
            jsonString = jsonString.slice(0, -1);
          }
          const parsed = JSON.parse(jsonString);
          // 型安全性の向上：文字列型であることを確認
          const improvedText = typeof parsed[fieldLabel] === 'string' 
            ? parsed[fieldLabel] 
            : currentText;
          setFormData(prev => ({ ...prev, [fieldKey]: improvedText }));
        } catch (error) {
          console.error('JSON解析エラー:', error);
          showError('AI出力の解析に失敗しました。', 7000, {
            title: '解析エラー',
          });
        }
      }
    } catch (error) {
      console.error('AI補完エラー:', error);
      showError('AI補完中にエラーが発生しました。', 7000, {
        title: 'AI補完エラー',
      });
    } finally {
      setIsGenerating(null);
    }
  }, [isConfigured, formData, currentProject, settings, addLog, showError, setFormData, isGenerating]);


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
    try {
      await updateProject({ plot: updatedPlot }, true);
      showSuccess('保存しました');
    } catch (error) {
      console.error('保存エラー:', error);
      showError('保存に失敗しました。', 5000, {
        title: '保存エラー',
      });
    }
  }, [currentProject, updateProject, formData, plotStructure, showSuccess, showError]);

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

              {/* 3段目: 履歴管理ボタン */}
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
              </div>
            </div>

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

            return null;
          })}
        </div>
      </div>
    </div>
  );
};
