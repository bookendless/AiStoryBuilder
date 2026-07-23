import { useState, useCallback } from 'react';
import { Project, Character } from '../../../../contexts/ProjectContext';
import { AISettings } from '../../../../types/ai';
import { aiService } from '../../../../services/aiService';
import { buildContinueEnhancedPrompt } from '../../../../services/prompts/draft';
import { useGeneration } from '../../../../contexts/GenerationContext';
import type { GenerationAction, ImprovementLog, WeaknessItem } from '../types';
import { formatText } from '../../../../utils/textFormatter';
import { extractJsonObjectString } from '../../../../utils/aiResponseParser';
import { ensureIndexFresh, retrieveForDraft, retrieveForContinue, buildDraftContext } from '../../../../services/rag';
import { getInputCharBudget } from '../../../../services/summarization/tokenBudget';

interface Chapter {
  id: string;
  title: string;
  summary: string;
  draft?: string;
  characters?: string[];
  setting?: string;
  mood?: string;
  keyEvents?: string[];
}

interface ChapterDetails {
  characters: string;
  setting: string;
  mood: string;
  keyEvents: string;
}

interface ProjectContextInfo {
  worldSettings: string;
  glossary: string;
  relationships: string;
  plotInfo: string;
  timeline: string;
}

interface PromptArgs {
  currentChapter: Chapter;
  chapterDetails: ChapterDetails;
  projectCharacters: string;
  previousStory: string;
  previousChapterEnd?: string;
  contextInfo?: ProjectContextInfo;
}

interface UseAIGenerationOptions {
  currentProject: Project | null;
  currentChapter: Chapter | null;
  draft: string;
  selectedChapter: string | null;
  settings: AISettings;
  isConfigured: boolean;
  onDraftUpdate: (content: string) => void;
  onSaveChapterDraft: (chapterId: string, content: string) => Promise<void>;
  onError: (message: string, duration?: number, options?: { title?: string }) => void;
  onWarning: (message: string, duration?: number, options?: { title?: string }) => void;
  onCompletionToast: (message: string) => void;
  addLog: (log: {
    type: 'generateSingle' | 'continue';
    prompt: string;
    response: string;
    error?: string;
    chapterId?: string;
  }) => void;
  getChapterDetails: (chapter: Chapter) => ChapterDetails;
  getProjectContextInfo: () => ProjectContextInfo;
  buildCustomPrompt: (args: PromptArgs) => string;
  setImprovementLogs: React.Dispatch<React.SetStateAction<Record<string, ImprovementLog[]>>>;
  /**
   * AI提案を草案へ適用する前の確認ゲート（差分プレビュー用）。
   * true を返すと適用、false を返すと破棄。未指定時は従来通り即適用。
   */
  confirmDraftReplace?: (params: { oldText: string; newText: string }) => Promise<boolean>;
}

interface UseAIGenerationReturn {
  isGenerating: boolean;
  currentGenerationAction: GenerationAction | null;
  handleAIGenerate: () => Promise<void>;
  handleContinueGeneration: () => Promise<void>;
  handleDescriptionEnhancement: () => Promise<void>;
  handleStyleAdjustment: () => Promise<void>;
  handleShortenText: () => Promise<void>;
  handleChapterImprovement: () => Promise<void>;
  analyzeWeaknesses: () => Promise<{
    critiqueSummary: string;
    weaknesses: WeaknessItem[];
    rawCritique: string;
  } | null>;
  applyWeaknessFixes: (selectedWeaknesses: WeaknessItem[], rawCritique: string) => Promise<void>;
  handleFixCharacterInconsistencies: () => Promise<void>;
  handleCancelGeneration: () => void;
}

/**
 * プロンプト用にキャラクター情報を整形する（口調は最大100文字に切り詰め）
 */
const buildCharacterInfo = (characters: Character[]): string =>
  characters
    .map((char) => {
      let charInfo = `${char.name}`;
      if (char.role) {
        charInfo += ` (${char.role})`;
      }
      if (char.personality) {
        charInfo += `\n  性格: ${char.personality}`;
      }
      if (char.background) {
        charInfo += `\n  背景: ${char.background}`;
      }
      // 口調設定は簡潔に、かつ安全な表現のみを含める
      if (char.speechStyle) {
        const speechStyle = char.speechStyle.trim();
        const truncatedSpeechStyle = speechStyle.length > 100
          ? speechStyle.substring(0, 100) + '...'
          : speechStyle;
        charInfo += `\n  口調: ${truncatedSpeechStyle}`;
      }
      return charInfo;
    })
    .join('\n\n');

/**
 * 文体の詳細指示ブロックを構築する。
 * mode により文体見本の扱いが変わる（critique: 評価基準として併記 / revise: 維持すべき文体として注入）。
 */
const buildStyleDetails = (
  project: Project | null,
  mode: 'critique' | 'revise'
): string => {
  const ws = project?.writingStyle || {};
  const parts: string[] = [];
  if (ws.perspective || ws.formality || ws.rhythm || ws.metaphor || ws.dialogue || ws.emotion || ws.tone) {
    parts.push('【文体の詳細指示】');
    if (ws.perspective) parts.push(`- **人称**: ${ws.perspective}`);
    if (ws.formality) parts.push(`- **硬軟**: ${ws.formality}`);
    if (ws.rhythm) parts.push(`- **リズム**: ${ws.rhythm}`);
    if (ws.metaphor) parts.push(`- **比喩表現**: ${ws.metaphor}`);
    if (ws.dialogue) parts.push(`- **会話比率**: ${ws.dialogue}`);
    if (ws.emotion) parts.push(`- **感情描写**: ${ws.emotion}`);
    if (ws.tone) parts.push(`\n【参考となるトーン】\n${ws.tone}`);
  }
  if (project?.styleSample) {
    parts.push(
      mode === 'critique'
        ? `\n【文体見本（この文体に沿っているかを評価する）】\n---\n${project.styleSample}\n---`
        : `\n【文体見本（最重要・この文章の雰囲気・文体・語り口を維持する）】\n---\n${project.styleSample}\n---\n※見本の内容（出来事・人物）を流用せず、文体・リズム・語彙の傾向だけを真似てください。`
    );
  }
  return parts.join('\n');
};

export const useAIGeneration = ({
  currentProject,
  currentChapter,
  draft,
  selectedChapter,
  settings,
  isConfigured,
  onDraftUpdate,
  onSaveChapterDraft,
  onError,
  onWarning,
  onCompletionToast,
  addLog,
  getChapterDetails,
  getProjectContextInfo,
  buildCustomPrompt,
  setImprovementLogs,
  confirmDraftReplace,
}: UseAIGenerationOptions): UseAIGenerationReturn => {
  const { startTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
  const [currentGenerationAction, setCurrentGenerationAction] = useState<GenerationAction | null>(null);

  // 生成タスクの識別キー。実行中判定はマネージャから導出（ステップ移動でも維持）
  const pid = currentProject?.id ?? 'none';
  const mainKey = `${pid}:draft:main`;
  const isGenerating = isKeyActive(mainKey);

  // AI生成キャンセル処理（マネージャ経由でabort）
  const handleCancelGeneration = useCallback(() => {
    cancelByKey(mainKey);
    setCurrentGenerationAction(null);
    // キャンセルメッセージは呼び出し元で表示するため、ここでは表示しない
  }, [cancelByKey, mainKey]);

  /**
   * AI提案を草案へ適用する共通処理。
   * 確認ゲート（差分プレビュー）が設定されていて既存の草案がある場合は、
   * ユーザーの承認を得てから適用・保存する。
   * @returns 適用した場合 true、破棄した場合 false
   */
  const applyDraftResult = useCallback(async (newText: string, successMessage: string): Promise<boolean> => {
    if (confirmDraftReplace && draft.trim() && newText !== draft) {
      const approved = await confirmDraftReplace({ oldText: draft, newText });
      if (!approved) {
        onCompletionToast('AI提案を破棄しました');
        return false;
      }
    }
    onDraftUpdate(newText);
    if (selectedChapter) {
      await onSaveChapterDraft(selectedChapter, newText);
    }
    onCompletionToast(successMessage);
    return true;
  }, [confirmDraftReplace, draft, selectedChapter, onDraftUpdate, onSaveChapterDraft, onCompletionToast]);

  // 章全体生成
  const handleAIGenerate = useCallback(async () => {
    if (!isConfigured) {
      onError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (!currentProject) return;

    // 確認は親コンポーネントで行う（ConfirmDialogを使用）

    setCurrentGenerationAction('fullDraft');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      if (!currentChapter) {
        onWarning('章を選択してください。', 5000, {
          title: '章が選択されていません',
        });
        return;
      }

      // 章詳細情報を取得
      const chapterDetails = getChapterDetails(currentChapter);

      // プロジェクトのキャラクター情報を整理
      let projectCharacters = buildCharacterInfo(currentProject.characters);

      // 前章までのあらすじを取得
      const currentChapterIndex = currentProject.chapters.findIndex((c) => c.id === currentChapter.id);
      let previousStory = currentProject.chapters
        .slice(0, currentChapterIndex)
        .map((c, index: number) => `第${index + 1}章「${c.title}」\nあらすじ: ${c.summary || '（あらすじなし）'}`)
        .join('\n\n');

      // 直前の章の末尾を取得（一貫性確保のため）
      let previousChapterEnd = '';
      if (currentChapterIndex > 0) {
        const prevChapter = currentProject.chapters[currentChapterIndex - 1];
        if (prevChapter.draft && prevChapter.draft.trim()) {
          // 末尾1000文字程度を取得
          const prevDraft = prevChapter.draft.trim();
          previousChapterEnd = prevDraft.length > 1000
            ? '...' + prevDraft.slice(-1000)
            : prevDraft;
        }
      }

      // 設定情報の取得
      let contextInfo = getProjectContextInfo();

      // 関連情報検索（RAG）: 有効時は全量ダンプを関連チャンクの選択注入に置き換える。
      // 失敗時・小規模プロジェクト（全量が予算内）では従来コンテキストのまま生成する。
      if (settings.ragEnabled) {
        try {
          await ensureIndexFresh(currentProject, undefined, signal);
          const retrieved = await retrieveForDraft(currentProject, currentChapter);
          const ragContext = buildDraftContext({
            project: currentProject,
            currentChapter,
            retrieved,
            budget: getInputCharBudget(settings),
            previousChapterEndLength: previousChapterEnd.length,
          });
          if (ragContext) {
            previousStory = ragContext.previousStory;
            projectCharacters = ragContext.projectCharacters;
            contextInfo = {
              ...contextInfo,
              worldSettings: ragContext.worldSettings,
              glossary: ragContext.glossary,
            };
          }
        } catch (ragError) {
          console.warn('RAG検索に失敗したため従来のコンテキストで生成します:', ragError);
        }
      }

      // プロンプトを構築
      const prompt = buildCustomPrompt({
        currentChapter,
        chapterDetails,
        projectCharacters,
        previousStory,
        previousChapterEnd,
        contextInfo,
      });

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      // AIログに記録
      addLog({
        type: 'generateSingle',
        prompt,
        response: response.content || '',
        error: response.error,
        chapterId: selectedChapter || undefined,
      });

      if (response && response.content) {
        await applyDraftResult(response.content, '章全体の生成が完了しました');
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('AI生成中にエラーが発生しました', 7000, {
          title: 'AI生成エラー',
        });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [
    isConfigured,
    currentProject,
    currentChapter,
    selectedChapter,
    settings,
    getChapterDetails,
    getProjectContextInfo,
    buildCustomPrompt,
    startTask,
    completeTask,
    mainKey,
    applyDraftResult,
    onError,
    onWarning,
    addLog,
  ]);

  // 続き生成
  const handleContinueGeneration = useCallback(async () => {
    if (!isConfigured) {
      onError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (!currentProject || !selectedChapter) return;

    setCurrentGenerationAction('continue');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      // プロジェクトのキャラクター情報を整理
      let projectCharacters = buildCharacterInfo(currentProject.characters);

      // 設定情報の取得
      let contextInfo = getProjectContextInfo();

      // 関連情報検索（RAG）: 有効時は全量ダンプを関連チャンクの選択注入に置き換え、
      // 過去章の抜粋・関連伏線を追加コンテキストとして付加する。失敗時は従来のまま生成。
      let ragPastExcerpts: string | undefined;
      if (settings.ragEnabled && currentChapter) {
        try {
          await ensureIndexFresh(currentProject, undefined, signal);
          const retrieved = await retrieveForContinue(currentProject, currentChapter, draft);
          const ragContext = buildDraftContext({
            project: currentProject,
            currentChapter,
            retrieved,
            budget: getInputCharBudget(settings),
            // 草案全文が {currentText} として逐語で入るため固定費として控除する
            previousChapterEndLength: draft.length,
          });
          if (ragContext) {
            projectCharacters = ragContext.projectCharacters;
            contextInfo = {
              ...contextInfo,
              worldSettings: ragContext.worldSettings,
              glossary: ragContext.glossary,
            };
            ragPastExcerpts = ragContext.previousStory || undefined;
          }
        } catch (ragError) {
          console.warn('RAG検索に失敗したため従来のコンテキストで生成します:', ragError);
        }
      }

      // 文体設定の取得（プロジェクト設定から、またはデフォルト値）
      const writingStyle = currentProject.writingStyle || {};
      const style = writingStyle.style || '現代小説風';
      const perspective = writingStyle.perspective || '';
      const formality = writingStyle.formality || '';
      const rhythm = writingStyle.rhythm || '';
      const metaphor = writingStyle.metaphor || '';
      const dialogue = writingStyle.dialogue || '';
      const emotion = writingStyle.emotion || '';
      const tone = writingStyle.tone || '';
      const styleSample = currentProject.styleSample || '';

      // プロット情報の整理
      const plotStructure = currentProject.plot?.structure
        ? (currentProject.plot.structure === 'kishotenketsu'
          ? `起承転結構成\n起: ${currentProject.plot.ki || '未設定'}\n承: ${currentProject.plot.sho || '未設定'}\n転: ${currentProject.plot.ten || '未設定'}\n結: ${currentProject.plot.ketsu || '未設定'}`
          : currentProject.plot.structure === 'three-act'
            ? `三幕構成\n第1幕: ${currentProject.plot.act1 || '未設定'}\n第2幕: ${currentProject.plot.act2 || '未設定'}\n第3幕: ${currentProject.plot.act3 || '未設定'}`
            : currentProject.plot.structure === 'four-act'
              ? `四幕構成\n第1幕: ${currentProject.plot.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot.fourAct4 || '未設定'}`
              : currentProject.plot.structure === 'heroes-journey'
                ? `ヒーローズ・ジャーニー\n日常の世界: ${currentProject.plot.hj1 || '未設定'}\n冒険への誘い: ${currentProject.plot.hj2 || '未設定'}\n境界越え: ${currentProject.plot.hj3 || '未設定'}\n試練と仲間: ${currentProject.plot.hj4 || '未設定'}\n最大の試練: ${currentProject.plot.hj5 || '未設定'}\n報酬: ${currentProject.plot.hj6 || '未設定'}\n帰路: ${currentProject.plot.hj7 || '未設定'}\n復活と帰還: ${currentProject.plot.hj8 || '未設定'}`
                : currentProject.plot.structure === 'beat-sheet'
                  ? `ビートシート\n導入 (Setup): ${currentProject.plot.bs1 || '未設定'}\n決断 (Break into Two): ${currentProject.plot.bs2 || '未設定'}\n試練 (Fun and Games): ${currentProject.plot.bs3 || '未設定'}\n転換点 (Midpoint): ${currentProject.plot.bs4 || '未設定'}\n危機 (All Is Lost): ${currentProject.plot.bs5 || '未設定'}\nクライマックス (Finale): ${currentProject.plot.bs6 || '未設定'}\n結末 (Final Image): ${currentProject.plot.bs7 || '未設定'}`
                  : currentProject.plot.structure === 'mystery-suspense'
                    ? `ミステリー・サスペンス構成\n発端（事件発生）: ${currentProject.plot.ms1 || '未設定'}\n捜査（初期）: ${currentProject.plot.ms2 || '未設定'}\n仮説とミスリード: ${currentProject.plot.ms3 || '未設定'}\n第二の事件/急展開: ${currentProject.plot.ms4 || '未設定'}\n手がかりの統合: ${currentProject.plot.ms5 || '未設定'}\n解決（真相解明）: ${currentProject.plot.ms6 || '未設定'}\nエピローグ: ${currentProject.plot.ms7 || '未設定'}`
                    : '未設定')
        : '未設定';

      // buildPromptを使用してプロンプトを構築
      const prompt = aiService.buildPrompt('draft', 'continue', {
        currentText: draft,
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        projectCharacters: projectCharacters || '未設定',
        plotTheme: currentProject?.plot?.theme || '未設定',
        plotSetting: currentProject?.plot?.setting || '未設定',
        plotStructure: plotStructure,
        style: style,
        perspective: perspective,
        formality: formality,
        rhythm: rhythm,
        metaphor: metaphor,
        dialogue: dialogue,
        emotion: emotion,
        tone: tone,
        styleSample: styleSample,
      });

      // 追加のコンテキスト情報・執筆指示をプロンプトに付加
      const enhancedPrompt = buildContinueEnhancedPrompt(prompt, { ...contextInfo, pastExcerpts: ragPastExcerpts });

const response = await aiService.generateContent({
        prompt: enhancedPrompt,
        type: 'draft',
        settings,
        signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      // AIログに記録
      addLog({
        type: 'continue',
        prompt: enhancedPrompt,
        response: response.content || '',
        error: response.error,
        chapterId: selectedChapter || undefined,
      });

      if (response && response.content) {
        const newContent = draft + '\n\n' + response.content;
        await applyDraftResult(newContent, '文章の続きを生成しました');
      }
    } catch (error) {
      console.error('続き生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('続き生成中にエラーが発生しました', 7000, {
          title: '続き生成エラー',
        });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [
    isConfigured,
    currentProject,
    selectedChapter,
    draft,
    currentChapter,
    settings,
    getProjectContextInfo,
    startTask,
    completeTask,
    mainKey,
    applyDraftResult,
    onError,
    addLog,
  ]);

  // 描写強化
  const handleDescriptionEnhancement = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('description');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      const prompt = aiService.buildPrompt('draft', 'enhanceDescription', {
        currentText: draft,
      });

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      if (response && response.content) {
        await applyDraftResult(response.content, '描写を強化しました');
      }
    } catch (error) {
      console.error('描写強化エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('描写強化中にエラーが発生しました', 7000, {
          title: '描写強化エラー',
        });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [selectedChapter, draft, settings, startTask, completeTask, mainKey, applyDraftResult, onError]);

  // 文体調整
  const handleStyleAdjustment = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('style');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      const prompt = aiService.buildPrompt('draft', 'adjustStyle', {
        currentText: draft,
        currentLength: draft.length.toString(),
      });

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      if (response && response.content) {
        await applyDraftResult(response.content, '文体を調整しました');
      }
    } catch (error) {
      console.error('文体調整エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('文体調整中にエラーが発生しました', 7000, {
          title: '文体調整エラー',
        });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [selectedChapter, draft, settings, startTask, completeTask, mainKey, applyDraftResult, onError]);

  // 文章短縮
  const handleShortenText = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('shorten');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      const prompt = aiService.buildPrompt('draft', 'shorten', {
        currentText: draft,
      });

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      if (response && response.content) {
        await applyDraftResult(response.content, '文章を短縮しました');
      }
    } catch (error) {
      console.error('文章短縮エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('文章短縮中にエラーが発生しました', 7000, {
          title: '文章短縮エラー',
        });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [selectedChapter, draft, settings, startTask, completeTask, mainKey, applyDraftResult, onError]);

  // 章全体改善（描写強化＋文体調整の組み合わせ）
  const handleChapterImprovement = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    if (!isConfigured) {
      onError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    setCurrentGenerationAction('improve');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      const prompt = aiService.buildPrompt('draft', 'improve', {
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
        currentLength: draft.length.toString(),
      });

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      if (response && response.content) {
        await applyDraftResult(response.content, '章全体を改善しました');
      }
    } catch (error) {
      console.error('章全体改善エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('章全体改善中にエラーが発生しました', 7000, {
          title: '章全体改善エラー',
        });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [
    selectedChapter,
    draft,
    isConfigured,
    currentChapter,
    settings,
    startTask,
    completeTask,
    mainKey,
    applyDraftResult,
    onError,
  ]);

  // 弱点の特定（分析フェーズ）
  const analyzeWeaknesses = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return null;

    if (!isConfigured) {
      onError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return null;
    }

    setCurrentGenerationAction('critique');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      // フェーズ1：批評フェーズ（弱点の特定と修正案の生成）
      const critiqueStyle = currentProject?.writingStyle?.style || '現代小説風';
      const critiqueStyleDetails = buildStyleDetails(currentProject, 'critique');

      const critiquePrompt = aiService.buildPrompt('draft', 'critique', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
        style: critiqueStyle,
        styleDetails: critiqueStyleDetails,
      });

const critiqueResponse = await aiService.generateContent({
        prompt: critiquePrompt,
        type: 'draft',
        settings,
        signal,
      });

      if (signal.aborted) {
        return null;
      }

      if (!critiqueResponse || !critiqueResponse.content) {
        throw new Error('批評フェーズの応答が取得できませんでした');
      }

      // JSON形式の応答を抽出・パース
      let critiqueSummary = '';
      let weaknesses: WeaknessItem[] = []; // 型適用

      try {
        const jsonString = extractJsonObjectString(critiqueResponse.content);

        if (jsonString && jsonString.startsWith('{')) {
          const critiqueData = JSON.parse(jsonString) as {
            summary?: string;
            weaknesses?: WeaknessItem[];
          };

          if (critiqueData.summary) {
            critiqueSummary = critiqueData.summary;
          }

          if (critiqueData.weaknesses && Array.isArray(critiqueData.weaknesses)) {
            weaknesses = critiqueData.weaknesses.filter((w) => w && w.aspect && w.problem);
          }
        } else {
          // テキスト解析のフォールバック
          critiqueSummary = critiqueResponse.content.substring(0, 500) + '...';
        }
      } catch (parseError) {
        console.warn('Critique JSON Parse Error:', parseError);
        critiqueSummary = critiqueResponse.content.substring(0, 500) + '...';
      }

      return {
        critiqueSummary,
        weaknesses,
        rawCritique: critiqueResponse.content,
      };

    } catch (error) {
      console.error('弱点特定エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('弱点特定中にエラーが発生しました', 7000, {
          title: '弱点特定エラー',
        });
      }
      return null;
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [
    selectedChapter,
    draft,
    isConfigured,
    currentProject,
    currentChapter,
    settings,
    startTask,
    completeTask,
    mainKey,
    onError,
  ]);

  // 弱点の修正（修正フェーズ）
  const applyWeaknessFixes = useCallback(async (
    selectedWeaknesses: WeaknessItem[],
    rawCritique: string
  ) => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('fixWeaknesses');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      // 選択された弱点のみを含むCritiqueResultを構築
      const filteredCritique = {
        weaknesses: selectedWeaknesses,
        summary: "ユーザーが選択した修正項目に基づく改訂",
      };

      const critiqueResult = JSON.stringify(filteredCritique, null, 2);

      const reviseStyle = currentProject?.writingStyle?.style || '現代小説風';
      const reviseStyleDetails = buildStyleDetails(currentProject, 'revise');

      // 批評フェーズと同様に全文を渡す（切り詰めると末尾が消失し内容が薄くなるため）
      const revisionPrompt = aiService.buildPrompt('draft', 'revise', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
        critiqueResult: critiqueResult,
        currentLength: draft.length.toString(),
        style: reviseStyle,
        styleDetails: reviseStyleDetails,
      });

const revisionResponse = await aiService.generateContent({
        prompt: revisionPrompt,
        type: 'draft',
        settings,
        signal,
      });

      if (signal.aborted) return;

      if (!revisionResponse || !revisionResponse.content) {
        throw new Error('改訂フェーズの応答が取得できませんでした');
      }

      // 修正結果の解析（handleSelfRefineImprovementと同様のロジック）
      let revisedText = '';
      let improvementSummary = '';
      let phase2Changes: string[] = [];

      try {
        const jsonString = extractJsonObjectString(revisionResponse.content);

        if (jsonString && jsonString.startsWith('{')) {
          const parsed = JSON.parse(jsonString) as {
            revisedText?: string;
            revised_text?: string;
            improvementSummary?: string;
            improvement_summary?: string;
            changes?: string[];
          };
          const rawRevisedText = parsed.revisedText || parsed.revised_text || '';
          revisedText = formatText(rawRevisedText);
          improvementSummary = parsed.improvementSummary || parsed.improvement_summary || '';
          phase2Changes = parsed.changes || [];
        } else {
          throw new Error('JSON not found');
        }

        // フォールバックロジック（簡略化）
        if (!revisedText || revisedText.length < 100) {
          const textPatterns = [
            /改訂後の文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
            /改善された文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
          ];
          for (const pattern of textPatterns) {
            const match = revisionResponse.content.match(pattern);
            if (match && match[1] && match[1].length > 100) {
              revisedText = formatText(match[1].trim());
              break;
            }
          }
        }

        if (!revisedText) {
          // 最終手段：JSON構造を除去して本文とみなす
          revisedText = formatText(revisionResponse.content
            .replace(/\{[\s\S]*?\}/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .trim());
        }

      } catch (e) {
        console.warn('Revise parsing error', e);
        revisedText = formatText(revisionResponse.content); // 失敗時は全体
      }

      if (revisedText.trim()) {
        const applied = await applyDraftResult(
          revisedText,
          improvementSummary
            ? `選択した ${selectedWeaknesses.length} 件の弱点を修正しました`
            : '修正が完了しました'
        );

        if (applied) {
          const logId = `log-${Date.now()}`;
          const improvementLog: ImprovementLog = {
            id: logId,
            timestamp: Date.now(),
            chapterId: selectedChapter!,
            phase1Critique: rawCritique,
            phase2Summary: improvementSummary || '改善戦略の要約が取得できませんでした',
            phase2Changes: phase2Changes,
            originalLength: draft.length,
            revisedLength: revisedText.length,
          };

          setImprovementLogs(prev => {
            const chapterLogs = prev[selectedChapter!] || [];
            return {
              ...prev,
              [selectedChapter!]: [improvementLog, ...chapterLogs].slice(0, 20),
            };
          });
        }
      } else {
        throw new Error('改訂後の文章が空です');
      }

    } catch (error) {
      console.error('弱点修正エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('修正処理中にエラーが発生しました', 7000, { title: '修正エラー' });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [
    selectedChapter,
    draft,
    currentProject,
    currentChapter,
    settings,
    startTask,
    completeTask,
    mainKey,
    applyDraftResult,
    onError,
    setImprovementLogs,
  ]);

  // キャラクター情報のブレ修正
  const handleFixCharacterInconsistencies = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('fixCharacter');
    const { id: taskId, signal } = startTask({ key: mainKey, label: '草案を生成中', step: 'draft' });

    try {
      // プロジェクトのキャラクター情報を整理
      const projectCharacters = currentProject?.characters
        .map((char) => {
          let charInfo = `【${char.name}】`;
          if (char.role) charInfo += `\n役割: ${char.role}`;
          if (char.personality) charInfo += `\n性格: ${char.personality}`;
          if (char.appearance) charInfo += `\n外見: ${char.appearance}`;
          if (char.background) charInfo += `\n背景: ${char.background}`;
          if (char.speechStyle) {
            const truncatedSpeechStyle =
              char.speechStyle.length > 100
                ? char.speechStyle.substring(0, 100) + '...'
                : char.speechStyle;
            charInfo += `\n口調: ${truncatedSpeechStyle}`;
          }
          return charInfo;
        })
        .join('\n\n') || '未設定';

      const prompt = aiService.buildPrompt('draft', 'fixCharacterInconsistencies', {
        currentText: draft,
        projectCharacters,
        currentLength: draft.length.toString(),
      });

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
      });

      if (signal.aborted) {
        return;
      }

      if (response && response.content) {
        await applyDraftResult(response.content, 'キャラクター情報のブレを修正しました');
      }
    } catch (error) {
      console.error('キャラクター修正エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('キャラクター修正中にエラーが発生しました', 7000, {
          title: 'キャラクター修正エラー',
        });
      }
    } finally {
      completeTask(taskId);
      setCurrentGenerationAction(null);
    }
  }, [
    selectedChapter,
    draft,
    currentProject,
    settings,
    startTask,
    completeTask,
    mainKey,
    applyDraftResult,
    onError,
  ]);

  return {
    isGenerating,
    currentGenerationAction,
    handleAIGenerate,
    handleContinueGeneration,
    handleDescriptionEnhancement,
    handleStyleAdjustment,
    handleShortenText,
    handleChapterImprovement,
    analyzeWeaknesses,
    applyWeaknessFixes,
    handleFixCharacterInconsistencies,
    handleCancelGeneration,
  };
};

