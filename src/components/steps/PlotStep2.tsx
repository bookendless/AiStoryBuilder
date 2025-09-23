import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Check, Play, Zap, Target, Heart, RotateCcw, Loader2, Layers } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';

type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'export';

interface PlotStep2Props {
  onNavigateToStep?: (step: Step) => void;
}

export const PlotStep2: React.FC<PlotStep2Props> = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [plotStructure, setPlotStructure] = useState<'kishotenketsu' | 'three-act' | 'four-act'>('kishotenketsu');
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

  // 自動保存機能（デバウンス付き）
  useEffect(() => {
    if (!currentProject) return;
    
    const timeoutId = setTimeout(async () => {
      // フォームデータが変更されている場合のみ保存
      const hasChanges = 
        formData.ki !== (currentProject.plot?.ki || '') ||
        formData.sho !== (currentProject.plot?.sho || '') ||
        formData.ten !== (currentProject.plot?.ten || '') ||
        formData.ketsu !== (currentProject.plot?.ketsu || '') ||
        formData.act1 !== (currentProject.plot?.act1 || '') ||
        formData.act2 !== (currentProject.plot?.act2 || '') ||
        formData.act3 !== (currentProject.plot?.act3 || '') ||
        formData.fourAct1 !== (currentProject.plot?.fourAct1 || '') ||
        formData.fourAct2 !== (currentProject.plot?.fourAct2 || '') ||
        formData.fourAct3 !== (currentProject.plot?.fourAct3 || '') ||
        formData.fourAct4 !== (currentProject.plot?.fourAct4 || '');
      
      if (hasChanges) {
        // 直接保存処理を実行
        setIsSaving(true);
        setSaveStatus('saving');
        
        try {
          // 既存のplotデータを保持しつつ、構成詳細のみを更新
          const updatedPlot = {
            ...currentProject.plot,
            structure: plotStructure,
          };

          if (plotStructure === 'kishotenketsu') {
            updatedPlot.ki = formData.ki;
            updatedPlot.sho = formData.sho;
            updatedPlot.ten = formData.ten;
            updatedPlot.ketsu = formData.ketsu;
          } else if (plotStructure === 'three-act') {
            updatedPlot.act1 = formData.act1;
            updatedPlot.act2 = formData.act2;
            updatedPlot.act3 = formData.act3;
          } else if (plotStructure === 'four-act') {
            updatedPlot.fourAct1 = formData.fourAct1;
            updatedPlot.fourAct2 = formData.fourAct2;
            updatedPlot.fourAct3 = formData.fourAct3;
            updatedPlot.fourAct4 = formData.fourAct4;
          }

          await updateProject({
            plot: updatedPlot,
          });
          
          setSaveStatus('saved');
          console.log('Plot structure data auto-saved successfully:', formData);
          
          // 3秒後にステータスをリセット
          setTimeout(() => {
            setSaveStatus('idle');
          }, 3000);
          
        } catch (error) {
          console.error('Auto-save error:', error);
          setSaveStatus('error');
          
          // 5秒後にステータスをリセット
          setTimeout(() => {
            setSaveStatus('idle');
          }, 5000);
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000); // 2秒後に自動保存

    return () => clearTimeout(timeoutId);
  }, [formData, currentProject, plotStructure, updateProject]);

  const handleSave = useCallback(async () => {
    if (!currentProject) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // 既存のplotデータを保持しつつ、構成詳細のみを更新
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

      await updateProject({
        plot: updatedPlot,
      });
      
      setSaveStatus('saved');
      console.log('Plot structure data saved successfully:', formData);
      
      // 3秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      alert('保存に失敗しました。もう一度お試しください。');
      
      // 5秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, updateProject, formData, plotStructure]);

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

      const structureInfo = plotStructure === 'kishotenketsu' 
        ? '起承転結構成（起・承・転・結）'
        : plotStructure === 'three-act' 
        ? '三幕構成（第1幕・第2幕・第3幕）'
        : '四幕構成（第1幕・第2幕・第3幕・第4幕）';

      const prompt = `以下の情報に基づいて物語プロット構成の詳細を提案してください。

【プロジェクト情報】
作品タイトル: ${context.title}
メインジャンル: ${context.mainGenre || context.genre}
サブジャンル: ${context.subGenre || '未設定'}
テーマ: ${context.projectTheme}
構成: ${structureInfo}

【キャラクター情報】
${charactersInfo}

【プロット基礎設定（重要）】
メインテーマ: ${currentProject?.plot?.theme || '未設定'}
舞台設定: ${currentProject?.plot?.setting || '未設定'}
フック要素: ${currentProject?.plot?.hook || '未設定'}
主人公の目標: ${currentProject?.plot?.protagonistGoal || '未設定'}
主要な障害: ${currentProject?.plot?.mainObstacle || '未設定'}

【重要】上記のプロット基礎設定を必ず反映し、一貫性のある物語構成を提案してください。
基礎設定の内容を活かしながら、各構成段階でどのように展開するかを具体的に記述してください。

以下のJSON形式で出力してください：
{${plotStructure === 'kishotenketsu' ? `
  "起（導入）": "起（導入）を500文字以内で記述",
  "承（展開）": "承（展開）を500文字以内で記述",
  "転（転換）": "転（転換）を500文字以内で記述",
  "結（結末）": "結（結末）を500文字以内で記述"` : plotStructure === 'three-act' ? `
  "第1幕（導入）": "第1幕を500文字以内で記述",
  "第2幕（展開）": "第2幕を500文字以内で記述",
  "第3幕（結末）": "第3幕を500文字以内で記述"` : `
  "第1幕（秩序）": "第1幕（秩序）を500文字以内で記述",
  "第2幕（混沌）": "第2幕（混沌）を500文字以内で記述",
  "第3幕（秩序）": "第3幕（秩序）を500文字以内で記述",
  "第4幕（混沌）": "第4幕（混沌）を500文字以内で記述"`}
}`;

      const response = await aiService.generateContent({
        prompt,
        type: 'plot',
        settings,
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
          
          // フォームデータを更新（構成詳細のみ）
          setFormData(prev => ({
            ...prev,
            ...(plotStructure === 'kishotenketsu' ? {
              ki: parsed['起（導入）'] || prev.ki,
              sho: parsed['承（展開）'] || prev.sho,
              ten: parsed['転（転換）'] || prev.ten,
              ketsu: parsed['結（結末）'] || prev.ketsu,
            } : plotStructure === 'three-act' ? {
              act1: parsed['第1幕（導入）'] || prev.act1,
              act2: parsed['第2幕（展開）'] || prev.act2,
              act3: parsed['第3幕（結末）'] || prev.act3,
            } : {
              fourAct1: parsed['第1幕（秩序）'] || prev.fourAct1,
              fourAct2: parsed['第2幕（混沌）'] || prev.fourAct2,
              fourAct3: parsed['第3幕（秩序）'] || prev.fourAct3,
              fourAct4: parsed['第4幕（混沌）'] || prev.fourAct4,
            })
          }));
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                プロット構成の詳細
              </h2>
              <div className="flex items-center space-x-4">
                {/* 構成スタイル切り替え */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    構成スタイル:
                  </label>
                  <select
                    value={plotStructure}
                    onChange={(e) => setPlotStructure(e.target.value as 'kishotenketsu' | 'three-act' | 'four-act')}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']"
                  >
                    <option value="kishotenketsu">起承転結</option>
                    <option value="three-act">三幕構成</option>
                    <option value="four-act">四幕構成</option>
                  </select>
                </div>
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
            
            {/* 起承転結、三幕構成、または四幕構成の表示 */}
            {plotStructure === 'kishotenketsu' ? (
              <>
                {/* 起 - 導入 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-3 mb-4">
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
                  <div>
                    <textarea
                      value={formData.ki}
                      onChange={(e) => setFormData({ ...formData, ki: e.target.value })}
                      placeholder="登場人物の紹介、日常の描写、事件の発端..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.ki.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.ki.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 承 - 展開 */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-3 mb-4">
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
                  <div>
                    <textarea
                      value={formData.sho}
                      onChange={(e) => setFormData({ ...formData, sho: e.target.value })}
                      placeholder="問題の詳細化、新たな登場人物、状況の発展..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.sho.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.sho.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 転 - 転換 */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-2xl border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-orange-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100 font-['Noto_Sans_JP']">
                        転 - 転換
                      </h3>
                      <p className="text-sm text-orange-700 dark:text-orange-300 font-['Noto_Sans_JP']">
                        大きな変化
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.ten}
                      onChange={(e) => setFormData({ ...formData, ten: e.target.value })}
                      placeholder="予想外の展開、大きな転換点、クライマックス..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-orange-300 dark:border-orange-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.ten.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.ten.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 結 - 結末 */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-purple-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Heart className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-['Noto_Sans_JP']">
                        結 - 結末
                      </h3>
                      <p className="text-sm text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">
                        物語の終結
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.ketsu}
                      onChange={(e) => setFormData({ ...formData, ketsu: e.target.value })}
                      placeholder="問題の解決、キャラクターの成長、新たな始まり..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.ketsu.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.ketsu.length}/500
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : plotStructure === 'three-act' ? (
              <>
                {/* 第1幕 - 導入 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Play className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP']">
                        第1幕 - 導入
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">
                        物語の始まりと設定
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.act1}
                      onChange={(e) => setFormData({ ...formData, act1: e.target.value })}
                      placeholder="登場人物の紹介、世界観の設定、事件の発端..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.act1.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.act1.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第2幕 - 展開 */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-900 dark:text-green-100 font-['Noto_Sans_JP']">
                        第2幕 - 展開
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                        物語の核心部分
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.act2}
                      onChange={(e) => setFormData({ ...formData, act2: e.target.value })}
                      placeholder="主人公の試練、対立の激化、クライマックスへの準備..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.act2.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.act2.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第3幕 - 結末 */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-purple-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Heart className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-['Noto_Sans_JP']">
                        第3幕 - 結末
                      </h3>
                      <p className="text-sm text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">
                        物語の解決と結末
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.act3}
                      onChange={(e) => setFormData({ ...formData, act3: e.target.value })}
                      placeholder="クライマックス、問題の解決、物語の結末、キャラクターの成長..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.act3.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.act3.length}/500
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* 第1幕 - 秩序 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Play className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP']">
                        第1幕 - 秩序
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">
                        日常の確立
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.fourAct1}
                      onChange={(e) => setFormData({ ...formData, fourAct1: e.target.value })}
                      placeholder="キャラクター紹介、世界観の設定、日常の確立..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.fourAct1.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.fourAct1.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第2幕 - 混沌 */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-2xl border border-red-200 dark:border-red-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-red-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-900 dark:text-red-100 font-['Noto_Sans_JP']">
                        第2幕 - 混沌
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                        問題発生と状況悪化
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.fourAct2}
                      onChange={(e) => setFormData({ ...formData, fourAct2: e.target.value })}
                      placeholder="問題の発生、状況の悪化、困難の増大..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.fourAct2.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.fourAct2.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第3幕 - 秩序 */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-900 dark:text-green-100 font-['Noto_Sans_JP']">
                        第3幕 - 秩序
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
                        解決への取り組み
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.fourAct3}
                      onChange={(e) => setFormData({ ...formData, fourAct3: e.target.value })}
                      placeholder="解決への取り組み、希望の光、状況の改善..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.fourAct3.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.fourAct3.length}/500
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第4幕 - 混沌 */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-purple-500 w-8 h-8 rounded-full flex items-center justify-center">
                      <Heart className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-['Noto_Sans_JP']">
                        第4幕 - 混沌
                      </h3>
                      <p className="text-sm text-purple-700 dark:text-purple-300 font-['Noto_Sans_JP']">
                        最終的な試練と真の解決
                      </p>
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={formData.fourAct4}
                      onChange={(e) => setFormData({ ...formData, fourAct4: e.target.value })}
                      placeholder="最終的な試練、真の解決、物語の結末..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP'] resize-y min-h-[100px]"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP']">
                        500文字以内で記述してください
                      </p>
                      <span className={`text-xs font-['Noto_Sans_JP'] ${
                        formData.fourAct4.length > 500 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.fourAct4.length}/500
                      </span>
                    </div>
                  </div>
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
                onClick={handleSave}
                disabled={isSaving}
                className={`px-6 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] ${
                  isSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-105'
                } text-white`}
              >
                {isSaving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <div className="space-y-6">
          {/* 構成スタイル説明ガイド */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 w-10 h-10 rounded-full flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                構成スタイルガイド
              </h3>
            </div>
            
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
          {/* プロット基礎設定表示エリア */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-2xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 w-10 h-10 rounded-full flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                プロット基礎設定
              </h3>
            </div>
            
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
            </div>
            
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
              {currentProject?.plot?.theme && currentProject?.plot?.setting && currentProject?.plot?.hook && currentProject?.plot?.protagonistGoal && currentProject?.plot?.mainObstacle ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                  💡 これらの基礎設定を参考に、一貫性のあるプロット構成を作成しましょう
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                  ⚠️ プロット基礎設定が未完了です。より良いプロット作成のため、PlotStep1で基礎設定を完了することをお勧めします。
                </p>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-br from-purple-900 to-purple-800 w-10 h-10 rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AI提案アシスタント
              </h3>
            </div>
            
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

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
              {plotStructure === 'kishotenketsu' ? '起承転結' : plotStructure === 'three-act' ? '三幕構成' : '四幕構成'}完成度
            </h3>
            
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
                        className={`h-2 rounded-full transition-all duration-500 ${
                          progress.percentage === 100 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                            : 'bg-gradient-to-r from-green-500 to-emerald-500'
                        }`}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <span className={`text-sm font-semibold ${
                        progress.percentage === 100 
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
                        <div className={`w-2 h-2 rounded-full ${
                          field.completed 
                            ? 'bg-green-500' 
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`} />
                        <span className={`font-['Noto_Sans_JP'] ${
                          field.completed 
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
        </div>
      </div>
    </div>
  );
};
