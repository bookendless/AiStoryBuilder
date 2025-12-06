import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileText, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useProject, Project } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { getUserFriendlyError } from '../../utils/errorHandler';
import { useAutoSave } from '../common/hooks/useAutoSave';
import { AILoadingIndicator } from '../common/AILoadingIndicator';

// 定数定義
const TARGET_WORD_COUNT = 500; // 目標文字数

export const SynopsisStep: React.FC = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showError, showErrorWithDetails } = useToast();
  const [synopsis, setSynopsis] = useState(currentProject?.synopsis || '');
  const [isGenerating, setIsGenerating] = useState(false);

  // setTimeoutのクリーンアップ用のref
  const saveTimeoutRef = useRef<number | null>(null);

  // 自動保存
  const { isSaving, saveStatus, lastSaved, handleSave } = useAutoSave(
    synopsis,
    async (value: string) => {
      if (!currentProject) return;
      await updateProject({ synopsis: value }, false);
    }
  );

  // プロジェクトが変更されたときにあらすじを初期化
  useEffect(() => {
    if (currentProject?.synopsis !== undefined) {
      setSynopsis(currentProject.synopsis || '');
    }
  }, [currentProject?.synopsis, currentProject?.id]);

  // setTimeoutのクリーンアップ
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // キャラクター情報を構築する関数
  const buildCharactersInfo = useCallback((characters: Project['characters']) => {
    if (!characters || characters.length === 0) {
      return 'キャラクター情報が設定されていません';
    }
    return characters.map(c =>
      `【${c.name}】\n` +
      `役割: ${c.role}\n` +
      `外見: ${c.appearance || '未設定'}\n` +
      `性格: ${c.personality || '未設定'}\n` +
      `背景: ${c.background || '未設定'}\n`
    ).join('\n');
  }, []);

  // プロット基本設定情報を構築する関数
  const buildBasicPlotInfo = useCallback((plot: Project['plot']) => {
    if (!plot) return '';
    return [
      `メインテーマ: ${plot.theme || '未設定'}`,
      `舞台設定: ${plot.setting || '未設定'}`,
      `フック要素: ${plot.hook || '未設定'}`,
      `主人公の目標: ${plot.protagonistGoal || '未設定'}`,
      `主要な障害: ${plot.mainObstacle || '未設定'}`
    ].join('\n');
  }, []);

  // PlotStep2の詳細構成情報を構築する関数
  const buildDetailedStructureInfo = useCallback((plot: Project['plot']) => {
    if (!plot) return '物語構造の詳細が設定されていません';

    switch (plot.structure) {
      case 'kishotenketsu':
        return [
          `【起承転結構成】`,
          `起（導入）: ${plot.ki || '未設定'}`,
          `承（展開）: ${plot.sho || '未設定'}`,
          `転（転換）: ${plot.ten || '未設定'}`,
          `結（結末）: ${plot.ketsu || '未設定'}`
        ].join('\n');
      case 'three-act':
        return [
          `【三幕構成】`,
          `第1幕（導入）: ${plot.act1 || '未設定'}`,
          `第2幕（展開）: ${plot.act2 || '未設定'}`,
          `第3幕（結末）: ${plot.act3 || '未設定'}`
        ].join('\n');
      case 'four-act':
        return [
          `【四幕構成】`,
          `第1幕（秩序）: ${plot.fourAct1 || '未設定'}`,
          `第2幕（混沌）: ${plot.fourAct2 || '未設定'}`,
          `第3幕（秩序）: ${plot.fourAct3 || '未設定'}`,
          `第4幕（混沌）: ${plot.fourAct4 || '未設定'}`
        ].join('\n');
      case 'heroes-journey':
        return [
          `【ヒーローズ・ジャーニー】`,
          `日常の世界: ${plot.hj1 || '未設定'}`,
          `冒険への誘い: ${plot.hj2 || '未設定'}`,
          `境界越え: ${plot.hj3 || '未設定'}`,
          `試練と仲間: ${plot.hj4 || '未設定'}`,
          `最大の試練: ${plot.hj5 || '未設定'}`,
          `報酬: ${plot.hj6 || '未設定'}`,
          `帰路: ${plot.hj7 || '未設定'}`,
          `復活と帰還: ${plot.hj8 || '未設定'}`
        ].join('\n');
      case 'beat-sheet':
        return [
          `【ビートシート】`,
          `導入 (Setup): ${plot.bs1 || '未設定'}`,
          `決断 (Break into Two): ${plot.bs2 || '未設定'}`,
          `試練 (Fun and Games): ${plot.bs3 || '未設定'}`,
          `転換点 (Midpoint): ${plot.bs4 || '未設定'}`,
          `危機 (All Is Lost): ${plot.bs5 || '未設定'}`,
          `クライマックス (Finale): ${plot.bs6 || '未設定'}`,
          `結末 (Final Image): ${plot.bs7 || '未設定'}`
        ].join('\n');
      case 'mystery-suspense':
        return [
          `【ミステリー・サスペンス構成】`,
          `発端（事件発生）: ${plot.ms1 || '未設定'}`,
          `捜査（初期）: ${plot.ms2 || '未設定'}`,
          `仮説とミスリード: ${plot.ms3 || '未設定'}`,
          `第二の事件/急展開: ${plot.ms4 || '未設定'}`,
          `手がかりの統合: ${plot.ms5 || '未設定'}`,
          `解決（真相解明）: ${plot.ms6 || '未設定'}`,
          `エピローグ: ${plot.ms7 || '未設定'}`
        ].join('\n');
      default:
        return '物語構造の詳細が設定されていません';
    }
  }, []);

  // プロジェクトの基本情報を構築する関数
  const buildProjectInfo = useCallback((project: Project | null) => {
    if (!project) return '';
    return [
      `作品タイトル: ${project.title || '無題'}`,
      `メインジャンル: ${project.mainGenre || project.genre || '未設定'}`,
      `サブジャンル: ${project.subGenre || '未設定'}`,
      `ターゲット読者: ${project.targetReader || '未設定'}`,
      `プロジェクトテーマ: ${project.projectTheme || '未設定'}`,
      `作品説明: ${project.description || '未設定'}`
    ].join('\n');
  }, []);

  // メモ化されたプロンプト構築用の情報
  const promptVariables = useMemo(() => {
    if (!currentProject) return null;

    const charactersInfo = buildCharactersInfo(currentProject.characters);
    const basicPlotInfo = buildBasicPlotInfo(currentProject.plot);
    const detailedStructureInfo = buildDetailedStructureInfo(currentProject.plot);
    const projectInfo = buildProjectInfo(currentProject);

    return {
      title: currentProject.title || '無題',
      projectInfo,
      characters: charactersInfo,
      basicPlotInfo,
      detailedStructureInfo,
    };
  }, [currentProject, buildCharactersInfo, buildBasicPlotInfo, buildDetailedStructureInfo, buildProjectInfo]);

  const handleAIGenerate = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
        details: 'AI機能を使用するには、ヘッダーの「AI設定」ボタンからAPIキーを設定する必要があります。',
        action: {
          label: '設定を開く',
          onClick: () => {
            // ヘッダーの設定ボタンをクリックする処理は、親コンポーネントで実装
            // ここでは単にエラーを表示
          },
        },
      });
      return;
    }

    if (!promptVariables) {
      showError('プロジェクト情報が不足しています。');
      return;
    }

    setIsGenerating(true);

    try {
      const prompt = aiService.buildPrompt('synopsis', 'generate', promptVariables);

      const response = await aiService.generateContent({
        prompt,
        type: 'synopsis',
        settings,
      });
      // コンソールにログ出力のみ
      console.log('AI Synopsis Generated');
      if (response.error) {
        const errorInfo = getUserFriendlyError(response.error);
        showErrorWithDetails(
          errorInfo.title,
          errorInfo.message,
          errorInfo.details,
          errorInfo.retryable ? {
            label: '再試行',
            onClick: () => handleAIGenerate(),
            variant: 'primary',
          } : undefined
        );
        return;
      }

      setSynopsis(response.content);

      // AI生成後は即座に保存
      setTimeout(() => {
        handleSave();
      }, 500);

    } catch (error) {
      console.error('AI generation error:', error);
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showErrorWithDetails(
        errorInfo.title,
        errorInfo.message,
        errorInfo.details,
        errorInfo.retryable ? {
          label: '再試行',
          onClick: () => handleAIGenerate(),
          variant: 'primary',
        } : undefined
      );
    } finally {
      setIsGenerating(false);
    }
  };



  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  const wordCount = synopsis.length;
  const targetWordCount = TARGET_WORD_COUNT;

  return (
    <div className="max-w-6xl mx-auto">
      {/* AI生成中のローディングインジケーター */}
      {isGenerating && (
        <div className="mb-6">
          <AILoadingIndicator
            message="あらすじを生成中"
            estimatedTime={45}
            variant="inline"
          />
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-indigo-400 to-blue-500">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            あらすじ作成
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          物語全体の概要をまとめましょう。AIが文体調整と要約生成をサポートします。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    物語のあらすじ
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    {wordCount} / {targetWordCount} 文字
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                </div>
              </div>
            </div>

            {/* Editor */}
            <div className="p-6">
              <textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="物語のあらすじを記述してください...&#10;&#10;例：&#10;平凡な高校生の田中太郎は、ある日不思議な光に包まれ異世界に転移してしまう。そこは魔法が存在し、様々な種族が共存する世界だった。太郎は持ち前の優しさと現代の知識を活かして仲間たちと協力し、世界を脅かす魔王との戦いに挑むことになる。果たして太郎は元の世界に帰ることができるのだろうか..."
                rows={20}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none"
              />

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    文字数進捗
                  </span>
                  <span className={`font-semibold ${wordCount >= targetWordCount
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                    }`}>
                    {wordCount} / {targetWordCount} 文字 ({Math.min((wordCount / targetWordCount) * 100, 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${wordCount >= targetWordCount
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }`}
                    style={{ width: `${Math.min((wordCount / targetWordCount) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-2xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  {saveStatus === 'saving' && (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                      <span className="text-sm text-indigo-600 dark:text-indigo-400 font-['Noto_Sans_JP']">
                        保存中...
                      </span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">
                        保存完了
                      </span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                        保存エラー
                      </span>
                    </>
                  )}
                  {saveStatus === 'idle' && (
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      自動保存されます
                    </span>
                  )}
                  {lastSaved && saveStatus === 'idle' && (
                    <span className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                      ({lastSaved.toLocaleTimeString()})
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? '保存中...' : '保存する'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};