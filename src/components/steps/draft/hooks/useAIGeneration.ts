import { useState, useCallback, useRef } from 'react';
import { Project, Character } from '../../../../contexts/ProjectContext';
import { AISettings } from '../../../../types/ai';
import { aiService } from '../../../../services/aiService';
import type { GenerationAction, ImprovementLog, WeaknessItem } from '../types';
import { formatText } from '../../../../utils/textFormatter';

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
}: UseAIGenerationOptions): UseAIGenerationReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenerationAction, setCurrentGenerationAction] = useState<GenerationAction | null>(null);
  const generationAbortControllerRef = useRef<AbortController | null>(null);

  // AI生成キャンセル処理
  const handleCancelGeneration = useCallback(() => {
    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
      generationAbortControllerRef.current = null;
    }
    setIsGenerating(false);
    setCurrentGenerationAction(null);
    // キャンセルメッセージは呼び出し元で表示するため、ここでは表示しない
  }, []);

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
    setIsGenerating(true);

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
      const projectCharacters = currentProject.characters.map((char: Character) => {
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
          // 口調設定を簡潔に（最大100文字）
          const speechStyle = char.speechStyle.trim();
          const truncatedSpeechStyle = speechStyle.length > 100
            ? speechStyle.substring(0, 100) + '...'
            : speechStyle;
          charInfo += `\n  口調: ${truncatedSpeechStyle}`;
        }
        return charInfo;
      }).join('\n\n');

      // 前章までのあらすじを取得
      const currentChapterIndex = currentProject.chapters.findIndex((c) => c.id === currentChapter.id);
      const previousStory = currentProject.chapters
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
      const contextInfo = getProjectContextInfo();

      // プロンプトを構築
      const prompt = buildCustomPrompt({
        currentChapter,
        chapterDetails,
        projectCharacters,
        previousStory,
        previousChapterEnd,
        contextInfo,
      });

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
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
        onDraftUpdate(response.content);
        // 章草案を保存
        await onSaveChapterDraft(selectedChapter!, response.content);
        // 完了通知
        onCompletionToast('章全体の生成が完了しました');
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('AI生成中にエラーが発生しました', 7000, {
          title: 'AI生成エラー',
        });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [
    isConfigured,
    currentProject,
    currentChapter,
    selectedChapter,
    settings,
    draft,
    getChapterDetails,
    getProjectContextInfo,
    buildCustomPrompt,
    onDraftUpdate,
    onSaveChapterDraft,
    onError,
    onWarning,
    onCompletionToast,
    addLog,
  ]);

  // 続き生成
  const handleContinueGeneration = useCallback(async () => {
    if (!currentProject || !selectedChapter) return;

    setCurrentGenerationAction('continue');
    setIsGenerating(true);

    try {
      // プロジェクトのキャラクター情報を整理
      const projectCharacters = currentProject.characters.map((char: Character) => {
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
          // 口調設定を簡潔に（最大100文字）
          const speechStyle = char.speechStyle.trim();
          const truncatedSpeechStyle = speechStyle.length > 100
            ? speechStyle.substring(0, 100) + '...'
            : speechStyle;
          charInfo += `\n  口調: ${truncatedSpeechStyle}`;
        }
        return charInfo;
      }).join('\n\n');

      // 設定情報の取得
      const contextInfo = getProjectContextInfo();

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
      });

      // 追加のコンテキスト情報をプロンプトに追加
      const enhancedPrompt = `${prompt}

【追加コンテキスト情報（参考）】
${contextInfo.relationships ? `【キャラクター相関図】\n${contextInfo.relationships}\n` : ''}
${contextInfo.worldSettings ? `【設定資料・世界観】\n${contextInfo.worldSettings}\n` : ''}
${contextInfo.glossary ? `【重要用語集】\n${contextInfo.glossary}\n` : ''}

【追加の執筆指示】
- 上記の文章の自然な続きを書いてください
- キャラクターの性格や設定を一貫して保ってください
- 特に「設定資料・世界観」や「重要用語集」の内容と矛盾しないようにしてください
- 「キャラクター相関図」の関係性に基づいた会話や態度を描写してください
- 会話を重視し、臨場感のある描写を心がけてください
- 1000-1500文字程度で続きを執筆してください
- 章の目的に沿った内容で物語を前進させてください
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください`;

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const response = await aiService.generateContent({
        prompt: enhancedPrompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
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
        onDraftUpdate(newContent);
        await onSaveChapterDraft(selectedChapter!, newContent);
        onCompletionToast('文章の続きを生成しました');
      }
    } catch (error) {
      console.error('続き生成エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('続き生成中にエラーが発生しました', 7000, {
          title: '続き生成エラー',
        });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [
    currentProject,
    selectedChapter,
    draft,
    currentChapter,
    settings,
    getProjectContextInfo,
    onDraftUpdate,
    onSaveChapterDraft,
    onError,
    onCompletionToast,
    addLog,
  ]);

  // 描写強化
  const handleDescriptionEnhancement = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('description');
    setIsGenerating(true);

    try {
      const prompt = aiService.buildPrompt('draft', 'enhanceDescription', {
        currentText: draft,
      });

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
        return;
      }

      if (response && response.content) {
        onDraftUpdate(response.content);
        await onSaveChapterDraft(selectedChapter!, response.content);
        onCompletionToast('描写を強化しました');
      }
    } catch (error) {
      console.error('描写強化エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('描写強化中にエラーが発生しました', 7000, {
          title: '描写強化エラー',
        });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [selectedChapter, draft, settings, onDraftUpdate, onSaveChapterDraft, onError, onCompletionToast]);

  // 文体調整
  const handleStyleAdjustment = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('style');
    setIsGenerating(true);

    try {
      const prompt = aiService.buildPrompt('draft', 'adjustStyle', {
        currentText: draft,
      });

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
        return;
      }

      if (response && response.content) {
        onDraftUpdate(response.content);
        await onSaveChapterDraft(selectedChapter!, response.content);
        onCompletionToast('文体を調整しました');
      }
    } catch (error) {
      console.error('文体調整エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('文体調整中にエラーが発生しました', 7000, {
          title: '文体調整エラー',
        });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [selectedChapter, draft, settings, onDraftUpdate, onSaveChapterDraft, onError, onCompletionToast]);

  // 文章短縮
  const handleShortenText = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('shorten');
    setIsGenerating(true);

    try {
      const prompt = aiService.buildPrompt('draft', 'shorten', {
        currentText: draft,
      });

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
        return;
      }

      if (response && response.content) {
        onDraftUpdate(response.content);
        await onSaveChapterDraft(selectedChapter!, response.content);
        onCompletionToast('文章を短縮しました');
      }
    } catch (error) {
      console.error('文章短縮エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('文章短縮中にエラーが発生しました', 7000, {
          title: '文章短縮エラー',
        });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [selectedChapter, draft, settings, onDraftUpdate, onSaveChapterDraft, onError, onCompletionToast]);

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
    setIsGenerating(true);

    try {
      const prompt = aiService.buildPrompt('draft', 'improve', {
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
        currentLength: draft.length.toString(),
      });

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
        return;
      }

      if (response && response.content) {
        onDraftUpdate(response.content);
        await onSaveChapterDraft(selectedChapter!, response.content);
        onCompletionToast('章全体を改善しました');
      }
    } catch (error) {
      console.error('章全体改善エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('章全体改善中にエラーが発生しました', 7000, {
          title: '章全体改善エラー',
        });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [
    selectedChapter,
    draft,
    isConfigured,
    currentChapter,
    settings,
    onDraftUpdate,
    onSaveChapterDraft,
    onError,
    onCompletionToast,
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
    setIsGenerating(true);

    try {
      // フェーズ1：批評フェーズ（弱点の特定と修正案の生成）
      const critiquePrompt = aiService.buildPrompt('draft', 'critique', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
      });

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const critiqueResponse = await aiService.generateContent({
        prompt: critiquePrompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        return null;
      }

      if (!critiqueResponse || !critiqueResponse.content) {
        throw new Error('批評フェーズの応答が取得できませんでした');
      }

      // JSON形式の応答を抽出・パース
      let critiqueSummary = '';
      let weaknesses: WeaknessItem[] = []; // 型適用
      let jsonContent = critiqueResponse.content.trim();

      try {
        // コードブロック除去
        if (jsonContent.startsWith('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonContent = jsonMatch[1].trim();
          } else {
            jsonContent = jsonContent.replace(/```json\s*|\s*```/g, '').trim();
          }
        }

        // クリーニング
        jsonContent = jsonContent
          .replace(/^\{\{/, '')
          .replace(/\}\}$/, '')
          .trim();

        const jsonMatches = jsonContent.match(/\{[\s\S]*\}/g);
        let jsonString = '';
        if (jsonMatches && jsonMatches.length > 0) {
          jsonString = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        } else {
          jsonString = jsonContent;
        }

        // 再度クリーニング
        jsonString = jsonString
          .replace(/^[\s\n\r]*/, '')
          .replace(/[\s\n\r]*$/, '')
          .replace(/^\{\{/, '')
          .replace(/\}\}$/, '')
          .trim();

        if (jsonString && jsonString.startsWith('{')) {
          const critiqueData = JSON.parse(jsonString);

          if (critiqueData.summary) {
            critiqueSummary = critiqueData.summary;
          }

          if (critiqueData.weaknesses && Array.isArray(critiqueData.weaknesses)) {
            weaknesses = critiqueData.weaknesses.filter((w: WeaknessItem) => w && w.aspect && w.problem);
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
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [
    selectedChapter,
    draft,
    isConfigured,
    currentProject,
    currentChapter,
    settings,
    onError,
  ]);

  // 弱点の修正（修正フェーズ）
  const applyWeaknessFixes = useCallback(async (
    selectedWeaknesses: WeaknessItem[],
    rawCritique: string
  ) => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('fixWeaknesses');
    setIsGenerating(true);

    try {
      // 選択された弱点のみを含むCritiqueResultを構築
      const filteredCritique = {
        weaknesses: selectedWeaknesses,
        summary: "ユーザーが選択した修正項目に基づく改訂",
      };

      const critiqueResult = JSON.stringify(filteredCritique, null, 2);

      // プロンプト長制限のための切り詰め
      const maxDraftLength = 4000;
      const truncatedDraft = draft.length > maxDraftLength
        ? draft.substring(0, maxDraftLength) + '\n\n[以下省略]'
        : draft;

      const revisionPrompt = aiService.buildPrompt('draft', 'revise', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: truncatedDraft,
        critiqueResult: critiqueResult,
        currentLength: draft.length.toString(),
      });

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const revisionResponse = await aiService.generateContent({
        prompt: revisionPrompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return;

      if (!revisionResponse || !revisionResponse.content) {
        throw new Error('改訂フェーズの応答が取得できませんでした');
      }

      // 修正結果の解析（handleSelfRefineImprovementと同様のロジック）
      let revisedText = '';
      let improvementSummary = '';
      let phase2Changes: string[] = [];

      try {
        let jsonContent = revisionResponse.content.trim();
        if (jsonContent.startsWith('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) jsonContent = jsonMatch[1].trim();
        }
        jsonContent = jsonContent.replace(/^\{\{/, '').replace(/\}\}$/, '').trim();

        const jsonMatches = jsonContent.match(/\{[\s\S]*\}/g);
        let jsonString = jsonMatches && jsonMatches.length > 0
          ? jsonMatches.reduce((a, b) => a.length > b.length ? a : b)
          : jsonContent;

        jsonString = jsonString
          .replace(/^[\s\n\r]*/, '')
          .replace(/[\s\n\r]*$/, '')
          .replace(/^\{\{/, '').replace(/\}\}$/, '').trim();

        if (jsonString && jsonString.startsWith('{')) {
          const parsed = JSON.parse(jsonString);
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
        onDraftUpdate(revisedText);
        await onSaveChapterDraft(selectedChapter!, revisedText);

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

        onCompletionToast(improvementSummary
          ? `選択した ${selectedWeaknesses.length} 件の弱点を修正しました`
          : '修正が完了しました');
      } else {
        throw new Error('改訂後の文章が空です');
      }

    } catch (error) {
      console.error('弱点修正エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('修正処理中にエラーが発生しました', 7000, { title: '修正エラー' });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [
    selectedChapter,
    draft,
    currentProject,
    currentChapter,
    settings,
    onDraftUpdate,
    onSaveChapterDraft,
    onError,
    onCompletionToast,
    setImprovementLogs,
  ]);

  // キャラクター情報のブレ修正
  const handleFixCharacterInconsistencies = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;

    setCurrentGenerationAction('fixCharacter');
    setIsGenerating(true);

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

      const abortController = new AbortController();
      generationAbortControllerRef.current = abortController;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (response && response.content) {
        onDraftUpdate(response.content);
        await onSaveChapterDraft(selectedChapter!, response.content);
        onCompletionToast('キャラクター情報のブレを修正しました');
      }
    } catch (error) {
      console.error('キャラクター修正エラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('キャラクター修正中にエラーが発生しました', 7000, {
          title: 'キャラクター修正エラー',
        });
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenerationAction(null);
      generationAbortControllerRef.current = null;
    }
  }, [
    selectedChapter,
    draft,
    currentProject,
    settings,
    onDraftUpdate,
    onSaveChapterDraft,
    onError,
    onCompletionToast,
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

