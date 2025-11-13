import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sparkles, Check, Loader2, BookOpen, Eye, Wand2, GripVertical, RotateCcw, ChevronRight, ChevronDown, ChevronUp, FileText, X, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';

type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'export';

interface PlotStep1Props {
  onNavigateToStep?: (step: Step) => void;
}

export const PlotStep1: React.FC<PlotStep1Props> = () => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showError, showSuccess, showWarning } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    theme: currentProject?.plot?.theme || '',
    setting: currentProject?.plot?.setting || '',
    hook: currentProject?.plot?.hook || '',
    protagonistGoal: currentProject?.plot?.protagonistGoal || '',
    mainObstacle: currentProject?.plot?.mainObstacle || '',
  });

  // 入力履歴管理
  const [history, setHistory] = useState<Array<typeof formData>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef(false);

  // ドラッグ&ドロップ用の状態
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showDragTooltip, setShowDragTooltip] = useState<number | null>(null);
  const [fieldOrder, setFieldOrder] = useState<Array<{key: string, label: string}>>([
    { key: 'theme', label: 'メインテーマ' },
    { key: 'setting', label: '舞台設定' },
    { key: 'hook', label: 'フック要素' },
    { key: 'protagonistGoal', label: '主人公の目標' },
    { key: 'mainObstacle', label: '主要な障害' },
  ]);

  // テンプレート・サンプル表示用の状態
  const [showTemplates, setShowTemplates] = useState<Record<string, boolean>>({});
  const [showDependencies, setShowDependencies] = useState<Record<string, boolean>>({});

  // サイドバー項目の管理
  type SidebarItemId = 'aiAssistant' | 'preview' | 'progress';
  const [sidebarItemOrder, setSidebarItemOrder] = useState<SidebarItemId[]>(['aiAssistant', 'progress', 'preview']);
  const [expandedSidebarItems, setExpandedSidebarItems] = useState<Set<SidebarItemId>>(new Set(['aiAssistant', 'progress']));
  const [draggedSidebarIndex, setDraggedSidebarIndex] = useState<number | null>(null);
  const [dragOverSidebarIndex, setDragOverSidebarIndex] = useState<number | null>(null);

  // 入力履歴を保存する関数
  const saveToHistory = useCallback((data: typeof formData) => {
    if (historyRef.current) {
      historyRef.current = false;
      return;
    }

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ ...data });
      // 履歴は最大50件まで保持
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // 元に戻す機能
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      historyRef.current = true;
      setFormData(history[prevIndex]);
      setHistoryIndex(prevIndex);
    }
  }, [history, historyIndex]);

  // やり直し機能
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      historyRef.current = true;
      setFormData(history[nextIndex]);
      setHistoryIndex(nextIndex);
    }
  }, [history, historyIndex]);

  // フォームデータ変更時に履歴を保存
  useEffect(() => {
    if (history.length === 0) {
      // 初回のみ現在の状態を履歴に保存
      saveToHistory(formData);
    }
  }, []);

  // プロジェクトが変更されたときにformDataを更新
  useEffect(() => {
    if (currentProject) {
      const newFormData = {
        theme: currentProject.plot?.theme || '',
        setting: currentProject.plot?.setting || '',
        hook: currentProject.plot?.hook || '',
        protagonistGoal: currentProject.plot?.protagonistGoal || '',
        mainObstacle: currentProject.plot?.mainObstacle || '',
      };
      historyRef.current = true;
      setFormData(newFormData);
      setHistory([newFormData]);
      setHistoryIndex(0);
    }
  }, [currentProject]);

  // フォームデータ変更時に履歴を保存（デバウンス付き）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToHistory(formData);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [formData, saveToHistory]);

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
          setLastSavedTime(new Date());
          setSaveError(null);
          console.log('Plot basic data auto-saved successfully:', formData);
          
        } catch (error) {
          console.error('Auto-save error:', error);
          const errorMessage = error instanceof Error ? error.message : '自動保存に失敗しました';
          setSaveStatus('error');
          setSaveError(errorMessage);
          showError(`自動保存に失敗しました: ${errorMessage}`, 5000);
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

      // 即座に保存
      await updateProject({
        plot: updatedPlot,
      }, true);
      
      setSaveStatus('saved');
      setLastSavedTime(new Date());
      setSaveError(null);
      showSuccess('保存が完了しました', 3000);
      console.log('Plot basic data saved successfully:', formData);
      
    } catch (error) {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : '保存に失敗しました';
      setSaveStatus('error');
      setSaveError(errorMessage);
      showError(`保存に失敗しました: ${errorMessage}`, 5000);
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, updateProject, formData]);

  // フォームデータをリセットする関数
  const handleReset = () => {
    if (window.confirm('すべての入力内容をリセットしますか？この操作は取り消せません。')) {
      const resetData = {
        theme: '',
        setting: '',
        hook: '',
        protagonistGoal: '',
        mainObstacle: '',
      };
      setFormData(resetData);
      saveToHistory(resetData);
      console.log('Form data reset successfully');
    }
  };

  // テンプレート・サンプルデータ
  const templates = {
    theme: [
      '友情と成長をテーマにした青春物語',
      '愛と犠牲を描く恋愛小説',
      '正義と復讐の物語',
      '家族の絆を描く家族小説',
      '夢と現実の狭間を描くファンタジー',
      'AIと人間の感情、そして切ない初恋の物語',
    ],
    setting: [
      '現代の高校を舞台に、主人公の日常と非日常が交錯する世界観。クラスメイトとの人間関係や学校生活が物語の中心となる',
      '20XX年、高度なAI技術が社会に浸透した近未来の日本。地方都市の高校を舞台に、宇宙開発を夢見る少女と、冷徹な天才開発者の出会いを描く',
      '中世ヨーロッパをモチーフにしたファンタジー世界。魔法と剣が存在し、王国間の争いが絶えない',
      '現代の都市部を舞台に、普通のOLが異世界に転生する異世界転生もの',
    ],
    hook: [
      '謎の転校生との出会いが引き起こす予想外の展開。主人公の過去の秘密が明かされることで、クラス全体の関係性が大きく変化する',
      'AIアシスタントが感情を獲得し始めるという異例の事態。その中心にいるのは、AI研究部所属の活発な少女と、宇宙開発企業で働くクールな青年',
      '主人公が突然魔法の力を覚醒させ、異世界の危機を救うために呼び出される',
      '幼馴染との再会が、長年隠されていた家族の秘密を暴き出す',
    ],
    protagonistGoal: [
      '転校生の正体を突き止め、クラスメイトとの友情を深める',
      'AIアシスタントとの交流を通して、自分の感情を理解し、大切な人との絆を深めること',
      '異世界の危機を救い、元の世界に戻ること',
      '家族の秘密を解明し、真実を知ること',
    ],
    mainObstacle: [
      '転校生の秘密と、クラス内の対立関係',
      '社会からのAIに対する偏見、自身の過去のトラウマ、そして二人の間に存在する距離感',
      '強大な敵の存在と、異世界の複雑な政治情勢',
      '家族の過去の重みと、真実を知ることによる代償',
    ],
  };

  // テンプレートを適用する関数
  const applyTemplate = (fieldKey: keyof typeof formData, template: string) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldKey]: template };
      saveToHistory(newData);
      return newData;
    });
    setShowTemplates(prev => ({ ...prev, [fieldKey]: false }));
  };

  // フィールド間の依存関係定義
  const fieldDependencies = {
    theme: {
      description: 'メインテーマは物語全体の基盤となります。他の設定項目に反映されることを推奨します。',
      relatedFields: ['setting', 'hook', 'protagonistGoal'],
    },
    setting: {
      description: '舞台設定はメインテーマと整合性を保つことで、物語の世界観が一貫します。',
      relatedFields: ['theme', 'hook'],
    },
    hook: {
      description: 'フック要素はメインテーマや舞台設定と連携することで、より魅力的な導入になります。',
      relatedFields: ['theme', 'setting', 'protagonistGoal'],
    },
    protagonistGoal: {
      description: '主人公の目標はメインテーマと関連し、主要な障害によって阻まれることで物語に緊張感が生まれます。',
      relatedFields: ['theme', 'mainObstacle'],
    },
    mainObstacle: {
      description: '主要な障害は主人公の目標を阻むものである必要があります。目標と関連性を持たせることで物語が成立します。',
      relatedFields: ['protagonistGoal'],
    },
  };

  // ドラッグ&ドロップハンドラー
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // ドラッグ中の視覚的フィードバック
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newOrder = [...fieldOrder];
    const draggedField = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedField);
    
    setFieldOrder(newOrder);
    setDraggedIndex(null);
    
    // ローカルストレージに保存
    localStorage.setItem('plotFieldOrder', JSON.stringify(newOrder));
    showSuccess('フィールドの順序を変更しました', 2000);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // ローカルストレージからフィールド順序を読み込む
  useEffect(() => {
    const savedOrder = localStorage.getItem('plotFieldOrder');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length === fieldOrder.length) {
          setFieldOrder(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved field order:', e);
      }
    }
  }, []);

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
      showWarning('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 5000);
      return;
    }

    setIsGenerating(true);
    
    try {
      // プロジェクトの詳細情報を取得
      const context = getProjectContext();
      if (!context) {
        showError('プロジェクト情報が見つかりません。', 5000);
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
        showError(`AI生成エラー: ${response.error}`, 7000);
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
        showError('基本設定の解析に失敗しました。AIがテンプレートを逸脱した出力をしています。もう一度お試しください。', 7000);
        return;
      } else if (extractedCount < 5) {
        console.warn(`基本設定の一部項目のみ解析成功: ${extractedCount}/5項目`, {
          extractedFields: { theme, setting, hook, protagonistGoal, mainObstacle },
          rawContent: content.substring(0, 500) + '...'
        });
        showWarning(`一部の基本設定項目のみ解析できました（${extractedCount}/5項目）。不完全な結果が適用されます。`, 5000);
      } else {
        showSuccess('基本設定の生成が完了しました', 3000);
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
      const errorMessage = error instanceof Error ? error.message : '基本設定のAI生成中にエラーが発生しました';
      showError(errorMessage, 5000);
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

  // 個別フィールドのAI提案関数
  const handleFieldAIGenerate = async (fieldKey: 'theme' | 'setting' | 'hook' | 'protagonistGoal' | 'mainObstacle') => {
    if (!isConfigured) {
      showWarning('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 5000);
      return;
    }

    setGeneratingField(fieldKey);
    
    try {
      const context = getProjectContext();
      if (!context) {
        showError('プロジェクト情報が見つかりません。', 5000);
        return;
      }

      const fieldConfig = {
        theme: { label: 'メインテーマ', maxLength: 100, description: '物語の核心となるメインテーマ' },
        setting: { label: '舞台設定', maxLength: 300, description: 'ジャンルに合わせた世界観' },
        hook: { label: 'フック要素', maxLength: 300, description: '魅力的なフック要素' },
        protagonistGoal: { label: '主人公の目標', maxLength: 100, description: '主人公が達成したい目標' },
        mainObstacle: { label: '主要な障害', maxLength: 100, description: '主人公の目標を阻む主要な障害' },
      };

      const config = fieldConfig[fieldKey];
      const charactersInfo = context.characters.length > 0 
        ? context.characters.map(c => `・${c.name} (${c.role})\n  性格: ${c.personality}\n  背景: ${c.background}`).join('\n')
        : 'キャラクター未設定';

      // 既存の設定をコンテキストとして含める
      const existingContext = Object.entries(formData)
        .filter(([key, value]) => key !== fieldKey && value.trim().length > 0)
        .map(([key, value]) => {
          const fieldName = fieldConfig[key as keyof typeof fieldConfig]?.label || key;
          return `${fieldName}: ${value}`;
        })
        .join('\n');

      const prompt = `あなたは物語プロット生成の専門AIです。以下の指示を厳密に守って、指定された形式のみで出力してください。

【プロジェクト情報】
作品タイトル: ${context.title}
作品説明: ${context.description || '説明未設定'}
メインジャンル: ${context.mainGenre || context.genre}
サブジャンル: ${context.subGenre || '未設定'}
ターゲット読者: ${context.targetReader}
プロジェクトテーマ: ${context.projectTheme}

【キャラクター情報】
${charactersInfo}

${existingContext ? `【既存の設定】
${existingContext}

` : ''}【生成する項目】
${config.label}: ${config.description}を${config.maxLength}文字以内で記述してください。

【重要指示】
1. 上記の形式以外は一切出力しないでください
2. 説明文、コメント、マークダウンは一切不要です
3. ${config.label}の内容のみを出力してください
4. 文字数は${config.maxLength}文字以内で記述してください
5. 日本語の内容のみで記述してください
6. 既存の設定と一貫性のある内容にしてください
7. キャラクター設定と整合性のある内容にしてください

【出力例】
${config.label === 'メインテーマ' ? '友情と成長をテーマにした青春物語' : 
  config.label === '舞台設定' ? '現代の高校を舞台に、主人公の日常と非日常が交錯する世界観' :
  config.label === 'フック要素' ? '謎の転校生との出会いが引き起こす予想外の展開' :
  config.label === '主人公の目標' ? '転校生の正体を突き止め、クラスメイトとの友情を深める' :
  '転校生の秘密と、クラス内の対立関係'}

上記の形式で出力してください。`;

      const response = await aiService.generateContent({
        prompt,
        type: 'plot',
        settings,
      });

      if (response.error) {
        showError(`AI生成エラー: ${response.error}`, 5000);
        return;
      }

      let generatedContent = response.content?.trim() || '';
      
      // クォートや余分な文字を除去
      generatedContent = generatedContent
        .replace(/^["']|["']$/g, '')
        .replace(/^${config.label}[:：]\s*/i, '')
        .trim();

      // 文字数制限に基づいて成形
      const formatted = formatContentToFit(generatedContent, config.maxLength, config.label);

      if (!formatted) {
        showError(`${config.label}の生成に失敗しました。もう一度お試しください。`, 5000);
        return;
      }

      showSuccess(`${config.label}の生成が完了しました`, 3000);

      // 該当フィールドのみを更新
      setFormData(prev => {
        const newData = { ...prev, [fieldKey]: formatted };
        saveToHistory(newData);
        return newData;
      });

    } catch (error) {
      console.error('Field AI生成エラー:', error);
      const errorMessage = error instanceof Error ? error.message : 'AI生成中にエラーが発生しました';
      showError(errorMessage, 5000);
    } finally {
      setGeneratingField(null);
    }
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

  // プレビュー要約を生成する関数
  const generatePreview = useMemo(() => {
    const progress = calculateBasicProgress();
    
    if (progress.percentage === 0) {
      return null;
    }

    let preview = '';
    
    if (formData.theme) {
      preview += `【テーマ】\n${formData.theme}\n\n`;
    }
    
    if (formData.setting) {
      preview += `【舞台】\n${formData.setting}\n\n`;
    }
    
    if (formData.hook) {
      preview += `【フック】\n${formData.hook}\n\n`;
    }
    
    if (formData.protagonistGoal) {
      preview += `【目標】\n${formData.protagonistGoal}\n\n`;
    }
    
    if (formData.mainObstacle) {
      preview += `【障害】\n${formData.mainObstacle}\n\n`;
    }

    // 完成度が高い場合は物語風の要約を生成
    if (progress.percentage === 100) {
      preview += `【物語の概要】\n`;
      preview += `${formData.theme}をテーマに、${formData.setting}という世界で展開される物語。`;
      preview += `${formData.hook}という展開を通じて、主人公は${formData.protagonistGoal}を目指すが、`;
      preview += `${formData.mainObstacle}という障害に直面する。`;
    }

    return preview.trim();
  }, [formData]);

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-purple-600">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            プロット基本設定
          </h1>
        </div>
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
              {fieldOrder.map((field, index) => {
                const fieldKey = field.key as keyof typeof formData;
                const fieldConfig = {
                  theme: { label: 'メインテーマ', maxLength: 100, rows: 2, placeholder: '例：友情と成長、愛と犠牲、正義と復讐、家族の絆、夢と現実の狭間', instruction: '一文で簡潔に表現してください（100文字以内）' },
                  setting: { label: '舞台設定', maxLength: 300, rows: 3, placeholder: '例：現代の高校を舞台に、主人公の日常と非日常が交錯する世界観。クラスメイトとの人間関係や学校生活が物語の中心となる', instruction: 'ジャンルに合わせた詳細な世界観を表現してください（300文字以内）' },
                  hook: { label: 'フック（読者を引き込む要素）', maxLength: 300, rows: 3, placeholder: '例：謎の転校生との出会いが引き起こす予想外の展開。主人公の過去の秘密が明かされることで、クラス全体の関係性が大きく変化する', instruction: '独創的で読者の興味を引く要素を展開してください（300文字以内）' },
                  protagonistGoal: { label: '主人公の目標', maxLength: 100, rows: 2, placeholder: '例：転校生の正体を突き止め、クラスメイトとの友情を深める', instruction: '主人公が達成したい目標を明確に表現してください（100文字以内）' },
                  mainObstacle: { label: '主要な障害', maxLength: 100, rows: 2, placeholder: '例：転校生の秘密と、クラス内の対立関係', instruction: '主人公の目標を阻む主要な障害を設定してください（100文字以内）' },
                };
                const config = fieldConfig[fieldKey];
                const dependencies = fieldDependencies[fieldKey];
                
                return (
              <div
                key={fieldKey}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-4 rounded-lg border-2 transition-all relative ${
                  draggedIndex === index
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 opacity-50 shadow-lg scale-95'
                    : dragOverIndex === index
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 border-dashed'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* ドロップインジケーター */}
                {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-t-lg animate-pulse" />
                )}
                <div className="flex items-start gap-2 mb-3">
                  <div 
                    className="cursor-move mt-1 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors relative group"
                    onMouseEnter={() => setShowDragTooltip(index)}
                    onMouseLeave={() => setShowDragTooltip(null)}
                  >
                    <GripVertical className="h-5 w-5" />
                    {/* ツールチップ */}
                    {showDragTooltip === index && (
                      <div className="absolute left-0 top-full mt-2 px-2 py-1 text-xs bg-gray-900 dark:bg-gray-700 text-white rounded shadow-lg z-50 whitespace-nowrap font-['Noto_Sans_JP']">
                        ドラッグで順序変更
                        <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                        {config.label}
                      </label>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setShowTemplates(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
                          className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-['Noto_Sans_JP']"
                          title="テンプレート・サンプルを表示"
                        >
                          <FileText className="h-3 w-3" />
                          <span>サンプル</span>
                        </button>
                        <button
                          onClick={() => setShowDependencies(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
                          className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-['Noto_Sans_JP']"
                          title="依存関係を表示"
                        >
                          <ChevronRight className="h-3 w-3" />
                          <span>関連</span>
                        </button>
                        <button
                          onClick={() => handleFieldAIGenerate(fieldKey)}
                          disabled={generatingField === fieldKey || !isConfigured}
                          className="flex items-center space-x-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                          title="このフィールドのみAI提案"
                        >
                          {generatingField === fieldKey ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>生成中</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3 w-3" />
                              <span>AI提案</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    {/* 依存関係表示 */}
                    {showDependencies[fieldKey] && (
                      <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-xs text-green-700 dark:text-green-300 mb-2 font-['Noto_Sans_JP']">
                          {dependencies.description}
                        </p>
                        {dependencies.relatedFields.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">関連フィールド:</span>
                            {dependencies.relatedFields.map(relatedKey => {
                              const relatedField = fieldOrder.find(f => f.key === relatedKey);
                              return relatedField ? (
                                <button
                                  key={relatedKey}
                                  onClick={() => {
                                    const relatedIndex = fieldOrder.findIndex(f => f.key === relatedKey);
                                    if (relatedIndex !== -1) {
                                      document.getElementById(`field-${relatedKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-['Noto_Sans_JP']"
                                >
                                  {fieldConfig[relatedKey as keyof typeof fieldConfig]?.label}
                                </button>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* テンプレート・サンプル表示 */}
                    {showTemplates[fieldKey] && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">サンプル例:</span>
                          <button
                            onClick={() => setShowTemplates(prev => ({ ...prev, [fieldKey]: false }))}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {templates[fieldKey].map((template, idx) => (
                            <button
                              key={idx}
                              onClick={() => applyTemplate(fieldKey, template)}
                              className="w-full text-left p-2 text-xs bg-white dark:bg-gray-700 rounded border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']"
                            >
                              {template}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <textarea
                      id={`field-${fieldKey}`}
                      value={formData[fieldKey]}
                      onChange={(e) => {
                        setFormData({ ...formData, [fieldKey]: e.target.value });
                      }}
                      placeholder={config.placeholder}
                      rows={config.rows}
                      className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none ${
                        formData[fieldKey].length > config.maxLength 
                          ? 'border-red-300 dark:border-red-700 focus:ring-red-500' 
                          : formData[fieldKey].length > config.maxLength * 0.8
                          ? 'border-yellow-300 dark:border-yellow-700'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                          {config.instruction}
                        </p>
                        <span className={`text-sm font-semibold font-['Noto_Sans_JP'] ${
                          formData[fieldKey].length > config.maxLength 
                            ? 'text-red-500 dark:text-red-400' 
                            : formData[fieldKey].length > config.maxLength * 0.8
                            ? 'text-yellow-500 dark:text-yellow-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {formData[fieldKey].length > config.maxLength 
                            ? `超過: ${formData[fieldKey].length - config.maxLength}文字`
                            : `残り: ${config.maxLength - formData[fieldKey].length}文字`}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            formData[fieldKey].length > config.maxLength 
                              ? 'bg-red-500' 
                              : formData[fieldKey].length > config.maxLength * 0.8
                              ? 'bg-yellow-500'
                              : formData[fieldKey].length > 0
                              ? 'bg-blue-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          style={{ width: `${Math.min((formData[fieldKey].length / config.maxLength) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                );
              })}
            </div>
          </div>

          {/* 保存ボタンとリセットボタン */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 hover:scale-105 text-white"
              >
                すべてリセット
              </button>
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="px-3 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white"
                title="元に戻す (Ctrl+Z)"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="px-3 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rotate-180"
                title="やり直し (Ctrl+Y)"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex items-center space-x-4 flex-wrap">
              {/* 保存状態の常時表示 */}
              <div className="flex items-center space-x-2 min-w-[200px]">
                {saveStatus === 'saving' && (
                  <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-['Noto_Sans_JP']">保存中...</span>
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-['Noto_Sans_JP']">保存完了</span>
                    {lastSavedTime && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{lastSavedTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    )}
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="text-sm font-['Noto_Sans_JP']">保存エラー</span>
                      {saveError && (
                        <span className="text-xs text-red-500 dark:text-red-400 font-['Noto_Sans_JP']">{saveError}</span>
                      )}
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="ml-2 px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP'] flex items-center space-x-1"
                      title="再試行"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSaving ? 'animate-spin' : ''}`} />
                      <span>再試行</span>
                    </button>
                  </div>
                )}
                {saveStatus === 'idle' && (
                  <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                    <span className="text-sm font-['Noto_Sans_JP']">未保存</span>
                  </div>
                )}
              </div>
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
          {sidebarItemOrder.map((itemId, index) => {
            const isExpanded = expandedSidebarItems.has(itemId);
            const isDragged = draggedSidebarIndex === index;
            const isDragOver = dragOverSidebarIndex === index;

            // AI提案アシスタント項目
            if (itemId === 'aiAssistant') {
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, index)}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDragLeave={handleSidebarDragLeave}
                  onDrop={(e) => handleSidebarDrop(e, index)}
                  onDragEnd={handleSidebarDragEnd}
                  className={`bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl border transition-all duration-200 ${
                    isDragged
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-purple-200 dark:border-purple-800 cursor-move hover:shadow-xl'
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
                      <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        AI提案アシスタント
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
                        一貫性のある基本設定を生成します：
                      </p>
                      
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        <li>• <span className="font-semibold text-purple-600 dark:text-purple-400">基本設定提案</span>：メインテーマ、舞台設定、フック要素を独立して提案</li>
                        <li>• キャラクター設定との連携強化</li>
                        <li>• ジャンルに適した設定パターン</li>
                        <li>• 文字数制限による適切なボックスサイズ対応</li>
                      </ul>

                      <div className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-purple-200 dark:border-purple-700">
                        <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3 font-['Noto_Sans_JP']">
                          AI基本設定提案について
                        </h4>
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-['Noto_Sans_JP'] mb-3">
                          プロジェクトの設定（ジャンル、テーマ、キャラクターなど）に基づいて、一貫性のある物語の基本設定を自動生成します。
                        </p>
                        <ul className="space-y-1 text-xs text-purple-500 dark:text-purple-400 font-['Noto_Sans_JP'] mb-4">
                          <li>• メインテーマ、舞台設定、フック要素、主人公の目標、主要な障害を設定</li>
                          <li>• キャラクター設定と連携した一貫性のある物語基盤を構築</li>
                          <li>• ジャンルに適した設定パターンと文字数制限を考慮</li>
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
                    </div>
                  )}
                </div>
              );
            }

            // プレビュー・要約パネル項目
            if (itemId === 'preview') {
              if (!generatePreview) return null;
              
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, index)}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDragLeave={handleSidebarDragLeave}
                  onDrop={(e) => handleSidebarDrop(e, index)}
                  onDragEnd={handleSidebarDragEnd}
                  className={`bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-2xl border transition-all duration-200 ${
                    isDragged
                      ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
                      : isDragOver
                        ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-indigo-200 dark:border-indigo-800 cursor-move hover:shadow-xl'
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
                      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 w-10 h-10 rounded-full flex items-center justify-center">
                        <Eye className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        プレビュー・要約
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
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] leading-relaxed">
                          {generatePreview}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // 基本設定完成度項目
            if (itemId === 'progress') {
              const progress = calculateBasicProgress();
              
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, index)}
                  onDragOver={(e) => handleSidebarDragOver(e, index)}
                  onDragLeave={handleSidebarDragLeave}
                  onDrop={(e) => handleSidebarDrop(e, index)}
                  onDragEnd={handleSidebarDragEnd}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border transition-all duration-200 ${
                    isDragged
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
                        基本設定完成度
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

                      <div className="space-y-2 text-sm">
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
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
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
