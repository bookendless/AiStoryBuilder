import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Loader2, BookOpen, ChevronRight, FileText, AlertCircle, RefreshCw, Clock, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';
import { useAutoSave } from '../common/hooks/useAutoSave';
import { StepNavigation } from '../common/StepNavigation';
import { AIGenerateButton } from '../common/AIGenerateButton';
import { Modal } from '../common/Modal';
import { InlineAIFeedback } from '../common/InlineAIFeedback';
import { ConfirmDialog } from '../common/ConfirmDialog';

type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'export';

interface PlotStep1Props {
  onNavigateToStep?: (step: Step) => void;
}

// 定数定義
const MAX_HISTORY_SIZE = 50;
const MAX_HISTORY_INDEX = MAX_HISTORY_SIZE - 1;
const HISTORY_DEBOUNCE_MS = 1000;
const FIELD_MAX_LENGTHS = {
  theme: 100,
  setting: 300,
  hook: 300,
  protagonistGoal: 100,
  mainObstacle: 100,
  ending: 200,
} as const;

// 型定義
type PlotFormData = {
  theme: string;
  setting: string;
  hook: string;
  protagonistGoal: string;
  mainObstacle: string;
  ending: string;
};

type FieldKey = keyof PlotFormData;

export const PlotStep1: React.FC<PlotStep1Props> = ({ onNavigateToStep }) => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showError, showSuccess, showWarning } = useToast();
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlotFormData>({
    theme: currentProject?.plot?.theme || '',
    setting: currentProject?.plot?.setting || '',
    hook: currentProject?.plot?.hook || '',
    protagonistGoal: currentProject?.plot?.protagonistGoal || '',
    mainObstacle: currentProject?.plot?.mainObstacle || '',
    ending: currentProject?.plot?.ending || '',
  });

  // 入力履歴管理
  const [history, setHistory] = useState<Array<PlotFormData>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // フィールドの固定順序（論理的な順序）
  const fieldOrder: Array<{ key: FieldKey; label: string }> = [
    { key: 'theme', label: 'メインテーマ' },
    { key: 'setting', label: '舞台設定' },
    { key: 'hook', label: '物語の引き（冒頭の魅力）' },
    { key: 'protagonistGoal', label: '主人公の目標' },
    { key: 'mainObstacle', label: '主要な障害' },
    { key: 'ending', label: '物語の結末' },
  ];

  // モーダル表示用の状態
  const [openModal, setOpenModal] = useState<{ type: 'templates' | 'dependencies'; fieldKey: FieldKey } | null>(null);

  // ドロップダウンメニュー用の状態
  const [openDropdown, setOpenDropdown] = useState<FieldKey | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 文字数表示のホバー状態
  const [hoveredField, setHoveredField] = useState<FieldKey | null>(null);

  // 文字数超過警告用の状態
  const [overLimitFields, setOverLimitFields] = useState<Set<FieldKey>>(new Set());

  // 確認ダイアログの状態
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    type: 'reset-all' | 'clear-field' | null;
    fieldKey?: FieldKey;
  }>({
    isOpen: false,
    type: null,
  });

  // 自動保存
  const { isSaving, saveStatus, lastSaved, handleSave } = useAutoSave(
    formData,
    useCallback(async (value: PlotFormData) => {
      if (!currentProject) return;
      const updatedPlot = {
        ...currentProject.plot,
        theme: value.theme,
        setting: value.setting,
        hook: value.hook,
        protagonistGoal: value.protagonistGoal,
        mainObstacle: value.mainObstacle,
        ending: value.ending,
      };
      await updateProject({ plot: updatedPlot }, false);
    }, [currentProject, updateProject])
  );

  // 入力履歴を保存する関数
  const saveToHistory = useCallback((data: PlotFormData) => {
    if (historyRef.current) {
      historyRef.current = false;
      return;
    }

    setHistory(prev => {
      const currentIndex = historyIndex;
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push({ ...data });
      // 履歴は最大件数まで保持
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_INDEX));
  }, [historyIndex]);

  // フォームデータ変更時に履歴を保存（初回のみ）
  useEffect(() => {
    if (isInitialMountRef.current && history.length === 0) {
      // 初回のみ現在の状態を履歴に保存
      isInitialMountRef.current = false;
      saveToHistory(formData);
    }
  }, [history.length, saveToHistory, formData]);

  // プロジェクトが変更されたときにformDataを更新
  useEffect(() => {
    if (currentProject) {
      const newFormData = {
        theme: currentProject.plot?.theme || '',
        setting: currentProject.plot?.setting || '',
        hook: currentProject.plot?.hook || '',
        protagonistGoal: currentProject.plot?.protagonistGoal || '',
        mainObstacle: currentProject.plot?.mainObstacle || '',
        ending: currentProject.plot?.ending || '',
      };
      historyRef.current = true;
      setFormData(newFormData);
      setHistory([newFormData]);
      setHistoryIndex(0);
    }
  }, [currentProject]);

  // フォームデータ変更時に履歴を保存（デバウンス付き）
  useEffect(() => {
    // 初回マウント時はスキップ（上記のuseEffectで処理）
    if (isInitialMountRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      saveToHistory(formData);
    }, HISTORY_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [formData, saveToHistory]);


  // フォームデータをリセットする関数
  const handleReset = useCallback(() => {
    setConfirmDialogState({
      isOpen: true,
      type: 'reset-all',
    });
  }, []);

  const handleConfirmReset = useCallback(() => {
    const resetData: PlotFormData = {
      theme: '',
      setting: '',
      hook: '',
      protagonistGoal: '',
      mainObstacle: '',
      ending: '',
    };
    setFormData(resetData);
    saveToHistory(resetData);
  }, [saveToHistory]);

  // テンプレート・サンプルデータ
  const templates = {
    theme: [
      '孤独だった主人公が、友情を手に入れる物語',
      '愛を知らなかった主人公が、愛を知る物語',
      '復讐に囚われていた主人公が、正義を見つける物語',
      '家族を失った主人公が、新しい家族の絆を見つける物語',
      '現実に縛られていた主人公が、夢を叶える物語',
      '感情を理解できなかった主人公が、AIとの交流を通じて感情を理解する物語',
    ],
    setting: [
      '現代の高校を舞台に、主人公の日常と非日常が交錯する世界観。クラスメイトとの人間関係や学校生活が物語の中心となる',
      '20XX年、高度なAI技術が社会に浸透した近未来の日本。地方都市の高校を舞台に、AIの心を開発する少女と、冷徹な天才開発者の出会いを描く',
      '中世ヨーロッパをモチーフにしたファンタジー世界。魔法と剣が存在し、王国間の争いが絶えない',
      '現代の日本を舞台に、主人公の日常と非日常が交錯する世界観。',
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
    ending: [
      '主人公と転校生が和解し、クラス全体が団結して新しい関係を築く',
      'AIアシスタントが感情を獲得し、主人公と共に未来を歩む決意を固める',
      '異世界の危機を救い、主人公は元の世界に戻り、そこで得た経験を活かして成長する',
      '家族の秘密が明らかになり、主人公は真実を受け入れ、新しい家族の絆を築く',
    ],
  };

  // テンプレートを適用する関数
  const applyTemplate = useCallback((fieldKey: FieldKey, template: string) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldKey]: template };
      saveToHistory(newData);
      return newData;
    });
    setOpenModal(null);
  }, [saveToHistory]);

  // フィールドの内容をコピーする関数
  const handleCopyField = useCallback(async (fieldKey: FieldKey) => {
    const content = formData[fieldKey];
    if (!content || content.trim().length === 0) {
      showWarning('コピーする内容がありません。', 3000);
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      showSuccess('クリップボードにコピーしました', 2000);
    } catch (error) {
      console.error('コピーエラー:', error);
      showError('コピーに失敗しました', 3000);
    }
    setOpenDropdown(null);
  }, [formData, showSuccess, showWarning, showError]);

  // フィールドの内容をクリアする関数
  const handleClearField = useCallback((fieldKey: FieldKey) => {
    setConfirmDialogState({
      isOpen: true,
      type: 'clear-field',
      fieldKey,
    });
    setOpenDropdown(null);
  }, []);

  const handleConfirmClearField = useCallback(() => {
    if (!confirmDialogState.fieldKey) return;
    const fieldConfig = {
      theme: { label: 'メインテーマ' },
      setting: { label: '舞台設定' },
      hook: { label: '物語の引き（冒頭の魅力）' },
      protagonistGoal: { label: '主人公の目標' },
      mainObstacle: { label: '主要な障害' },
      ending: { label: '物語の結末' },
    };
    const config = fieldConfig[confirmDialogState.fieldKey];

    setFormData(prev => {
      const newData = { ...prev, [confirmDialogState.fieldKey!]: '' };
      saveToHistory(newData);
      return newData;
    });
    showSuccess(`${config.label}をクリアしました`, 2000);
  }, [confirmDialogState.fieldKey, saveToHistory, showSuccess]);

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
      description: '物語の引き（冒頭の魅力）はメインテーマや舞台設定と連携することで、より魅力的な導入になります。',
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
    ending: {
      description: '物語の結末は、主人公の目標達成や成長、テーマの完結を表現します。結末から逆算して物語を構築することも可能です。',
      relatedFields: ['theme', 'protagonistGoal', 'mainObstacle'],
    },
  };

  // 文字数超過をチェックして状態を更新
  useEffect(() => {
    const overLimit = new Set<FieldKey>();
    fieldOrder.forEach(({ key }) => {
      const maxLength = FIELD_MAX_LENGTHS[key];
      if (formData[key].length > maxLength) {
        overLimit.add(key);
      }
    });
    setOverLimitFields(overLimit);

    // 超過フィールドがある場合、最初のフィールドに自動スクロール
    if (overLimit.size > 0) {
      const firstOverLimitField = Array.from(overLimit)[0];
      const fieldElement = document.getElementById(`field-${firstOverLimitField}`);
      if (fieldElement) {
        setTimeout(() => {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [formData]);

  // ドロップダウンメニューの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown) {
        const ref = dropdownRefs.current[openDropdown];
        if (ref && !ref.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openDropdown]);


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
  const handleFieldAIGenerate = useCallback(async (fieldKey: FieldKey) => {
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
        theme: { label: 'メインテーマ', maxLength: FIELD_MAX_LENGTHS.theme, description: '物語の核心となるメインテーマ' },
        setting: { label: '舞台設定', maxLength: FIELD_MAX_LENGTHS.setting, description: 'ジャンルに合わせた世界観' },
        hook: { label: '物語の引き（冒頭の魅力）', maxLength: FIELD_MAX_LENGTHS.hook, description: '魅力的な物語の引き（冒頭の魅力）' },
        protagonistGoal: { label: '主人公の目標', maxLength: FIELD_MAX_LENGTHS.protagonistGoal, description: '主人公が達成したい目標' },
        mainObstacle: { label: '主要な障害', maxLength: FIELD_MAX_LENGTHS.mainObstacle, description: '主人公の目標を阻む主要な障害' },
        ending: { label: '物語の結末', maxLength: FIELD_MAX_LENGTHS.ending, description: '物語の結末、主人公の成長や目標達成の結果' },
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

      // あらすじ情報を取得（存在する場合のみ）
      const synopsisInfo = currentProject?.synopsis && currentProject.synopsis.trim().length > 0
        ? `\n【参考情報（優先度低）】
あらすじ: ${currentProject.synopsis}

（注：あらすじは参考情報としてのみ使用し、他の設定と矛盾する場合は他の設定を優先してください）`
        : '';

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

` : ''}${synopsisInfo}【生成する項目】
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
            config.label === '物語の引き（冒頭の魅力）' ? '謎の転校生との出会いが引き起こす予想外の展開' :
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
      // 正規表現を動的に構築（エスケープ処理）
      const escapedLabel = config.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const labelPattern = new RegExp(`^${escapedLabel}\\s*[:：]\\s*`, 'i');
      generatedContent = generatedContent
        .replace(/^["']|["']$/g, '')
        .replace(labelPattern, '')
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
  }, [isConfigured, formData, settings, showError, showWarning, showSuccess, saveToHistory, currentProject]);


  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  // ステップナビゲーション用のハンドラー
  const handlePreviousStep = () => {
    // plot1が最初のステップなので、前のステップはない
  };

  const handleNextStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('character');
    }
  };

  return (
    <div>
      {/* ステップナビゲーション */}
      <StepNavigation
        currentStep="plot1"
        onPrevious={handlePreviousStep}
        onNext={handleNextStep}
      />

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

      <div className="space-y-6">
        {/* 基本設定セクション */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              基本設定
            </h2>
          </div>

          <div className="space-y-6">
            {fieldOrder.map((field) => {
              const fieldKey = field.key;
              const fieldConfig = {
                theme: { label: 'メインテーマ', maxLength: FIELD_MAX_LENGTHS.theme, rows: 2, placeholder: '例：友情と成長、愛と犠牲、正義と復讐、家族の絆、夢と現実の狭間', instruction: `一文で簡潔に表現してください（${FIELD_MAX_LENGTHS.theme}文字以内）` },
                setting: { label: '舞台設定', maxLength: FIELD_MAX_LENGTHS.setting, rows: 3, placeholder: '例：現代の高校を舞台に、主人公の日常と非日常が交錯する世界観。クラスメイトとの人間関係や学校生活が物語の中心となる', instruction: `ジャンルに合わせた詳細な世界観を表現してください（${FIELD_MAX_LENGTHS.setting}文字以内）` },
                hook: { label: '物語の引き（冒頭の魅力）', maxLength: FIELD_MAX_LENGTHS.hook, rows: 3, placeholder: '例：謎の転校生との出会いが引き起こす予想外の展開。主人公の過去の秘密が明かされることで、クラス全体の関係性が大きく変化する', instruction: `独創的で読者の興味を引く要素を展開してください（${FIELD_MAX_LENGTHS.hook}文字以内）` },
                protagonistGoal: { label: '主人公の目標', maxLength: FIELD_MAX_LENGTHS.protagonistGoal, rows: 2, placeholder: '例：転校生の正体を突き止め、クラスメイトとの友情を深める', instruction: `主人公が達成したい目標を明確に表現してください（${FIELD_MAX_LENGTHS.protagonistGoal}文字以内）` },
                mainObstacle: { label: '主要な障害', maxLength: FIELD_MAX_LENGTHS.mainObstacle, rows: 2, placeholder: '例：転校生の秘密と、クラス内の対立関係', instruction: `主人公の目標を阻む主要な障害を設定してください（${FIELD_MAX_LENGTHS.mainObstacle}文字以内）` },
                ending: { label: '物語の結末', maxLength: FIELD_MAX_LENGTHS.ending, rows: 3, placeholder: '例：主人公と転校生が和解し、クラス全体が団結して新しい関係を築く', instruction: `物語の結末、主人公の成長や目標達成の結果を表現してください（${FIELD_MAX_LENGTHS.ending}文字以内）` },
              };
              const config = fieldConfig[fieldKey];
              // 推奨項目の定義（メインテーマ、舞台設定、主人公の目標を推奨）
              const isRequired = fieldKey === 'theme' || fieldKey === 'setting' || fieldKey === 'protagonistGoal';
              const isEmpty = !formData[fieldKey] || formData[fieldKey].trim().length === 0;

              const isOverLimit = overLimitFields.has(fieldKey);

              return (
                <div
                  key={fieldKey}
                  className={`p-4 rounded-lg border-2 transition-all relative ${generatingField === fieldKey
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg'
                      : isRequired && isEmpty
                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10'
                        : isOverLimit
                          ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                >
                  {/* 文字数超過警告バナー */}
                  {isOverLimit && (
                    <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg animate-pulse">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                          文字数制限を超過しています（{formData[fieldKey].length - config.maxLength}文字超過）
                        </span>
                      </div>
                    </div>
                  )}

                  {/* AI生成中のフィードバック */}
                  {generatingField === fieldKey && (
                    <InlineAIFeedback
                      message={`AIが「${config.label}」を生成中...`}
                      variant="with-progress"
                    />
                  )}

                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                            {config.label}
                          </label>
                          {isRequired && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700"
                              aria-label="推奨項目"
                            >
                              推奨
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 relative">
                          <AIGenerateButton
                            target={config.label}
                            onGenerate={() => handleFieldAIGenerate(fieldKey)}
                            isLoading={generatingField === fieldKey}
                            disabled={!isConfigured}
                            variant="secondary"
                            size="sm"
                            className="text-xs"
                          />
                          <div className="relative" ref={(el) => { dropdownRefs.current[fieldKey] = el; }}>
                            <button
                              onClick={() => setOpenDropdown(openDropdown === fieldKey ? null : fieldKey)}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="その他のオプション"
                              aria-label="その他のオプション"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            {openDropdown === fieldKey && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
                                <button
                                  onClick={() => handleCopyField(fieldKey)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP']"
                                >
                                  <Copy className="h-4 w-4" />
                                  <span>コピー</span>
                                </button>
                                <button
                                  onClick={() => handleClearField(fieldKey)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 font-['Noto_Sans_JP']"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  <span>クリア</span>
                                </button>
                                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                                <button
                                  onClick={() => {
                                    setOpenModal({ type: 'templates', fieldKey });
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP']"
                                >
                                  <FileText className="h-4 w-4" />
                                  <span>サンプルを表示</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenModal({ type: 'dependencies', fieldKey });
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 font-['Noto_Sans_JP']"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                  <span>関連フィールド</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <textarea
                        id={`field-${fieldKey}`}
                        value={formData[fieldKey]}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, [fieldKey]: e.target.value }));
                        }}
                        placeholder={config.placeholder}
                        rows={config.rows}
                        className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none ${formData[fieldKey].length > config.maxLength
                            ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                            : formData[fieldKey].length > config.maxLength * 0.8
                              ? 'border-yellow-300 dark:border-yellow-700'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                      />
                      <div
                        className="mt-2 space-y-1"
                        onMouseEnter={() => setHoveredField(fieldKey)}
                        onMouseLeave={() => setHoveredField(null)}
                      >
                        {/* 推奨項目の推奨表示 */}
                        {isRequired && isEmpty && (
                          <div className="flex items-start space-x-1 text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP'] mb-1">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{config.label}のユーザーによる設定を推奨します。物語の独自性を保つためにご検討ください。</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                            {hoveredField === fieldKey || formData[fieldKey].length > config.maxLength * 0.8
                              ? config.instruction
                              : `${formData[fieldKey].length}/${config.maxLength}文字`}
                          </p>
                          {(hoveredField === fieldKey || formData[fieldKey].length > config.maxLength * 0.8) && (
                            <span className={`text-sm font-semibold font-['Noto_Sans_JP'] ${formData[fieldKey].length > config.maxLength
                                ? 'text-red-500 dark:text-red-400'
                                : formData[fieldKey].length > config.maxLength * 0.8
                                  ? 'text-yellow-500 dark:text-yellow-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                              {formData[fieldKey].length > config.maxLength
                                ? `超過: ${formData[fieldKey].length - config.maxLength}文字`
                                : `残り: ${config.maxLength - formData[fieldKey].length}文字`}
                            </span>
                          )}
                        </div>
                        {(hoveredField === fieldKey || formData[fieldKey].length > config.maxLength * 0.8) && (
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${formData[fieldKey].length > config.maxLength
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
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 保存ボタンとリセットボタン */}
        {/* 保存ボタンとリセットボタン */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-100 dark:border-gray-700 pt-6">
          <div className="w-full sm:w-auto order-2 sm:order-1">
            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-6 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 hover:scale-105 text-white"
            >
              すべてリセット
            </button>
          </div>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-4 order-1 sm:order-2">
            {/* 保存状態の常時表示 */}
            <div className="flex items-center justify-center sm:justify-end w-full sm:w-auto sm:min-w-[200px] h-6">
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
                  {lastSaved && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{lastSaved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  )}
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-['Noto_Sans_JP']">保存エラー</span>
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
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full sm:w-auto px-6 py-3 rounded-lg transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] ${isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-105'
                } text-white`}
            >
              {isSaving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>

      {/* テンプレート・サンプルモーダル */}
      {openModal?.type === 'templates' && (
        <Modal
          isOpen={true}
          onClose={() => setOpenModal(null)}
          title={`${fieldOrder.find(f => f.key === openModal.fieldKey)?.label} - サンプル例`}
          size="md"
        >
          <div className="space-y-3">
            {templates[openModal.fieldKey].map((template, idx) => (
              <button
                key={idx}
                onClick={() => applyTemplate(openModal.fieldKey, template)}
                className="w-full text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']"
              >
                {template}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* 依存関係モーダル */}
      {openModal?.type === 'dependencies' && (
        <Modal
          isOpen={true}
          onClose={() => setOpenModal(null)}
          title={`${fieldOrder.find(f => f.key === openModal.fieldKey)?.label} - 関連フィールド`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
              {fieldDependencies[openModal.fieldKey].description}
            </p>
            {fieldDependencies[openModal.fieldKey].relatedFields.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                  関連フィールド:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {fieldDependencies[openModal.fieldKey].relatedFields.map(relatedKey => {
                    const relatedField = fieldOrder.find(f => f.key === relatedKey);
                    const relatedFieldConfig = {
                      theme: { label: 'メインテーマ' },
                      setting: { label: '舞台設定' },
                      hook: { label: '物語の引き（冒頭の魅力）' },
                      protagonistGoal: { label: '主人公の目標' },
                      mainObstacle: { label: '主要な障害' },
                      ending: { label: '物語の結末' },
                    };
                    return relatedField ? (
                      <button
                        key={relatedKey}
                        onClick={() => {
                          document.getElementById(`field-${relatedKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          setOpenModal(null);
                        }}
                        className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-['Noto_Sans_JP']"
                      >
                        {relatedFieldConfig[relatedKey as keyof typeof relatedFieldConfig]?.label}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        onClose={() => setConfirmDialogState({ isOpen: false, type: null })}
        onConfirm={() => {
          if (confirmDialogState.type === 'reset-all') {
            handleConfirmReset();
          } else if (confirmDialogState.type === 'clear-field') {
            handleConfirmClearField();
          }
          setConfirmDialogState({ isOpen: false, type: null });
        }}
        title={
          confirmDialogState.type === 'reset-all'
            ? 'すべての入力内容をリセットしますか？'
            : confirmDialogState.type === 'clear-field'
              ? (() => {
                const fieldConfig = {
                  theme: { label: 'メインテーマ' },
                  setting: { label: '舞台設定' },
                  hook: { label: '物語の引き（冒頭の魅力）' },
                  protagonistGoal: { label: '主人公の目標' },
                  mainObstacle: { label: '主要な障害' },
                  ending: { label: '物語の結末' },
                };
                return `${fieldConfig[confirmDialogState.fieldKey!]?.label}の内容をクリアしますか？`;
              })()
              : ''
        }
        message={
          confirmDialogState.type === 'reset-all'
            ? 'すべての入力内容をリセットします。\nこの操作は取り消せません。'
            : ''
        }
        type={confirmDialogState.type === 'reset-all' ? 'danger' : 'warning'}
        confirmLabel={confirmDialogState.type === 'reset-all' ? 'リセット' : 'クリア'}
      />
    </div>
  );
};
