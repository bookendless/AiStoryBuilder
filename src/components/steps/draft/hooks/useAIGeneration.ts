import { useState, useCallback, useRef } from 'react';
import { Project, Character } from '../../../../contexts/ProjectContext';
import { AISettings } from '../../../../types/ai';
import { aiService } from '../../../../services/aiService';
import type { GenerationAction, ImprovementLog } from '../types';

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
  handleSelfRefineImprovement: () => Promise<void>;
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

    // 非ローカルLLM推奨の警告
    if (settings.provider === 'local') {
      const useNonLocal = confirm('非ローカルLLM（OpenAI、Anthropic等）の使用を推奨します。\n\n非ローカルLLMは以下の利点があります：\n• より自然で流暢な文章生成\n• 会話の臨場感と感情表現\n• 3000-4000文字の長文生成に最適\n\n続行しますか？');
      if (!useNonLocal) return;
    }

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

  // 弱点の特定と修正案の生成ループ（Self-Refine）
  const handleSelfRefineImprovement = useCallback(async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    if (!isConfigured) {
      onError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    setCurrentGenerationAction('selfRefine');
    setIsGenerating(true);
    
    try {
      // フェーズ1：批評フェーズ（弱点の特定と修正案の生成）
      const critiquePrompt = aiService.buildPrompt('draft', 'critique', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: draft,
      });

      const abortController1 = new AbortController();
      generationAbortControllerRef.current = abortController1;

      const critiqueResponse = await aiService.generateContent({
        prompt: critiquePrompt,
        type: 'draft',
        settings,
        signal: abortController1.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController1.signal.aborted) {
        return;
      }

      if (!critiqueResponse || !critiqueResponse.content) {
        throw new Error('批評フェーズの応答が取得できませんでした');
      }

      // フェーズ2：改訂フェーズ（改善実行と統合）
      // プロンプトの長さを制限するため、元の文章を適切な長さに切り詰める
      const maxDraftLength = 4000; // プロンプトの長さをさらに制限
      const truncatedDraft = draft.length > maxDraftLength 
        ? draft.substring(0, maxDraftLength) + '\n\n[以下省略]' 
        : draft;
      
      // 評価結果から重要なポイントを抽出（JSON形式から要約を抽出）
      let critiqueResult = '';
      let critiqueSummary = '';
      let weaknesses: Array<{ aspect: string; score: number; problem: string; solutions: string[] }> = [];
      
      try {
        // JSON形式の評価結果を抽出（コードブロックがあれば除去）
        let jsonContent = critiqueResponse.content.trim();
        
        // コードブロックを除去
        if (jsonContent.startsWith('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonContent = jsonMatch[1].trim();
          } else {
            // コードブロックが見つからない場合は、全体を使用
            jsonContent = jsonContent.replace(/```json\s*|\s*```/g, '').trim();
          }
        }
        
        // Gemini APIのレスポンスで時々付く {{ と }} を削除
        jsonContent = jsonContent
          .replace(/^\{\{/, '')
          .replace(/\}\}$/, '')
          .trim();
        
        // JSONオブジェクトを抽出（複数行に対応、最も長いマッチを選択）
        const jsonMatches = jsonContent.match(/\{[\s\S]*\}/g);
        let jsonString = '';
        
        if (jsonMatches && jsonMatches.length > 0) {
          // 最も長いマッチを選択（完全なJSONの可能性が高い）
          jsonString = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        } else {
          // マッチが見つからない場合は、全体を試行
          jsonString = jsonContent;
        }
        
        // JSON文字列のクリーニング
        jsonString = jsonString
          .replace(/^[\s\n\r]*/, '')
          .replace(/[\s\n\r]*$/, '')
          // Gemini APIのレスポンスで時々付く {{ と }} を削除
          .replace(/^\{\{/, '')
          .replace(/\}\}$/, '')
          .trim();
        
        if (jsonString && jsonString.startsWith('{')) {
          const critiqueData = JSON.parse(jsonString);
          
          // summaryを取得
          if (critiqueData.summary) {
            critiqueSummary = critiqueData.summary;
          }
          
          // weaknessesを取得
          if (critiqueData.weaknesses && Array.isArray(critiqueData.weaknesses)) {
            weaknesses = critiqueData.weaknesses.filter((w: any) => w && w.aspect && w.problem);
            
            // 7点以下の弱点を優先的に抽出
            const lowScoreWeaknesses = weaknesses
              .filter((w: any) => w.score !== undefined && w.score <= 7)
              .slice(0, 5); // 最大5つまで
            
            // 弱点の要約を作成
            if (lowScoreWeaknesses.length > 0) {
              const weaknessTexts = lowScoreWeaknesses.map((w: any) => {
                const solutions = w.solutions && Array.isArray(w.solutions) 
                  ? w.solutions.slice(0, 2).join('、') 
                  : '';
                return `【${w.aspect}】（スコア: ${w.score}/10）\n問題: ${w.problem}\n改善策: ${solutions}`;
              });
              critiqueSummary = weaknessTexts.join('\n\n') + (critiqueData.summary ? `\n\n総評: ${critiqueData.summary}` : '');
            } else if (weaknesses.length > 0) {
              // スコアが不明な場合は最初の3つを使用
              const weaknessTexts = weaknesses.slice(0, 3).map((w: any) => {
                const solutions = w.solutions && Array.isArray(w.solutions) 
                  ? w.solutions.slice(0, 2).join('、') 
                  : '';
                return `【${w.aspect}】\n問題: ${w.problem}\n改善策: ${solutions}`;
              });
              critiqueSummary = weaknessTexts.join('\n\n') + (critiqueData.summary ? `\n\n総評: ${critiqueData.summary}` : '');
            }
          }
          
          // 完全な評価結果を保持（reviseプロンプトで使用）
          critiqueResult = JSON.stringify(critiqueData, null, 2);
        } else {
          // JSONが見つからない場合は、テキスト全体を使用
          critiqueResult = critiqueResponse.content;
          critiqueSummary = critiqueResponse.content.substring(0, 1000);
        }
      } catch (e) {
        // JSON解析に失敗した場合は、評価結果をそのまま使用
        console.warn('Critique JSON解析エラー:', e);
        critiqueResult = critiqueResponse.content;
        
        // テキストから重要な部分を抽出
        const lines = critiqueResponse.content.split('\n').filter(line => line.trim());
        const importantLines = lines.filter(line => 
          line.includes('問題') || 
          line.includes('改善') || 
          line.includes('弱点') || 
          line.includes('評価') ||
          line.includes('スコア')
        );
        critiqueSummary = importantLines.length > 0 
          ? importantLines.slice(0, 10).join('\n')
          : lines.slice(0, 10).join('\n');
      }
      
      // 要約が長すぎる場合は切り詰める
      const maxSummaryLength = 1500;
      if (critiqueSummary.length > maxSummaryLength) {
        critiqueSummary = critiqueSummary.substring(0, maxSummaryLength) + '...';
      }

      // reviseプロンプトを構築（aiService.buildPromptを使用）
      const revisionPrompt = aiService.buildPrompt('draft', 'revise', {
        projectTitle: currentProject?.title || '未設定',
        chapterTitle: currentChapter?.title || '未設定',
        chapterSummary: currentChapter?.summary || '未設定',
        currentText: truncatedDraft,
        critiqueResult: critiqueResult,
        currentLength: draft.length.toString(),
      });

      const abortController2 = new AbortController();
      generationAbortControllerRef.current = abortController2;

      const revisionResponse = await aiService.generateContent({
        prompt: revisionPrompt,
        type: 'draft',
        settings,
        signal: abortController2.signal,
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController2.signal.aborted) {
        return;
      }

      if (!revisionResponse || !revisionResponse.content) {
        throw new Error('改訂フェーズの応答が取得できませんでした');
      }

      // JSON形式の応答をパース（より堅牢な解析）
      let revisedText = '';
      let improvementSummary = '';
      let phase2Changes: string[] = [];
      
      try {
        // JSON形式の応答を抽出（コードブロックがあれば除去）
        let jsonContent = revisionResponse.content.trim();
        
        // コードブロックを除去
        if (jsonContent.startsWith('```')) {
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1].trim();
          }
        }
        
        // Gemini APIのレスポンスで時々付く {{ と }} を削除
        jsonContent = jsonContent
          .replace(/^\{\{/, '')
          .replace(/\}\}$/, '')
          .trim();
        
        // JSONオブジェクトを抽出（複数行に対応、最も長いマッチを選択）
        const jsonMatches = jsonContent.match(/\{[\s\S]*\}/g);
        let jsonString = '';
        
        if (jsonMatches && jsonMatches.length > 0) {
          // 最も長いマッチを選択（完全なJSONの可能性が高い）
          jsonString = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        } else {
          // マッチが見つからない場合は、全体を試行
          jsonString = jsonContent;
        }
        
        // JSON文字列のクリーニング
        jsonString = jsonString
          .replace(/^[\s\n\r]*/, '')
          .replace(/[\s\n\r]*$/, '')
          // Gemini APIのレスポンスで時々付く {{ と }} を削除
          .replace(/^\{\{/, '')
          .replace(/\}\}$/, '')
          .trim();
        
        if (jsonString && jsonString.startsWith('{')) {
          try {
            const parsed = JSON.parse(jsonString);
            revisedText = parsed.revisedText || parsed.revised_text || '';
            improvementSummary = parsed.improvementSummary || parsed.improvement_summary || '';
            phase2Changes = parsed.changes || [];
          } catch (parseError) {
            console.warn('JSON解析エラー（抽出した文字列）:', parseError);
            throw new Error('JSON形式が見つかりましたが、解析に失敗しました');
          }
        } else {
          throw new Error('JSON形式が見つかりません');
        }
        
        // revisedTextが空の場合は、テキストから文章を抽出
        if (!revisedText || revisedText.trim().length < 100) {
          // 応答から文章らしい部分を抽出
          const textPatterns = [
            /"revisedText"\s*:\s*"([^"]+)"/,  // JSON内の文字列
            /"revisedText"\s*:\s*"([^"]*\\"[^"]*)*"/,  // エスケープされた文字列
            /改訂後の文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,  // テキスト形式
            /改善された文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,  // テキスト形式
          ];
          
          for (const pattern of textPatterns) {
            const match = revisionResponse.content.match(pattern);
            if (match && match[1] && match[1].trim().length > 100) {
              revisedText = match[1].trim().replace(/\\n/g, '\n').replace(/\\"/g, '"');
              break;
            }
          }
          
          // それでも見つからない場合は、応答全体から文章部分を抽出
          if (!revisedText || revisedText.trim().length < 100) {
            // JSON以外の部分から文章を抽出
            const lines = revisionResponse.content.split('\n');
            const textLines: string[] = [];
            let inTextBlock = false;
            
            for (const line of lines) {
              const trimmed = line.trim();
              // JSONのキーや構造的な部分をスキップ
              if (trimmed.startsWith('{') || trimmed.startsWith('}') || 
                  trimmed.startsWith('"') && trimmed.includes(':') && !trimmed.includes('、') && !trimmed.includes('。')) {
                continue;
              }
              // 文章らしい行を抽出
              if (trimmed.length > 20 && !trimmed.startsWith('//') && !trimmed.match(/^[\s\w":,\[\]{}]+$/)) {
                textLines.push(line);
                inTextBlock = true;
              } else if (inTextBlock && trimmed.length > 0) {
                textLines.push(line);
              }
            }
            
            if (textLines.length > 0) {
              revisedText = textLines.join('\n').trim();
            }
          }
        }
        
        // 最終的にrevisedTextが空の場合は、元の応答を使用（ただし警告を出す）
        if (!revisedText || revisedText.trim().length < 100) {
          console.warn('改訂後の文章の抽出に失敗。応答全体を使用します。');
          // 応答全体から、明らかにJSON構造の部分を除去
          const cleanedContent = revisionResponse.content
            .replace(/\{[^}]*"revisedText"[^}]*\}/g, '')
            .replace(/\{[^}]*"improvementSummary"[^}]*\}/g, '')
            .replace(/\{[^}]*"changes"[^}]*\}/g, '')
            .replace(/\{[\s\S]*?\}/g, '')
            .trim();
          
          if (cleanedContent.length > 100) {
            revisedText = cleanedContent;
          } else {
            revisedText = revisionResponse.content;
          }
        }
      } catch (parseError) {
        console.warn('JSONパースエラー、テキスト抽出を試行:', parseError);
        
        // JSONパースに失敗した場合でも、テキストから文章を抽出
        const textPatterns = [
          /改訂後の文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
          /改善された文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
          /改訂された文章[：:]\s*([^\n]+(?:\n[^\n]+)*)/,
        ];
        
        let extracted = false;
        for (const pattern of textPatterns) {
          const match = revisionResponse.content.match(pattern);
          if (match && match[1] && match[1].trim().length > 100) {
            revisedText = match[1].trim();
            extracted = true;
            break;
          }
        }
        
        // それでも見つからない場合は、応答全体を使用（ただし構造的な部分を除去）
        if (!extracted) {
          const cleanedContent = revisionResponse.content
            .replace(/\{[^}]*"revisedText"[^}]*\}/g, '')
            .replace(/\{[^}]*"improvementSummary"[^}]*\}/g, '')
            .replace(/\{[^}]*"changes"[^}]*\}/g, '')
            .replace(/```json[\s\S]*?```/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .trim();
          
          revisedText = cleanedContent.length > 100 ? cleanedContent : revisionResponse.content;
        }
      }

      if (revisedText.trim()) {
        onDraftUpdate(revisedText);
        await onSaveChapterDraft(selectedChapter!, revisedText);
        
        // 改善ログを保存
        const logId = `log-${Date.now()}`;
        const improvementLog: ImprovementLog = {
          id: logId,
          timestamp: Date.now(),
          chapterId: selectedChapter!,
          phase1Critique: critiqueResponse.content,
          phase2Summary: improvementSummary || '改善戦略の要約が取得できませんでした',
          phase2Changes: phase2Changes,
          originalLength: draft.length,
          revisedLength: revisedText.length,
        };
        
        setImprovementLogs(prev => {
          const chapterLogs = prev[selectedChapter!] || [];
          return {
            ...prev,
            [selectedChapter!]: [improvementLog, ...chapterLogs].slice(0, 20), // 最新20件まで保持
          };
        });
        
        // 改善戦略の要約をトーストで表示
        const toastMsg = improvementSummary 
          ? `弱点を特定し、改善しました。改善ログを確認できます。`
          : '弱点を特定し、改善しました';
        onCompletionToast(toastMsg);
      } else {
        throw new Error('改訂後の文章が取得できませんでした');
      }
    } catch (error) {
      console.error('弱点特定と修正ループエラー:', error);
      if ((error as Error).name !== 'AbortError') {
        onError('弱点特定と修正中にエラーが発生しました: ' + ((error as Error).message || '不明なエラー'), 7000, {
          title: '弱点特定と修正エラー',
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
    currentProject,
    currentChapter,
    settings,
    onDraftUpdate,
    onSaveChapterDraft,
    onError,
    onCompletionToast,
    setImprovementLogs,
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
    handleSelfRefineImprovement,
    handleCancelGeneration,
  };
};

