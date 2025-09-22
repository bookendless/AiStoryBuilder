import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Sparkles, RotateCcw, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';

export const SynopsisStep: React.FC = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
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

  // プロジェクトが変更されたときにあらすじを初期化
  useEffect(() => {
    if (currentProject) {
      setSynopsis(currentProject.synopsis || '');
      lastSynopsisRef.current = currentProject.synopsis || '';
    }
  }, [currentProject]);

  // 保存処理
  const performSave = useCallback(async () => {
    if (!currentProject || synopsis === lastSynopsisRef.current) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await updateProject({ synopsis });
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
    await performSave();
  };

  const handleAIGenerate = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
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

      if (response.error) {
        alert(`AI生成エラー: ${response.error}`);
        return;
      }

      setSynopsis(response.content);
      
      // AI生成後は即座に保存
      setTimeout(() => {
        performSave();
      }, 500);
      
    } catch (_error) {
      alert('AI生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setSynopsis('');
  };

  // 文体調整AI機能
  const handleStyleAdjustment = async (styleType: string) => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    if (!synopsis.trim()) {
      alert('あらすじが入力されていません。まずあらすじを入力してください。');
      return;
    }

    setIsGeneratingStyle(true);
    setActiveStyleType(styleType);

    try {
      let prompt = '';
      
      // プロンプトの構築
      if (styleType === 'readable') {
        prompt = `以下のあらすじを読みやすく調整してください。文章を整理し、理解しやすく、流れの良い文章に修正してください。

【現在のあらすじ】
${synopsis}

【調整方針】
- 文章の流れを自然にする
- 重複や冗長な表現を整理する
- 読み手が理解しやすい構造にする
- 物語の魅力は保ちつつ、簡潔で分かりやすくする

【出力形式】
調整されたあらすじのみを出力してください。`;
      } else if (styleType === 'summary') {
        prompt = `以下のあらすじから重要なポイントを抽出し、要約版を作成してください。

【現在のあらすじ】
${synopsis}

【要約方針】
- 物語の核心となる要素を抽出
- 主人公の動機と目標を明確にする
- 重要な出来事と転換点を簡潔に表現
- 読者の興味を引く要素を残す

【出力形式】
要約されたあらすじのみを出力してください。`;
      } else if (styleType === 'engaging') {
        prompt = `以下のあらすじをより魅力的で読者の興味を引く表現に調整してください。

【現在のあらすじ】
${synopsis}

【演出方針】
- 読者の好奇心を刺激する表現を使う
- 感情に訴える描写を強化する
- 物語の魅力を際立たせる
- 読者を引き込む力強い文章にする

【出力形式】
魅力的に演出されたあらすじのみを出力してください。`;
      }

      const response = await aiService.generateContent({
        prompt,
        type: 'synopsis',
        settings,
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}`);
        return;
      }

      setSynopsis(response.content);
      
      // 文体調整後は即座に保存
      setTimeout(() => {
        performSave();
      }, 500);
      
    } catch (error) {
      console.error('Style adjustment error:', error);
      alert('AI生成中にエラーが発生しました。ブラウザのコンソールを確認してください。');
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          あらすじ作成
        </h1>
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
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      物語のあらすじ
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {wordCount} / {targetWordCount} 文字
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center space-x-1 px-3 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>リセット</span>
                  </button>
                  <button
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                  >
                    <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>{isGenerating ? '生成中...' : 'あらすじをAI提案'}</span>
                  </button>
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
                  <span className={`font-semibold ${
                    wordCount >= targetWordCount 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {wordCount} / {targetWordCount} 文字 ({Math.min((wordCount / targetWordCount) * 100, 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      wordCount >= targetWordCount 
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

        {/* AI Assistant Panel */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-indigo-200 dark:border-purple-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                文体アシスタント
              </h3>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4 font-['Noto_Sans_JP']">
              AIがあらすじの文体を調整します：
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={() => handleStyleAdjustment('readable')}
                disabled={isGeneratingStyle || !synopsis.trim()}
                className={`w-full p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  isGeneratingStyle && activeStyleType === 'readable'
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
                className={`w-full p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  isGeneratingStyle && activeStyleType === 'summary'
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
                className={`w-full p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  isGeneratingStyle && activeStyleType === 'engaging'
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

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
              キャラクター情報
            </h3>
            
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

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
              プロット情報
            </h3>
            
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
        </div>
      </div>
    </div>
  );
};