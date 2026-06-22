import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, RotateCcw, Layers, ChevronDown, ChevronUp, AlertCircle, Clock, BookOpen, Info, Wand2, Loader2 } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { useAILog } from '../common/hooks/useAILog';
import { ConfirmDialog } from '../common/ConfirmDialog';

// 新しい型定義とユーティリティのインポート
import type { PlotStep2Props, PlotStructureType, PlotFormData } from './plot2/types';
import { PLOT_STRUCTURE_CONFIGS } from './plot2/constants';
import { getProjectContext, hasAnyOverLimit, getLastSavedText } from './plot2/utils';
import { usePlotForm } from './plot2/hooks/usePlotForm';

import { PlotStructureSection } from './plot2/components/PlotStructureSection';
import { StructureInferenceModal } from './plot2/components/StructureInferenceModal';
import { StepNavigation } from '../common/StepNavigation';
import { getInputCharBudget } from '../../services/summarization/tokenBudget';
import { IMPORT_SYSTEM_PROMPT } from '../../services/prompts/import';
import { buildStructureInferencePrompt } from '../../services/prompts/plotStructure';
import {
  INFER_STRUCTURE_PROMPT_CAP,
  buildStructureCatalog,
  buildChapterDigest,
  parseStructureInference,
  type StructureInference,
} from '../../services/plotStructure/inferStructure';


export const PlotStep2: React.FC<PlotStep2Props> = ({ onNavigateToStep }) => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showSuccess, showWarning, showError } = useToast();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenuIdRef = useRef<string | null>(null);

  // 確認ダイアログの状態
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    type: 'clear-section' | 'reset-structure' | 'save-over-limit' | null;
    fieldKey?: keyof PlotFormData;
    plotStructure?: PlotStructureType;
  }>({
    isOpen: false,
    type: null,
  });

  // openMenuIdの変更をrefに同期
  useEffect(() => {
    openMenuIdRef.current = openMenuId;
  }, [openMenuId]);

  // AIログ管理
  const { addLog } = useAILog();

  // 新しいカスタムフックを使用
  const {
    formData,
    setFormData,
    plotStructure,
    setPlotStructure,
    isSaving,
    saveStatus,
    lastSaved,
  } = usePlotForm({ currentProject, updateProject });



  // 自動保存はusePlotFormフック内で処理されます

  // 折りたたみ状態管理
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // 表示モード（アウトライン＝全折りたたみ / 詳細＝全展開）
  const [viewMode, setViewMode] = useState<'outline' | 'detail'>('detail');

  const applyViewMode = useCallback((mode: 'outline' | 'detail') => {
    setViewMode(mode);
    if (mode === 'outline') {
      const allKeys = PLOT_STRUCTURE_CONFIGS[plotStructure].fields.map(f => f.key);
      setCollapsedSections(new Set(allKeys));
    } else {
      setCollapsedSections(new Set());
    }
  }, [plotStructure]);

  // 構成スタイルガイドの展開状態
  const [isGuideExpanded, setIsGuideExpanded] = useState(false);

  // プロット基礎設定の展開状態
  const [isBasicSettingsExpanded, setIsBasicSettingsExpanded] = useState(false);




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
    setConfirmDialogState({
      isOpen: true,
      type: 'clear-section',
      fieldKey,
    });
    setOpenMenuId(null);
  }, []);

  const handleConfirmClear = useCallback(() => {
    if (!confirmDialogState.fieldKey) return;
    setFormData(prev => ({ ...prev, [confirmDialogState.fieldKey!]: '' }));
    showSuccess('セクションをクリアしました');
  }, [confirmDialogState.fieldKey, setFormData, showSuccess]);

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

  // 構成推定（あらすじ＋章一覧からどの構成に当てはまるかをAIが判定・忠実抽出系）
  const [inferenceResult, setInferenceResult] = useState<StructureInference | null>(null);

  const handleInferStructure = useCallback(async () => {
    if (isGenerating) return;
    if (!currentProject) return;

    if (!isConfigured) {
      showError('AI設定が必要です。設定画面でAIプロバイダーとAPIキーを設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    setIsGenerating('infer-structure');

    try {
      // 既定の10000字キャップでは章ダイジェスト＋カタログが欠落し得るため上限を引き上げ、
      // 予算計算（getInputCharBudget）と実際の切り詰め（maxPromptLength）を整合させる
      const budget = getInputCharBudget(settings, INFER_STRUCTURE_PROMPT_CAP);
      const synopsis = (currentProject.synopsis || '').slice(0, Math.floor(budget * 0.5));
      const chaptersDigest = buildChapterDigest(
        currentProject.chapters,
        Math.max(500, budget - synopsis.length)
      );

      const prompt = buildStructureInferencePrompt({
        synopsis,
        theme: currentProject.plot?.theme || '',
        setting: currentProject.plot?.setting || '',
        chaptersDigest,
        structureCatalog: buildStructureCatalog(),
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'plot',
        // 既定の創作支援システムプロンプトは捏造の原因になるため、忠実抽出用に差し替える
        systemPrompt: IMPORT_SYSTEM_PROMPT,
        settings: { ...settings, temperature: Math.min(settings.temperature, 0.2) },
        maxPromptLength: INFER_STRUCTURE_PROMPT_CAP,
      });

      addLog({
        type: 'inferStructure',
        prompt,
        response: response.content || '',
        error: response.error,
      });

      if (response.error) {
        showError(`AI生成エラー: ${response.error}`, 7000, {
          title: '構成推定エラー',
        });
        return;
      }

      const parsed = parseStructureInference(response.content);
      if (!parsed) {
        showError('AI応答の解析に失敗しました。もう一度お試しください。', 7000, {
          title: '構成推定エラー',
        });
        return;
      }

      setInferenceResult(parsed);
    } catch (error) {
      console.error('構成推定エラー:', error);
      showError('構成の推定中にエラーが発生しました。', 7000, {
        title: '構成推定エラー',
      });
    } finally {
      setIsGenerating(null);
    }
  }, [isGenerating, currentProject, isConfigured, settings, addLog, showError]);

  // 推定結果の適用（updateProject 直接更新＝usePlotFormの同期エフェクトと競合しない）
  const handleApplyInference = useCallback((result: StructureInference) => {
    if (!currentProject) return;
    updateProject({
      plot: {
        ...currentProject.plot,
        structure: result.structure,
        ...result.fields,
      },
    }, true);
    showSuccess('推定された構成を適用しました。内容を確認・編集してください。');
  }, [currentProject, updateProject, showSuccess]);

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

  const handleConfirmSaveOverLimit = useCallback(() => {
    handleManualSave();
  }, [handleManualSave]);

  // プロット構成部分のみをリセット
  const handleResetPlotStructure = () => {
    setConfirmDialogState({
      isOpen: true,
      type: 'reset-structure',
      plotStructure,
    });
  };

  const handleConfirmResetStructure = useCallback(() => {
    if (!confirmDialogState.plotStructure) return;

    // 現在の構成スタイルのすべてのフィールドをクリア
    const structureConfig = PLOT_STRUCTURE_CONFIGS[confirmDialogState.plotStructure];
    const clearedFormData = { ...formData };

    structureConfig.fields.forEach(field => {
      clearedFormData[field.key as keyof PlotFormData] = '';
    });

    setFormData(clearedFormData);
    showSuccess('プロット構成をリセットしました');
  }, [confirmDialogState.plotStructure, formData, setFormData, showSuccess]);

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  // ステップナビゲーション用のハンドラー
  const handlePreviousStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('character');
    }
  };

  const handleNextStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('synopsis');
    }
  };

  return (
    <div>
      {/* ステップナビゲーション */}
      <StepNavigation
        currentStep="plot2"
        onPrevious={handlePreviousStep}
        onNext={handleNextStep}
      />

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

      <div className="space-y-6">
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

            {/* 2段目: 構成スタイル切り替え（ドロップダウン）＋ AI構成推定 */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
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
              <button
                onClick={handleInferStructure}
                disabled={!!isGenerating}
                className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm whitespace-nowrap font-['Noto_Sans_JP']"
                title="あらすじと章一覧から、どの構成に当てはまるかをAIが推定します（適用前に確認できます）"
              >
                {isGenerating === 'infer-structure' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                <span>{isGenerating === 'infer-structure' ? '推定中...' : 'AIで構成を推定'}</span>
              </button>
            </div>

            {/* 構成スタイルガイド（ドロップダウン直下にインライン表示） */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden">
              <button
                onClick={() => setIsGuideExpanded(!isGuideExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 font-['Noto_Sans_JP']">
                    {PLOT_STRUCTURE_CONFIGS[plotStructure].label}
                  </span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-['Noto_Sans_JP']">
                    — {PLOT_STRUCTURE_CONFIGS[plotStructure].description}
                  </span>
                </div>
                {isGuideExpanded ? (
                  <ChevronUp className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                )}
              </button>
              {isGuideExpanded && (
                <div className="px-4 pb-3 border-t border-indigo-200/50 dark:border-indigo-700/50">
                  <ul className="mt-3 space-y-1.5">
                    {PLOT_STRUCTURE_CONFIGS[plotStructure].fields.map((field) => (
                      <li key={field.key} className="flex items-start space-x-2 text-xs font-['Noto_Sans_JP']">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0 ${field.color.icon}`}
                        />
                        <span className="text-gray-800 dark:text-gray-200">
                          <span className="font-medium">{field.label}</span>
                          <span className="text-gray-500 dark:text-gray-400">：{field.description}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>


          </div>

          {/* 表示モード切替 */}
          <div className="flex items-center justify-end mb-3">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
              <button
                type="button"
                onClick={() => applyViewMode('outline')}
                className={`px-3 py-1.5 text-xs font-['Noto_Sans_JP'] rounded-md transition-colors ${
                  viewMode === 'outline'
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-pressed={viewMode === 'outline'}
                title="全セクションを折りたたみ、構成全体を俯瞰"
              >
                アウトライン
              </button>
              <button
                type="button"
                onClick={() => applyViewMode('detail')}
                className={`px-3 py-1.5 text-xs font-['Noto_Sans_JP'] rounded-md transition-colors ${
                  viewMode === 'detail'
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-pressed={viewMode === 'detail'}
                title="全セクションを展開し、本文を編集"
              >
                詳細
              </button>
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
                  setConfirmDialogState({
                    isOpen: true,
                    type: 'save-over-limit',
                  });
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

        {/* プロット基礎設定（リセット/保存ボタンの下に配置） */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
          <button
            onClick={() => setIsBasicSettingsExpanded(!isBasicSettingsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                プロット基礎設定
              </span>
              {/* 未完了の場合は警告バッジ表示 */}
              {!(currentProject?.plot?.theme && currentProject?.plot?.setting && currentProject?.plot?.hook && currentProject?.plot?.protagonistGoal && currentProject?.plot?.mainObstacle) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                  未完了
                </span>
              )}
            </div>
            {isBasicSettingsExpanded ? (
              <ChevronUp className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            )}
          </button>
          {isBasicSettingsExpanded && (
            <div className="px-4 pb-4 border-t border-amber-200/50 dark:border-amber-700/50">
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'メインテーマ', value: currentProject?.plot?.theme },
                  { label: '舞台設定', value: currentProject?.plot?.setting },
                  { label: 'フック要素', value: currentProject?.plot?.hook },
                  { label: '主人公の目標', value: currentProject?.plot?.protagonistGoal },
                  { label: '主要な障害', value: currentProject?.plot?.mainObstacle },
                  { label: '物語の結末', value: currentProject?.plot?.ending },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-amber-200 dark:border-amber-700"
                  >
                    <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 font-['Noto_Sans_JP']">
                      {item.label}
                    </h4>
                    <p className={`text-sm font-['Noto_Sans_JP'] ${item.value
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-400 dark:text-gray-500 italic'
                      }`}>
                      {item.value || '未設定'}
                    </p>
                  </div>
                ))}
              </div>
              {/* ヒントメッセージ */}
              <div className="mt-3 p-2.5 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                {currentProject?.plot?.theme && currentProject?.plot?.setting && currentProject?.plot?.hook && currentProject?.plot?.protagonistGoal && currentProject?.plot?.mainObstacle ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                    💡 これらの基礎設定を参考に、一貫性のあるプロット構成を作成しましょう
                    {currentProject?.plot?.ending && (
                      <span className="block mt-1">✨ 結末が設定されているため、逆算プロンプティング機能が利用可能です</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                    ⚠️ プロット基礎設定が未完了です。より良いプロット作成のため、プロット基礎設定で設定を完了することをお勧めします。
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        onClose={() => setConfirmDialogState({ isOpen: false, type: null })}
        onConfirm={() => {
          if (confirmDialogState.type === 'clear-section') {
            handleConfirmClear();
          } else if (confirmDialogState.type === 'reset-structure') {
            handleConfirmResetStructure();
          } else if (confirmDialogState.type === 'save-over-limit') {
            handleConfirmSaveOverLimit();
          }
          setConfirmDialogState({ isOpen: false, type: null });
        }}
        title={
          confirmDialogState.type === 'clear-section'
            ? 'このセクションの内容をクリアしますか？'
            : confirmDialogState.type === 'reset-structure'
              ? (() => {
                const structureNames = {
                  'kishotenketsu': '起承転結',
                  'three-act': '三幕構成',
                  'four-act': '四幕構成',
                  'heroes-journey': 'ヒーローズ・ジャーニー',
                  'beat-sheet': 'ビートシート',
                  'mystery-suspense': 'ミステリー・サスペンス',
                };
                return `${structureNames[confirmDialogState.plotStructure!]}の内容をすべてリセットしますか？`;
              })()
              : confirmDialogState.type === 'save-over-limit'
                ? '⚠️ 文字数上限超過'
                : ''
        }
        message={
          confirmDialogState.type === 'save-over-limit'
            ? '一部のセクションで文字数が上限を超えています。\nこのまま保存しますか？'
            : ''
        }
        type={confirmDialogState.type === 'reset-structure' ? 'danger' : 'warning'}
        confirmLabel={
          confirmDialogState.type === 'clear-section'
            ? 'クリア'
            : confirmDialogState.type === 'reset-structure'
              ? 'リセット'
              : confirmDialogState.type === 'save-over-limit'
                ? '保存'
                : '確認'
        }
      />

      {/* 構成推定結果の確認モーダル */}
      {inferenceResult && (
        <StructureInferenceModal
          isOpen={!!inferenceResult}
          result={inferenceResult}
          onClose={() => setInferenceResult(null)}
          onApply={handleApplyInference}
        />
      )}
    </div>
  );
};
