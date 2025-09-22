import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';

type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'export';

interface PlotStep1Props {
  onNavigateToStep?: (step: Step) => void;
}

export const PlotStep1: React.FC<PlotStep1Props> = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [formData, setFormData] = useState({
    theme: currentProject?.plot?.theme || '',
    setting: currentProject?.plot?.setting || '',
    hook: currentProject?.plot?.hook || '',
    protagonistGoal: currentProject?.plot?.protagonistGoal || '',
    mainObstacle: currentProject?.plot?.mainObstacle || '',
  });

  // プロジェクトが変更されたときにformDataを更新
  useEffect(() => {
    if (currentProject) {
      setFormData({
        theme: currentProject.plot?.theme || '',
        setting: currentProject.plot?.setting || '',
        hook: currentProject.plot?.hook || '',
        protagonistGoal: currentProject.plot?.protagonistGoal || '',
        mainObstacle: currentProject.plot?.mainObstacle || '',
      });
    }
  }, [currentProject]);

  // 自動保存機能（デバウンス付き）
  useEffect(() => {
    if (!currentProject) return;
    
    const timeoutId = setTimeout(async () => {
      // フォームデータが変更されている場合のみ保存
      const hasChanges = 
        formData.theme !== (currentProject.plot?.theme || '') ||
        formData.setting !== (currentProject.plot?.setting || '') ||
        formData.hook !== (currentProject.plot?.hook || '') ||
        formData.protagonistGoal !== (currentProject.plot?.protagonistGoal || '') ||
        formData.mainObstacle !== (currentProject.plot?.mainObstacle || '');
      
      if (hasChanges) {
        // 直接保存処理を実行
        setIsSaving(true);
        setSaveStatus('saving');
        
        try {
          // 既存のplotデータを保持しつつ、基本設定のみを更新
          const updatedPlot = {
            ...currentProject.plot,
            theme: formData.theme,
            setting: formData.setting,
            hook: formData.hook,
            protagonistGoal: formData.protagonistGoal,
            mainObstacle: formData.mainObstacle,
          };

          await updateProject({
            plot: updatedPlot,
          });
          
          setSaveStatus('saved');
          console.log('Plot basic data auto-saved successfully:', formData);
          
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
  }, [formData, currentProject, updateProject]);

  const handleSave = useCallback(async () => {
    if (!currentProject) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // 既存のplotデータを保持しつつ、基本設定のみを更新
      const updatedPlot = {
        ...currentProject.plot,
        theme: formData.theme,
        setting: formData.setting,
        hook: formData.hook,
        protagonistGoal: formData.protagonistGoal,
        mainObstacle: formData.mainObstacle,
      };

      await updateProject({
        plot: updatedPlot,
      });
      
      setSaveStatus('saved');
      console.log('Plot basic data saved successfully:', formData);
      
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
  }, [currentProject, updateProject, formData]);

  // フォームデータをリセットする関数
  const handleReset = () => {
    if (window.confirm('すべての入力内容をリセットしますか？この操作は取り消せません。')) {
      setFormData({
        theme: '',
        setting: '',
        hook: '',
        protagonistGoal: '',
        mainObstacle: '',
      });
      console.log('Form data reset successfully');
    }
  };

  // 文字数制限に基づいて内容を成形する関数
  const formatContentToFit = (content: string, maxLength: number, fieldName: string): string => {
    if (!content) return '';
    
    let formatted = content.trim();
    
    // 基本的なクリーニング
    formatted = formatted
      .replace(/^["']|["']$/g, '') // クォートの除去
      .replace(/\s+/g, ' ') // 連続する空白を単一の空白に
      .replace(/\n+/g, ' ') // 改行を空白に
      .trim();
    
    // 文字数制限を超えている場合の処理
    if (formatted.length > maxLength) {
      console.warn(`${fieldName}の文字数が制限を超過: ${formatted.length}/${maxLength}文字`);
      
      // 1. 文の境界で切り詰めを試行（句読点で分割）
      const sentences = formatted.split(/[。！？]/);
      let truncated = '';
      
      for (const sentence of sentences) {
        const testLength = truncated.length + sentence.length + (truncated ? 1 : 0);
        if (testLength <= maxLength) {
          truncated += (truncated ? '。' : '') + sentence;
        } else {
          break;
        }
      }
      
      // 2. 文の境界で切り詰めができなかった場合、カンマや読点で切り詰め
      if (!truncated || truncated.length < maxLength * 0.6) {
        const commaSentences = formatted.split(/[、,]/);
        truncated = '';
        
        for (const sentence of commaSentences) {
          const testLength = truncated.length + sentence.length + (truncated ? 1 : 0);
          if (testLength <= maxLength) {
            truncated += (truncated ? '、' : '') + sentence;
          } else {
            break;
          }
        }
      }
      
      // 3. それでも適切に切り詰められない場合、単語境界で切り詰め
      if (!truncated || truncated.length < maxLength * 0.5) {
        // 日本語の場合は文字単位、英語の場合は単語単位で切り詰め
        if (formatted.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/)) {
          // 日本語の場合
          truncated = formatted.substring(0, maxLength - 3) + '...';
        } else {
          // 英語の場合
          const words = formatted.split(' ');
          truncated = '';
          for (const word of words) {
            const testLength = truncated.length + word.length + (truncated ? 1 : 0);
            if (testLength <= maxLength - 3) {
              truncated += (truncated ? ' ' : '') + word;
            } else {
              break;
            }
          }
          if (truncated.length < maxLength - 3) {
            truncated += '...';
          }
        }
      }
      
      formatted = truncated;
      console.log(`${fieldName}を成形: ${formatted.length}/${maxLength}文字`);
      
      // 最終チェック：まだ制限を超えている場合は強制的に切り詰め
      if (formatted.length > maxLength) {
        formatted = formatted.substring(0, maxLength - 3) + '...';
        console.warn(`${fieldName}を強制切り詰め: ${formatted.length}/${maxLength}文字`);
      }
    }
    
    return formatted;
  };

  // 基本設定専用のAI生成関数
  const handleBasicAIGenerate = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    setIsGenerating(true);
    
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

      const prompt = `あなたは物語プロット生成の専門AIです。以下の指示を厳密に守って、指定されたJSON形式のみで出力してください。

【プロジェクト情報】
作品タイトル: ${context.title}
作品説明: ${context.description || '説明未設定'}
メインジャンル: ${context.mainGenre || context.genre}
サブジャンル: ${context.subGenre || '未設定'}
ターゲット読者: ${context.targetReader}
プロジェクトテーマ: ${context.projectTheme}

【キャラクター情報】
${charactersInfo}

【重要指示】以下のJSON形式以外は一切出力しないでください。説明文、コメント、その他のテキストは一切不要です。

{
  "メインテーマ": "ここに物語の核心となるメインテーマを100文字以内で記述",
  "舞台設定": "ここにジャンルに合わせた世界観を表現して300文字以内で記述",
  "フック要素": "ここに魅力的なフック要素を300文字以内で記述",
  "主人公の目標": "ここに主人公が達成したい目標を100文字以内で記述",
  "主要な障害": "ここに主人公の目標を阻む主要な障害を100文字以内で記述"
}

【絶対に守るべきルール】
1. 上記のJSON形式以外は一切出力しない
2. 説明文、コメント、マークダウンは一切不要
3. 項目名は必ず「メインテーマ」「舞台設定」「フック要素」「主人公の目標」「主要な障害」で記述
4. 各項目の内容は指定された文字数以内で記述
5. 日本語の内容のみで記述
6. 改行文字は使用しない
7. 特殊文字や装飾は使用しない

【文字数制限】
- メインテーマ：100文字以内
- 舞台設定：300文字以内  
- フック要素：300文字以内
- 主人公の目標：100文字以内
- 主要な障害：100文字以内

【出力例】
{
  "メインテーマ": "友情と成長をテーマにした青春物語",
  "舞台設定": "現代の高校を舞台に、主人公の日常と非日常が交錯する世界観",
  "フック要素": "謎の転校生との出会いが引き起こす予想外の展開",
  "主人公の目標": "転校生の正体を突き止め、クラスメイトとの友情を深める",
  "主要な障害": "転校生の秘密と、クラス内の対立関係"
}

上記の形式で出力してください。`;

      console.log('Basic AI Request:', {
        provider: settings.provider,
        model: settings.model,
        prompt: prompt.substring(0, 100) + '...',
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'plot',
        settings,
      });

      console.log('Basic AI Response:', {
        success: !response.error,
        contentLength: response.content?.length || 0,
        error: response.error,
        usage: response.usage,
      });

      if (response.error) {
        alert(`AI生成エラー: ${response.error}\n\n詳細はブラウザのコンソールを確認してください。`);
        return;
      }

      // 生成された内容を解析
      const content = response.content;
      console.log('Basic AI生の出力:', content);

      // JSON形式の解析（強化版）
      let parsedData: Record<string, unknown> | null = null;
      try {
        // 複数のJSON抽出パターンを試行
        const jsonPatterns = [
          // 1. 完全なJSONオブジェクト
          /\{[\s\S]*?\}/,
          // 2. 複数行にわたるJSON
          /\{[\s\S]*\}/,
          // 3. 基本設定専用のJSON
          /\{\s*"メインテーマ"[\s\S]*?"フック要素"[\s\S]*?\}/
        ];

        for (const pattern of jsonPatterns) {
          const jsonMatch = content.match(pattern);
          if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            
            // JSON文字列のクリーニング
            jsonStr = jsonStr
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 制御文字を除去
              .replace(/\s+/g, ' ') // 連続する空白を単一の空白に
              .replace(/\n/g, ' ') // 改行を空白に
              .trim();

            try {
              const parsed = JSON.parse(jsonStr);
              
              // 基本設定のキーが存在するかチェック
              const basicKeys = ['メインテーマ', '舞台設定', 'フック要素', '主人公の目標', '主要な障害'];
              const validKeys = basicKeys.filter(key => Object.prototype.hasOwnProperty.call(parsed, key));
              
              if (validKeys.length >= 2) { // 最低2つのキーがあれば有効
                console.log('基本設定JSON解析成功:', {
                  pattern: pattern.toString(),
                  validKeys: validKeys,
                  content: jsonStr.substring(0, 200) + '...'
                });
                parsedData = parsed;
                break;
              }
            } catch (parseError) {
              console.warn('JSON解析エラー:', parseError);
              continue;
            }
          }
        }

        if (!parsedData) {
          console.warn('基本設定JSON解析に失敗、フォールバック解析を使用');
        }
      } catch (error) {
        console.warn('基本設定JSON解析に失敗:', error);
      }

      // フィールド抽出関数
      const extractBasicField = (label: string) => {
        // JSON形式から抽出
        if (parsedData && parsedData[label]) {
          return String(parsedData[label]).trim();
        }

        // テキスト形式から抽出
        const patterns = [
          new RegExp(`${label}:\\s*([^\\n]+(?:\\n(?!\\w+:)[^\\n]*)*)`, 'i'),
          new RegExp(`${label}\\s*[:：]\\s*([^\\n]+(?:\\n(?!\\w+\\s*[:：])[^\\n]*)*)`, 'i'),
          new RegExp(`"${label}"\\s*:\\s*"([^"]*)"`, 'i'),
          new RegExp(`'${label}'\\s*:\\s*'([^']*)'`, 'i')
        ];

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            return match[1].trim().replace(/^["']|["']$/g, '');
          }
        }

        return '';
      };

      const rawTheme = extractBasicField('メインテーマ');
      const rawSetting = extractBasicField('舞台設定');
      const rawHook = extractBasicField('フック要素');
      const rawProtagonistGoal = extractBasicField('主人公の目標');
      const rawMainObstacle = extractBasicField('主要な障害');

      // 文字数制限に基づいて内容を成形
      const theme = formatContentToFit(rawTheme, 100, 'メインテーマ');
      const setting = formatContentToFit(rawSetting, 300, '舞台設定');
      const hook = formatContentToFit(rawHook, 300, 'フック要素');
      const protagonistGoal = formatContentToFit(rawProtagonistGoal, 100, '主人公の目標');
      const mainObstacle = formatContentToFit(rawMainObstacle, 100, '主要な障害');

      // 解析結果の確認
      const extractedCount = [theme, setting, hook, protagonistGoal, mainObstacle].filter(v => v).length;
      if (extractedCount === 0) {
        console.error('基本設定の解析に完全に失敗:', {
          rawContent: content,
          parsedData: parsedData,
          extractedFields: { theme, setting, hook, protagonistGoal, mainObstacle }
        });
        alert('基本設定の解析に失敗しました。AIがテンプレートを逸脱した出力をしています。\n\n期待される形式:\n{\n  "メインテーマ": "内容",\n  "舞台設定": "内容",\n  "フック要素": "内容",\n  "主人公の目標": "内容",\n  "主要な障害": "内容"\n}\n\nもう一度お試しください。');
        return;
      } else if (extractedCount < 5) {
        console.warn(`基本設定の一部項目のみ解析成功: ${extractedCount}/5項目`, {
          extractedFields: { theme, setting, hook, protagonistGoal, mainObstacle },
          rawContent: content.substring(0, 500) + '...'
        });
        alert(`一部の基本設定項目のみ解析できました（${extractedCount}/5項目）。不完全な結果が適用されます。`);
      }

      // フォームデータを更新
      setFormData(prev => ({
        ...prev,
        theme: theme || prev.theme,
        setting: setting || prev.setting,
        hook: hook || prev.hook,
        protagonistGoal: protagonistGoal || prev.protagonistGoal,
        mainObstacle: mainObstacle || prev.mainObstacle,
      }));

    } catch (error) {
      console.error('Basic AI生成エラー:', error);
      alert('基本設定のAI生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
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

  // 基本設定完成度を計算する関数
  const calculateBasicProgress = () => {
    const fields = [
      { key: 'theme', label: 'メインテーマ', value: formData.theme },
      { key: 'setting', label: '舞台設定', value: formData.setting },
      { key: 'hook', label: 'フック要素', value: formData.hook },
      { key: 'protagonistGoal', label: '主人公の目標', value: formData.protagonistGoal },
      { key: 'mainObstacle', label: '主要な障害', value: formData.mainObstacle },
    ];

    const completedFields = fields.filter(field => field.value.trim().length > 0);
    const progressPercentage = (completedFields.length / fields.length) * 100;

    return {
      completed: completedFields.length,
      total: fields.length,
      percentage: progressPercentage,
      fields: fields.map(field => ({
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          プロット基本設定
        </h1>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          物語の骨格となる基本設定を設計しましょう。AIが一貫性のある物語の基盤を提案します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 基本設定セクション */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                基本設定
              </h2>
            </div>
            
            <div className="space-y-6">
              {/* メインテーマ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                  メインテーマ
                </label>
                <textarea
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                  placeholder="例：友情と成長、愛と犠牲、正義と復讐、家族の絆、夢と現実の狭間"
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    一文で簡潔に表現してください（100文字以内）
                  </p>
                  <span className={`text-xs font-['Noto_Sans_JP'] ${
                    formData.theme.length > 100 
                      ? 'text-red-500 dark:text-red-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formData.theme.length}/100
                  </span>
                </div>
              </div>

              {/* 舞台設定 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                  舞台設定
                </label>
                <textarea
                  value={formData.setting}
                  onChange={(e) => setFormData({ ...formData, setting: e.target.value })}
                  placeholder="例：現代の高校を舞台に、主人公の日常と非日常が交錯する世界観。クラスメイトとの人間関係や学校生活が物語の中心となる"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    ジャンルに合わせた詳細な世界観を表現してください（300文字以内）
                  </p>
                  <span className={`text-xs font-['Noto_Sans_JP'] ${
                    formData.setting.length > 300 
                      ? 'text-red-500 dark:text-red-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formData.setting.length}/300
                  </span>
                </div>
              </div>

              {/* フック要素 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                  フック（読者を引き込む要素）
                </label>
                <textarea
                  value={formData.hook}
                  onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                  placeholder="例：謎の転校生との出会いが引き起こす予想外の展開。主人公の過去の秘密が明かされることで、クラス全体の関係性が大きく変化する"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    独創的で読者の興味を引く要素を展開してください（300文字以内）
                  </p>
                  <span className={`text-xs font-['Noto_Sans_JP'] ${
                    formData.hook.length > 300 
                      ? 'text-red-500 dark:text-red-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formData.hook.length}/300
                  </span>
                </div>
              </div>

              {/* 主人公の目標 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                  主人公の目標
                </label>
                <textarea
                  value={formData.protagonistGoal}
                  onChange={(e) => setFormData({ ...formData, protagonistGoal: e.target.value })}
                  placeholder="例：転校生の正体を突き止め、クラスメイトとの友情を深める"
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    主人公が達成したい目標を明確に表現してください（100文字以内）
                  </p>
                  <span className={`text-xs font-['Noto_Sans_JP'] ${
                    formData.protagonistGoal.length > 100 
                      ? 'text-red-500 dark:text-red-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formData.protagonistGoal.length}/100
                  </span>
                </div>
              </div>

              {/* 主要な障害 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                  主要な障害
                </label>
                <textarea
                  value={formData.mainObstacle}
                  onChange={(e) => setFormData({ ...formData, mainObstacle: e.target.value })}
                  placeholder="例：転校生の秘密と、クラス内の対立関係"
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                    主人公の目標を阻む主要な障害を設定してください（100文字以内）
                  </p>
                  <span className={`text-xs font-['Noto_Sans_JP'] ${
                    formData.mainObstacle.length > 100 
                      ? 'text-red-500 dark:text-red-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formData.mainObstacle.length}/100
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 保存ボタンとリセットボタン */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 hover:scale-105 text-white"
            >
              すべてリセット
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
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AI提案アシスタント
              </h3>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4 font-['Noto_Sans_JP']">
              一貫性のある基本設定を生成します：
            </p>
            
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-4">
              <li>• <span className="font-semibold text-purple-600 dark:text-purple-400">基本設定提案</span>：メインテーマ、舞台設定、フック要素を独立して提案</li>
              <li>• キャラクター設定との連携強化</li>
              <li>• ジャンルに適した設定パターン</li>
              <li>• 文字数制限による適切なボックスサイズ対応</li>
            </ul>
            
            <button
              onClick={handleBasicAIGenerate}
              disabled={isGenerating}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP'] shadow-lg hover:shadow-xl"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>基本設定をAI提案</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
              基本設定完成度
            </h3>
            
            {(() => {
              const progress = calculateBasicProgress();
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
                            : 'bg-gradient-to-r from-blue-500 to-cyan-500'
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
                          基本設定完成！
                        </span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
                        すべての基本設定項目が設定されました。次のステップに進むことができます。
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
