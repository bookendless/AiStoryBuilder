import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Sparkles, RotateCcw, Save, CheckCircle, AlertCircle, ChevronDown, ChevronUp, GripVertical, Copy, Download } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { getUserFriendlyError } from '../../utils/errorHandler';

interface AILogEntry {
  id: string;
  timestamp: Date;
  type: 'generate' | 'readable' | 'summary' | 'engaging';
  prompt: string;
  response: string;
  error?: string;
}

export const SynopsisStep: React.FC = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showSuccess, showError, showErrorWithDetails } = useToast();
  const [synopsis, setSynopsis] = useState(currentProject?.synopsis || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  const [activeStyleType, setActiveStyleType] = useState<string | null>(null);

  // 自動保存関連の状態
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSynopsisRef = useRef<string>('');

  // AIログ管理
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);

  // サイドバー項目の管理
  type SidebarItemId = 'styleAssistant' | 'characters' | 'plotInfo' | 'aiLogs';
  const [sidebarItemOrder, setSidebarItemOrder] = useState<SidebarItemId[]>(['styleAssistant', 'characters', 'plotInfo', 'aiLogs']);
  const [expandedSidebarItems, setExpandedSidebarItems] = useState<Set<SidebarItemId>>(new Set(['styleAssistant']));
  const [draggedSidebarIndex, setDraggedSidebarIndex] = useState<number | null>(null);
  const [dragOverSidebarIndex, setDragOverSidebarIndex] = useState<number | null>(null);

  // プロジェクトが変更されたときにあらすじを初期化
  useEffect(() => {
    if (currentProject) {
      setSynopsis(currentProject.synopsis || '');
      lastSynopsisRef.current = currentProject.synopsis || '';
    }
  }, [currentProject]);

  // 保存処理
  const performSave = useCallback(async (immediate: boolean = false) => {
    if (!currentProject || synopsis === lastSynopsisRef.current) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await updateProject({ synopsis }, immediate);
      lastSynopsisRef.current = synopsis;
      setLastSaved(new Date());
      setSaveStatus('saved');

      // 3秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');

      // 5秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, synopsis, updateProject]);

  // 自動保存機能
  useEffect(() => {
    // 前回の保存内容と異なる場合のみ保存
    if (synopsis !== lastSynopsisRef.current && currentProject) {
      // 既存のタイムアウトをクリア
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 2秒後に自動保存を実行
      saveTimeoutRef.current = setTimeout(async () => {
        await performSave();
      }, 2000);
    }

    // クリーンアップ
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [synopsis, currentProject, performSave]);

  const handleSave = async () => {
    await performSave(true); // 即座に保存
  };

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

    setIsGenerating(true);

    try {
      // キャラクター情報を詳細に構築
      const charactersInfo = currentProject?.characters && currentProject.characters.length > 0
        ? currentProject.characters.map(c =>
          `【${c.name}】\n` +
          `役割: ${c.role}\n` +
          `外見: ${c.appearance || '未設定'}\n` +
          `性格: ${c.personality || '未設定'}\n` +
          `背景: ${c.background || '未設定'}\n`
        ).join('\n')
        : 'キャラクター情報が設定されていません';

      // プロット基本設定情報を構築
      const basicPlotInfo = [
        `メインテーマ: ${currentProject?.plot.theme || '未設定'}`,
        `舞台設定: ${currentProject?.plot.setting || '未設定'}`,
        `フック要素: ${currentProject?.plot.hook || '未設定'}`,
        `主人公の目標: ${currentProject?.plot.protagonistGoal || '未設定'}`,
        `主要な障害: ${currentProject?.plot.mainObstacle || '未設定'}`
      ].join('\n');

      // PlotStep2の詳細構成情報を構築
      let detailedStructureInfo = '';
      if (currentProject?.plot.structure === 'kishotenketsu') {
        detailedStructureInfo = [
          `【起承転結構成】`,
          `起（導入）: ${currentProject.plot.ki || '未設定'}`,
          `承（展開）: ${currentProject.plot.sho || '未設定'}`,
          `転（転換）: ${currentProject.plot.ten || '未設定'}`,
          `結（結末）: ${currentProject.plot.ketsu || '未設定'}`
        ].join('\n');
      } else if (currentProject?.plot.structure === 'three-act') {
        detailedStructureInfo = [
          `【三幕構成】`,
          `第1幕（導入）: ${currentProject.plot.act1 || '未設定'}`,
          `第2幕（展開）: ${currentProject.plot.act2 || '未設定'}`,
          `第3幕（結末）: ${currentProject.plot.act3 || '未設定'}`
        ].join('\n');
      } else if (currentProject?.plot.structure === 'four-act') {
        detailedStructureInfo = [
          `【四幕構成】`,
          `第1幕（秩序）: ${currentProject.plot.fourAct1 || '未設定'}`,
          `第2幕（混沌）: ${currentProject.plot.fourAct2 || '未設定'}`,
          `第3幕（秩序）: ${currentProject.plot.fourAct3 || '未設定'}`,
          `第4幕（混沌）: ${currentProject.plot.fourAct4 || '未設定'}`
        ].join('\n');
      } else {
        detailedStructureInfo = '物語構造の詳細が設定されていません';
      }

      // プロジェクトの基本情報
      const projectInfo = [
        `作品タイトル: ${currentProject?.title || '無題'}`,
        `メインジャンル: ${currentProject?.mainGenre || currentProject?.genre || '未設定'}`,
        `サブジャンル: ${currentProject?.subGenre || '未設定'}`,
        `ターゲット読者: ${currentProject?.targetReader || '未設定'}`,
        `プロジェクトテーマ: ${currentProject?.projectTheme || '未設定'}`,
        `作品説明: ${currentProject?.description || '未設定'}`
      ].join('\n');

      const variables = {
        title: currentProject?.title || '無題',
        projectInfo: projectInfo,
        characters: charactersInfo,
        basicPlotInfo: basicPlotInfo,
        detailedStructureInfo: detailedStructureInfo,
      };

      const prompt = aiService.buildPrompt('synopsis', 'generate', variables);

      const response = await aiService.generateContent({
        prompt,
        type: 'synopsis',
        settings,
      });

      // AIログに記録
      const logEntry: AILogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: 'generate',
        prompt,
        response: response.content || '',
        error: response.error,
      };
      setAiLogs(prev => [logEntry, ...prev.slice(0, 9)]); // 最新10件を保持

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
        performSave();
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

  const handleReset = () => {
    setSynopsis('');
  };

  // サイドバー項目の展開/折りたたみ
  const toggleSidebarExpansion = (itemId: SidebarItemId) => {
    setExpandedSidebarItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // サイドバー項目のドラッグ開始
  const handleSidebarDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSidebarIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // サイドバー項目のドラッグ中
  const handleSidebarDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSidebarIndex !== null && draggedSidebarIndex !== index) {
      setDragOverSidebarIndex(index);
    }
  };

  // サイドバー項目のドラッグ離脱
  const handleSidebarDragLeave = () => {
    setDragOverSidebarIndex(null);
  };

  // サイドバー項目のドロップ
  const handleSidebarDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedSidebarIndex === null || draggedSidebarIndex === dropIndex) {
      setDragOverSidebarIndex(null);
      return;
    }

    const items = [...sidebarItemOrder];
    const draggedItem = items[draggedSidebarIndex];

    // ドラッグされた項目を削除
    items.splice(draggedSidebarIndex, 1);

    // 新しい位置に挿入
    items.splice(dropIndex, 0, draggedItem);

    setSidebarItemOrder(items);
    setDraggedSidebarIndex(null);
    setDragOverSidebarIndex(null);
    showSuccess('サイドバー項目の並び順を変更しました');
  };

  // サイドバー項目のドラッグ終了
  const handleSidebarDragEnd = () => {
    setDraggedSidebarIndex(null);
    setDragOverSidebarIndex(null);
  };

  // AIログをコピー
  const handleCopyLog = (log: AILogEntry) => {
    const logText = `【AIログ - ${log.type === 'generate' ? 'あらすじ生成' : log.type === 'readable' ? '読みやすく調整' : log.type === 'summary' ? '要点抽出' : '魅力的に演出'}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}`;

    navigator.clipboard.writeText(logText);
    showSuccess('ログをクリップボードにコピーしました');
  };

  // AIログをダウンロード
  const handleDownloadLogs = () => {
    const logsText = aiLogs.map(log =>
      `【AIログ - ${log.type === 'generate' ? 'あらすじ生成' : log.type === 'readable' ? '読みやすく調整' : log.type === 'summary' ? '要点抽出' : '魅力的に演出'}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${'='.repeat(80)}`
    ).join('\n\n');

    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synopsis_ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('ログをダウンロードしました');
  };

  // 文体調整AI機能
  const handleStyleAdjustment = async (styleType: string) => {
    if (!isConfigured) {
      showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
        details: 'AI機能を使用するには、ヘッダーの「AI設定」ボタンからAPIキーを設定する必要があります。',
      });
      return;
    }

    if (!synopsis.trim()) {
      showErrorWithDetails('入力が必要', 'あらすじが入力されていません。まずあらすじを入力してください。', '文体調整を行うには、先にあらすじを入力する必要があります。');
      return;
    }

    setIsGeneratingStyle(true);
    setActiveStyleType(styleType);

    try {
      let prompt = '';

      // プロンプトの構築
      if (styleType === 'readable') {
        prompt = aiService.buildPrompt('synopsis', 'improveReadable', {
          synopsis: synopsis,
        });
      } else if (styleType === 'summary') {
        prompt = aiService.buildPrompt('synopsis', 'improveSummary', {
          synopsis: synopsis,
        });
      } else if (styleType === 'engaging') {
        prompt = aiService.buildPrompt('synopsis', 'improveEngaging', {
          synopsis: synopsis,
        });
      }

      const response = await aiService.generateContent({
        prompt,
        type: 'synopsis',
        settings,
      });

      // AIログに記録
      const logEntry: AILogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: styleType as 'readable' | 'summary' | 'engaging',
        prompt,
        response: response.content || '',
        error: response.error,
      };
      setAiLogs(prev => [logEntry, ...prev.slice(0, 9)]); // 最新10件を保持

      if (response.error) {
        const errorInfo = getUserFriendlyError(response.error);
        showErrorWithDetails(
          errorInfo.title,
          errorInfo.message,
          errorInfo.details,
          errorInfo.retryable ? {
            label: '再試行',
            onClick: () => handleStyleAdjustment(styleType),
            variant: 'primary',
          } : undefined
        );
        return;
      }

      setSynopsis(response.content);

      // 文体調整後は即座に保存
      setTimeout(() => {
        performSave();
      }, 500);

    } catch (error) {
      console.error('Style adjustment error:', error);
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showErrorWithDetails(
        errorInfo.title,
        errorInfo.message,
        errorInfo.details || 'ブラウザのコンソールを確認してください。',
        errorInfo.retryable ? {
          label: '再試行',
          onClick: () => handleStyleAdjustment(styleType),
          variant: 'primary',
        } : undefined
      );
    } finally {
      setIsGeneratingStyle(false);
      setActiveStyleType(null);
    }
  };

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  const wordCount = synopsis.length;
  const targetWordCount = 500;

  return (
    <div className="max-w-6xl mx-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
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

            {/* AI Proposal Section */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-indigo-200 dark:border-indigo-700">
                <h4 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-3 font-['Noto_Sans_JP']">
                  AIあらすじ提案について
                </h4>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-['Noto_Sans_JP'] mb-3">
                  プロジェクトの基本設定、キャラクター情報、プロット構成に基づいて、一貫性のある物語のあらすじを自動生成します。
                </p>
                <ul className="space-y-1 text-xs text-indigo-500 dark:text-indigo-400 font-['Noto_Sans_JP'] mb-4">
                  <li>• キャラクターの関係性と成長を反映した物語の流れ</li>
                  <li>• プロット構成（起承転結/三幕構成/四幕構成）に沿った展開</li>
                  <li>• ジャンルとテーマに適した文体と表現</li>
                </ul>

                <div className="flex space-x-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 px-4 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 hover:scale-105 text-white flex items-center justify-center space-x-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>リセット</span>
                  </button>
                  <button
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP'] shadow-lg hover:shadow-xl"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="h-5 w-5 animate-spin" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        <span>あらすじをAI提案</span>
                      </>
                    )}
                  </button>
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

        {/* AI Assistant Panel */}
        <div className="space-y-6">
          {sidebarItemOrder.map((itemId, index) => {
            const isExpanded = expandedSidebarItems.has(itemId);
            const isDragged = draggedSidebarIndex === index;
            const isDragOver = dragOverSidebarIndex === index;

            // 文体アシスタント項目
            if (itemId === 'styleAssistant') {
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, index)}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDragLeave={handleSidebarDragLeave}
                  onDrop={(e) => handleSidebarDrop(e, index)}
                  onDragEnd={handleSidebarDragEnd}
                  className={`bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-900/20 dark:to-purple-800/20 rounded-2xl border transition-all duration-200 ${isDragged
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-indigo-200 dark:border-purple-800 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-6 cursor-pointer"
                    onClick={() => toggleSidebarExpansion(itemId)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        文体アシスタント
                      </h3>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-6 space-y-4">
                      <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                        AIがあらすじの文体を調整します：
                      </p>

                      <div className="space-y-3">
                        <button
                          onClick={() => handleStyleAdjustment('readable')}
                          disabled={isGeneratingStyle || !synopsis.trim()}
                          className={`w-full p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${isGeneratingStyle && activeStyleType === 'readable'
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-2 border-blue-400'
                              : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                            } ${!synopsis.trim() ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="bg-white/20 p-2 rounded-lg">
                                <FileText className="h-5 w-5 text-white" />
                              </div>
                              <div className="text-left">
                                <div className="font-bold text-white text-lg font-['Noto_Sans_JP']">読みやすく調整</div>
                                <div className="text-blue-100 text-sm font-['Noto_Sans_JP']">文章を整理して理解しやすく</div>
                              </div>
                            </div>
                            {isGeneratingStyle && activeStyleType === 'readable' ? (
                              <Sparkles className="h-5 w-5 text-white animate-spin" />
                            ) : (
                              <Sparkles className="h-5 w-5 text-white" />
                            )}
                          </div>
                        </button>

                        <button
                          onClick={() => handleStyleAdjustment('summary')}
                          disabled={isGeneratingStyle || !synopsis.trim()}
                          className={`w-full p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${isGeneratingStyle && activeStyleType === 'summary'
                              ? 'bg-gradient-to-r from-green-500 to-green-600 border-2 border-green-400'
                              : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                            } ${!synopsis.trim() ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="bg-white/20 p-2 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-white" />
                              </div>
                              <div className="text-left">
                                <div className="font-bold text-white text-lg font-['Noto_Sans_JP']">要点抽出</div>
                                <div className="text-green-100 text-sm font-['Noto_Sans_JP']">重要なポイントを抽出</div>
                              </div>
                            </div>
                            {isGeneratingStyle && activeStyleType === 'summary' ? (
                              <Sparkles className="h-5 w-5 text-white animate-spin" />
                            ) : (
                              <Sparkles className="h-5 w-5 text-white" />
                            )}
                          </div>
                        </button>

                        <button
                          onClick={() => handleStyleAdjustment('engaging')}
                          disabled={isGeneratingStyle || !synopsis.trim()}
                          className={`w-full p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${isGeneratingStyle && activeStyleType === 'engaging'
                              ? 'bg-gradient-to-r from-purple-500 to-purple-600 border-2 border-purple-400'
                              : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                            } ${!synopsis.trim() ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="bg-white/20 p-2 rounded-lg">
                                <Sparkles className="h-5 w-5 text-white" />
                              </div>
                              <div className="text-left">
                                <div className="font-bold text-white text-lg font-['Noto_Sans_JP']">魅力的に演出</div>
                                <div className="text-purple-100 text-sm font-['Noto_Sans_JP']">読者の興味を引く表現に</div>
                              </div>
                            </div>
                            {isGeneratingStyle && activeStyleType === 'engaging' ? (
                              <Sparkles className="h-5 w-5 text-white animate-spin" />
                            ) : (
                              <Sparkles className="h-5 w-5 text-white" />
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // キャラクター情報項目
            if (itemId === 'characters') {
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, index)}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDragLeave={handleSidebarDragLeave}
                  onDrop={(e) => handleSidebarDrop(e, index)}
                  onDragEnd={handleSidebarDragEnd}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border transition-all duration-200 ${isDragged
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-100 dark:border-gray-700 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-6 cursor-pointer"
                    onClick={() => toggleSidebarExpansion(itemId)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        キャラクター情報
                      </h3>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-6">
                      {currentProject.characters.length > 0 ? (
                        <div className="space-y-3">
                          {currentProject.characters.slice(0, 3).map((character) => (
                            <div key={character.id} className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-bold">
                                  {character.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']">
                                  {character.name}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                  {character.role}
                                </div>
                              </div>
                            </div>
                          ))}
                          {currentProject.characters.length > 3 && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                              他 {currentProject.characters.length - 3} 人
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-['Noto_Sans_JP']">
                          キャラクターが設定されていません
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // プロット情報項目
            if (itemId === 'plotInfo') {
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, index)}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDragLeave={handleSidebarDragLeave}
                  onDrop={(e) => handleSidebarDrop(e, index)}
                  onDragEnd={handleSidebarDragEnd}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border transition-all duration-200 ${isDragged
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-100 dark:border-gray-700 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-6 cursor-pointer"
                    onClick={() => toggleSidebarExpansion(itemId)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        プロット情報
                      </h3>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-6">
                      {currentProject.plot.theme ? (
                        <div className="space-y-3 text-sm">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">基本設定:</div>
                            <div className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                              <div>テーマ: {currentProject.plot.theme.substring(0, 30)}...</div>
                              <div>舞台: {currentProject.plot.setting.substring(0, 30)}...</div>
                              <div>フック: {currentProject.plot.hook.substring(0, 30)}...</div>
                              <div>主人公の目標: {currentProject.plot.protagonistGoal ? currentProject.plot.protagonistGoal.substring(0, 30) + '...' : '未設定'}</div>
                              <div>主要な障害: {currentProject.plot.mainObstacle ? currentProject.plot.mainObstacle.substring(0, 30) + '...' : '未設定'}</div>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">構造詳細:</div>
                            <div className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                              {currentProject.plot.structure === 'kishotenketsu' ? (
                                <div>
                                  <div>起: {currentProject.plot.ki ? currentProject.plot.ki.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>承: {currentProject.plot.sho ? currentProject.plot.sho.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>転: {currentProject.plot.ten ? currentProject.plot.ten.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>結: {currentProject.plot.ketsu ? currentProject.plot.ketsu.substring(0, 20) + '...' : '未設定'}</div>
                                </div>
                              ) : currentProject.plot.structure === 'three-act' ? (
                                <div>
                                  <div>第1幕: {currentProject.plot.act1 ? currentProject.plot.act1.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>第2幕: {currentProject.plot.act2 ? currentProject.plot.act2.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>第3幕: {currentProject.plot.act3 ? currentProject.plot.act3.substring(0, 20) + '...' : '未設定'}</div>
                                </div>
                              ) : currentProject.plot.structure === 'four-act' ? (
                                <div>
                                  <div>第1幕（秩序）: {currentProject.plot.fourAct1 ? currentProject.plot.fourAct1.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>第2幕（混沌）: {currentProject.plot.fourAct2 ? currentProject.plot.fourAct2.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>第3幕（秩序）: {currentProject.plot.fourAct3 ? currentProject.plot.fourAct3.substring(0, 20) + '...' : '未設定'}</div>
                                  <div>第4幕（混沌）: {currentProject.plot.fourAct4 ? currentProject.plot.fourAct4.substring(0, 20) + '...' : '未設定'}</div>
                                </div>
                              ) : (
                                <div>構造詳細が設定されていません</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-['Noto_Sans_JP']">
                          プロットが設定されていません
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // AIログ項目
            if (itemId === 'aiLogs') {
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, index)}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDragLeave={handleSidebarDragLeave}
                  onDrop={(e) => handleSidebarDrop(e, index)}
                  onDragEnd={handleSidebarDragEnd}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border transition-all duration-200 ${isDragged
                    ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                    : isDragOver
                      ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-100 dark:border-gray-700 cursor-move hover:shadow-xl'
                    }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleSidebarExpansion(itemId)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        AIログ
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!isExpanded && aiLogs.length > 0 && (
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
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {aiLogs.length === 0 ? (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-['Noto_Sans_JP']">
                            AIログがありません
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                            AI生成を実行すると、ここにログが表示されます
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={handleDownloadLogs}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="ログをダウンロード"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {aiLogs.map((log) => (
                          <div key={log.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${log.type === 'generate'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : log.type === 'readable'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : log.type === 'summary'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                  }`}>
                                  {log.type === 'generate' ? '生成' : log.type === 'readable' ? '読みやすく' : log.type === 'summary' ? '要点抽出' : '魅力的に'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {log.timestamp.toLocaleString('ja-JP', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                <button
                                  onClick={() => handleCopyLog(log)}
                                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                  title="ログをコピー"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {log.error ? (
                              <div className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                                <strong>エラー:</strong> {log.error}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                <div className="mb-2">
                                  <strong>プロンプト:</strong>
                                  <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded border text-xs max-h-20 overflow-y-auto">
                                    {log.prompt.substring(0, 200)}...
                                  </div>
                                </div>
                                <div>
                                  <strong>応答:</strong>
                                  <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded border text-xs max-h-20 overflow-y-auto">
                                    {log.response.substring(0, 300)}...
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                          </div>
                        </>
                      )}
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