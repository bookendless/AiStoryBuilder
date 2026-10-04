import { useState, useCallback, useRef } from 'react';
import { useProject } from '../../../../contexts/useProject';
import { generateNarrativeProse, generationSignature, NarrativeGenerationError } from '../../../../services/narrative/context';
import { useDraftResult } from './useDraftResult';
import { Project } from '../../../../contexts/ProjectContext';
import { AISettings, AIResponse } from '../../../../types/ai';
import { getAIResponseIssue } from '../../../../services/aiResponseMetadata';
import { aiService } from '../../../../services/aiService';
import { buildContinueEnhancedPrompt, DRAFT_PROMPT_CAP } from '../../../../services/prompts/draft';
import { useGeneration } from '../../../../contexts/useGeneration';
import type { GenerationAction, ImprovementLog, WeaknessItem } from '../types';
import { formatText } from '../../../../utils/textFormatter';
import { parseJsonObject } from '../../../../utils/jsonExtract';
import { normalizeForQuoteMatch, quoteExists } from '../../../../services/quotes/verifyQuote';
import { ensureIndexFresh, retrieveForDraft, retrieveForContinue, buildDraftContext } from '../../../../services/rag';
import { getInputCharBudget } from '../../../../services/summarization/tokenBudget';
import { formatCharacters } from '../../../../services/context/formatCharacter';
import { buildPreviousStory } from '../../../../services/context/buildPreviousStory';
import type { ChapterDetails } from '../../../../utils/chapterUtils';

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
   * 既存本文の置換をグローバルな差分プレビューで確認する（既定 true）。
   */
  reviewDraftResult?: boolean;
  narrativeInstructions?: string;
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
  onError,
  onWarning,
  onCompletionToast,
  addLog,
  getChapterDetails,
  getProjectContextInfo,
  buildCustomPrompt,
  setImprovementLogs,
  reviewDraftResult = true,
  narrativeInstructions = '',
}: UseAIGenerationOptions): UseAIGenerationReturn => {
  const { commitProjectUpdate } = useProject();
  const stageDraftResult = useDraftResult(currentProject, selectedChapter, draft);
  const active = useRef({ projectId: currentProject?.id, chapterId: selectedChapter, settings, narrativeInstructions });
  active.current = { projectId: currentProject?.id, chapterId: selectedChapter, settings, narrativeInstructions };
  const { startTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
  const [currentGenerationAction, setCurrentGenerationAction] = useState<GenerationAction | null>(null);

  // 生成タスクの識別キー。実行中判定はマネージャから導出（ステップ移動でも維持）
  const pid = currentProject?.id ?? 'none';
  // AI利用記録の集計単位（未保存プロジェクトでは undefined になり記録されない）
  const usageProjectId = currentProject?.id;
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
   * 既存草案は確認待ちへ登録し、承認後に保存する。
   * @returns 即時適用した場合 true、確認待ちの場合 false
   */
  const applyDraftResult = useCallback(async (newText: string, successMessage: string, onApplied?: () => void): Promise<boolean> => {
    const applied = await stageDraftResult(newText, successMessage, { review: reviewDraftResult && !!draft.trim() && newText !== draft, onApplied });
    if (applied) onCompletionToast(successMessage);
    return applied;
  }, [stageDraftResult, reviewDraftResult, draft, onCompletionToast]);

  const validateDraftResponse = useCallback(async (response: AIResponse) => {
    const issue = getAIResponseIssue(response);
    if (!issue) return;
    if (response.content?.trim()) await stageDraftResult(response.content, '', {
      review: true, blockedReason: issue,
      notice: '生成を完了扱いにできなかったため、受信した本文を確認用に保持しています。',
    });
    throw new Error(issue);
  }, [stageDraftResult]);

  const runWithNarrative = useCallback(async (mode: 'chapter' | 'continue' | 'revise', signal: AbortSignal, basePrompt: string) => {
    if (!currentProject || !selectedChapter) return;
    const expected = generationSignature(currentProject, selectedChapter);
    const assertCurrent = (p: Project) => {
      if (signal.aborted) throw new DOMException('中断しました', 'AbortError');
      if (p.id !== currentProject.id || active.current.projectId !== p.id || active.current.chapterId !== selectedChapter || active.current.narrativeInstructions !== narrativeInstructions || JSON.stringify(active.current.settings) !== JSON.stringify(settings) || generationSignature(p, selectedChapter) !== expected) throw new Error('生成中に本文・設定・確定状態が変わりました。再生成してください');
    };
    const saved = await commitProjectUpdate(p => { assertCurrent(p); return {}; }, currentProject.id);
    assertCurrent(saved.project);
    // Chapter prompts already contain the author's custom instructions.
    const prompt = mode !== 'chapter' && narrativeInstructions.trim() ? `${basePrompt}\n\n【作者の追加指示】\n${narrativeInstructions}` : basePrompt;
    let generated: Awaited<ReturnType<typeof generateNarrativeProse>>;
    try {
      generated = await generateNarrativeProse(saved.project, selectedChapter, prompt, settings, signal);
    } catch (error) {
      if (error instanceof NarrativeGenerationError) {
        addLog({ type: mode === 'continue' ? 'continue' : 'generateSingle', prompt: error.context.prompt, response: error.response.content, error: error.message, chapterId: selectedChapter });
        if (error.response.content.trim()) await stageDraftResult(error.response.content, '', { review: true, blockedReason: error.message, notice: '生成を完了扱いにできなかったため、受信した本文を確認用に保持しています。' });
      }
      throw error;
    }
    const { response, context } = generated;
    const newText = mode === 'continue' ? `${draft}\n\n${response.content}` : response.content;
    addLog({ type: mode === 'continue' ? 'continue' : 'generateSingle', prompt: context.prompt, response: response.content, chapterId: selectedChapter });
    const notice = response.finishReason !== 'stop' ? 'AIの終了理由を取得できませんでした。文章が途中で切れていないか、末尾まで確認してから適用してください。' : undefined;
    // 過去の出来事は蓄積し続けるため、入力上限で省いた件数を作者に見えるようにする
    const info = context.omittedIds.length ? `確定した過去の出来事 ${context.usedIds.length + context.omittedIds.length}件のうち ${context.omittedIds.length}件は、入力上限のため今回の生成に含めていません（この章との関連が低いものから省略）。` : undefined;
    await stageDraftResult(newText, '確定状態を使った生成結果を保存しました。この章の物語状態を解析・確認してください', { review: true, notice, info, signature: expected });
  }, [currentProject, selectedChapter, settings, commitProjectUpdate, draft, addLog, narrativeInstructions, stageDraftResult]);

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
      let projectCharacters = formatCharacters(currentProject.characters);

      // 前章までのあらすじを取得（直近ほど厚く、古い章は圧縮・最後はタイトルのみへ）
      const currentChapterIndex = currentProject.chapters.findIndex((c) => c.id === currentChapter.id);
      let previousStory = buildPreviousStory(currentProject.chapters, currentChapterIndex);

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

      if (currentProject.narrativeMemory?.enabled) { await runWithNarrative('chapter', signal, prompt); return; }

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
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

      await validateDraftResponse(response);
      if (!response.content?.trim()) throw new Error('AIから草案の本文を受信できませんでした。AIログを確認してください');
      if (response.content) {
        await applyDraftResult(response.content, '章全体の生成が完了しました');
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError(error instanceof Error ? error.message : 'AI生成中にエラーが発生しました', 7000, {
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
    validateDraftResponse,
    onError,
    onWarning,
    addLog,
    usageProjectId,
    runWithNarrative,
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
      let projectCharacters = formatCharacters(currentProject.characters);

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

      if (currentProject.narrativeMemory?.enabled) { await runWithNarrative('continue', signal, enhancedPrompt); return; }

const response = await aiService.generateContent({
        prompt: enhancedPrompt,
        type: 'draft',
        settings,
        signal,
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
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

      await validateDraftResponse(response);
      if (!response.content?.trim()) throw new Error('AIから草案の本文を受信できませんでした。AIログを確認してください');
      if (response.content) {
        const newContent = draft + '\n\n' + response.content;
        await applyDraftResult(newContent, '文章の続きを生成しました');
      }
    } catch (error) {
      console.error('続き生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError(error instanceof Error ? error.message : '続き生成中にエラーが発生しました', 7000, {
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
    validateDraftResponse,
    onError,
    addLog,
    usageProjectId,
    runWithNarrative,
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
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      await validateDraftResponse(response);
      if (!response.content?.trim()) throw new Error('AIから草案の本文を受信できませんでした。AIログを確認してください');
      if (response.content) {
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
  }, [selectedChapter, draft, settings, startTask, completeTask, mainKey, applyDraftResult, validateDraftResponse, onError, usageProjectId]);

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
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      await validateDraftResponse(response);
      if (!response.content?.trim()) throw new Error('AIから草案の本文を受信できませんでした。AIログを確認してください');
      if (response.content) {
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
  }, [selectedChapter, draft, settings, startTask, completeTask, mainKey, applyDraftResult, validateDraftResponse, onError, usageProjectId]);

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
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      await validateDraftResponse(response);
      if (!response.content?.trim()) throw new Error('AIから草案の本文を受信できませんでした。AIログを確認してください');
      if (response.content) {
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
  }, [selectedChapter, draft, settings, startTask, completeTask, mainKey, applyDraftResult, validateDraftResponse, onError, usageProjectId]);

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

      if (currentProject?.narrativeMemory?.enabled) { await runWithNarrative('revise', signal, prompt); return; }

const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal,
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
      });

      // キャンセルされた場合は処理をスキップ
      if (signal.aborted) {
        return;
      }

      await validateDraftResponse(response);
      if (!response.content?.trim()) throw new Error('AIから草案の本文を受信できませんでした。AIログを確認してください');
      if (response.content) {
        await applyDraftResult(response.content, '章全体を改善しました');
      }
    } catch (error) {
      console.error('章全体改善エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError(error instanceof Error ? error.message : '章全体改善中にエラーが発生しました', 7000, {
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
    validateDraftResponse,
    onError,
    usageProjectId,
    currentProject,
    runWithNarrative,
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
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'review',
      });

      if (signal.aborted) {
        return null;
      }

      if (!critiqueResponse || !critiqueResponse.content) {
        throw new Error('批評フェーズの応答が取得できませんでした');
      }

      const critiqueIssue = getAIResponseIssue(critiqueResponse);
      if (critiqueIssue) throw new Error(critiqueIssue);
      // JSON形式の応答を抽出・パース
      let critiqueSummary = '';
      let weaknesses: WeaknessItem[] = []; // 型適用

      try {
        const critiqueData = parseJsonObject<{
          summary?: string;
          weaknesses?: WeaknessItem[];
        }>(critiqueResponse.content);

        if (critiqueData) {
          if (critiqueData.summary) {
            critiqueSummary = critiqueData.summary;
          }

          if (critiqueData.weaknesses && Array.isArray(critiqueData.weaknesses)) {
            // 引用が本文に実在しない場合、指摘自体は残して引用だけを落とす
            // （引用がなくても指摘には意味があるため。照合はAIが読んだサニタイズ後の本文に対して行う）
            const normalizedDraft = normalizeForQuoteMatch(draft);
            weaknesses = critiqueData.weaknesses
              .filter((w) => w && w.aspect && w.problem)
              .map((w) => {
                const quote = typeof w.quote === 'string' ? w.quote.trim() : '';
                return quoteExists(quote, normalizedDraft) ? { ...w, quote } : { ...w, quote: undefined };
              });
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
    usageProjectId,
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
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
      });

      if (signal.aborted) return;

      if (!revisionResponse || !revisionResponse.content) {
        throw new Error('改訂フェーズの応答が取得できませんでした');
      }

      // 修正結果の解析（handleSelfRefineImprovementと同様のロジック）
      await validateDraftResponse(revisionResponse);
      let revisedText = '';
      let improvementSummary = '';
      let phase2Changes: string[] = [];

      try {
        const parsed = parseJsonObject<{
          revisedText?: string;
          revised_text?: string;
          improvementSummary?: string;
          improvement_summary?: string;
          changes?: string[];
        }>(revisionResponse.content);

        if (parsed) {
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
        await applyDraftResult(
          revisedText,
          improvementSummary
            ? `選択した ${selectedWeaknesses.length} 件の弱点を修正しました`
            : '修正が完了しました',
          () => {
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
        );
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
    validateDraftResponse,
    onError,
    setImprovementLogs,
    usageProjectId,
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
        maxPromptLength: DRAFT_PROMPT_CAP,
        projectId: usageProjectId,
        chapterId: selectedChapter || undefined,
        purpose: 'prose',
      });

      if (signal.aborted) {
        return;
      }

      await validateDraftResponse(response);
      if (!response.content?.trim()) throw new Error('AIから草案の本文を受信できませんでした。AIログを確認してください');
      if (response.content) {
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
    validateDraftResponse,
    onError,
    usageProjectId,
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

