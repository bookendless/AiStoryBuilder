import { useState, useCallback, useRef } from 'react';
import { Project } from '../../../../contexts/ProjectContext';
import { AISettings } from '../../../../types/ai';
import { aiService } from '../../../../services/aiService';
import { SUGGESTION_CONFIG, MAX_SUGGESTION_TEXT_LENGTH } from '../constants';
import { parseAISuggestions } from '../utils';
import type { AISuggestion, AISuggestionType } from '../types';
import type { MainEditorHandle } from '../MainEditor';

interface Chapter {
  id: string;
  title: string;
  summary: string;
}

interface UseAISuggestionsOptions {
  currentProject: Project | null;
  currentChapter: Chapter | null;
  selectedChapter: string | null;
  draft: string;
  settings: AISettings;
  isConfigured: boolean;
  mainEditorRef: React.RefObject<MainEditorHandle>;
  onDraftUpdate: (content: string) => void;
  onSaveChapterDraft: (chapterId: string, content: string) => Promise<void>;
  onError: (message: string, duration?: number, options?: { title?: string }) => void;
  addLog: (log: {
    type: 'suggestions';
    prompt: string;
    response: string;
    error?: string;
    chapterId?: string;
    suggestionType?: string;
  }) => void;
  createHistorySnapshot: (
    type: 'auto' | 'manual' | 'restore',
    options?: { content?: string; label?: string; force?: boolean }
  ) => Promise<boolean>;
  setChapterDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

interface UseAISuggestionsReturn {
  aiSuggestions: AISuggestion[];
  isGeneratingSuggestion: boolean;
  suggestionError: string | null;
  lastSelectedText: string;
  activeSuggestionType: AISuggestionType;
  wasSelectionTruncated: boolean;
  handleGenerateSuggestions: (type: AISuggestionType) => Promise<void>;
  applyAISuggestion: (suggestion: AISuggestion) => Promise<void>;
  handleClearSuggestionState: () => void;
  handleCancelSuggestion: () => void;
}

export const useAISuggestions = ({
  currentProject,
  currentChapter,
  selectedChapter,
  draft,
  settings,
  isConfigured,
  mainEditorRef,
  onDraftUpdate,
  onSaveChapterDraft,
  onError,
  addLog,
  createHistorySnapshot,
  setChapterDrafts,
}: UseAISuggestionsOptions): UseAISuggestionsReturn => {
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>([]);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [lastSelectedText, setLastSelectedText] = useState<string>('');
  const [activeSuggestionType, setActiveSuggestionType] = useState<AISuggestionType>('rewrite');
  const [wasSelectionTruncated, setWasSelectionTruncated] = useState<boolean>(false);
  const suggestionAbortControllerRef = useRef<AbortController | null>(null);

  // 現在の選択テキストを取得
  const getCurrentSelection = useCallback(() => {
    if (!mainEditorRef.current) return '';
    return mainEditorRef.current.getCurrentSelection();
  }, [mainEditorRef]);

  // AI提案生成のキャンセル処理
  const handleCancelSuggestion = useCallback(() => {
    if (suggestionAbortControllerRef.current) {
      suggestionAbortControllerRef.current.abort();
      suggestionAbortControllerRef.current = null;
    }
    setIsGeneratingSuggestion(false);
    setSuggestionError(null);
  }, []);

  // AI提案生成
  const handleGenerateSuggestions = useCallback(
    async (type: AISuggestionType) => {
      if (!selectedChapter || !currentProject) {
        setSuggestionError('章を選択するとAI提案が利用できます。');
        return;
      }

      if (!isConfigured) {
        onError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
          title: 'AI設定が必要',
        });
        return;
      }

      const selection = getCurrentSelection();

      if (!selection.trim()) {
        setSuggestionError('テキストエリアで提案対象の文章を選択してください。');
        return;
      }

      let truncatedSelection = selection.trim();
      let truncated = false;
      if (truncatedSelection.length > MAX_SUGGESTION_TEXT_LENGTH) {
        truncatedSelection = truncatedSelection.slice(0, MAX_SUGGESTION_TEXT_LENGTH);
        truncated = true;
      }

      setActiveSuggestionType(type);
      setIsGeneratingSuggestion(true);
      setSuggestionError(null);
      setAISuggestions([]);
      setLastSelectedText(truncatedSelection);
      setWasSelectionTruncated(truncated);

      const abortController = new AbortController();
      suggestionAbortControllerRef.current = abortController;

      try {
        const prompt = SUGGESTION_CONFIG[type].prompt({
          selectedText: truncatedSelection,
          chapterTitle: currentChapter?.title,
          chapterSummary: currentChapter?.summary,
          projectTitle: currentProject?.title,
        });

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
          type: 'suggestions',
          prompt,
          response: response.content || '',
          error: response.error,
          chapterId: selectedChapter || undefined,
          suggestionType: type,
        });

        if (!response || !response.content) {
          throw new Error('AIからの応答が空でした。');
        }

        const parsed = parseAISuggestions(response.content);
        if (!parsed.length) {
          throw new Error('提案を解析できませんでした。');
        }

        setAISuggestions(parsed);
      } catch (error) {
        console.error('AI提案生成エラー:', error);
        if ((error as Error).name !== 'AbortError') {
          setSuggestionError(
            error instanceof Error ? error.message : 'AI提案の生成中にエラーが発生しました。'
          );
        }
      } finally {
        setIsGeneratingSuggestion(false);
        suggestionAbortControllerRef.current = null;
      }
    },
    [
      currentChapter,
      currentProject,
      getCurrentSelection,
      isConfigured,
      selectedChapter,
      settings,
      onError,
      addLog,
    ]
  );

  // AI提案の適用
  const applyAISuggestion = useCallback(
    async (suggestion: AISuggestion) => {
      if (!selectedChapter) return;

      const textarea = mainEditorRef.current?.getTextareaRef();
      if (!textarea) return;

      const replacement = suggestion.body;
      const { selectionStart, selectionEnd } = textarea;
      const before = draft.slice(0, selectionStart);
      const after = draft.slice(selectionEnd);
      const newContent = `${before}${replacement}${after}`;

      await createHistorySnapshot('restore', {
        content: draft,
        label: `${SUGGESTION_CONFIG[activeSuggestionType].label}適用前`,
        force: true,
      });

      onDraftUpdate(newContent);
      setChapterDrafts(prev => ({
        ...prev,
        [selectedChapter]: newContent,
      }));

      void onSaveChapterDraft(selectedChapter, newContent);

      await createHistorySnapshot('manual', {
        content: newContent,
        label: `${SUGGESTION_CONFIG[activeSuggestionType].label}適用`,
        force: true,
      });

      setTimeout(() => {
        const textarea = mainEditorRef.current?.getTextareaRef();
        if (textarea) {
          const cursorPosition = selectionStart + replacement.length;
          textarea.focus();
          textarea.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    },
    [
      activeSuggestionType,
      createHistorySnapshot,
      draft,
      mainEditorRef,
      onDraftUpdate,
      onSaveChapterDraft,
      selectedChapter,
      setChapterDrafts,
    ]
  );

  // 提案状態のクリア
  const handleClearSuggestionState = useCallback(() => {
    setAISuggestions([]);
    setSuggestionError(null);
    setLastSelectedText('');
    setWasSelectionTruncated(false);
  }, []);

  return {
    aiSuggestions,
    isGeneratingSuggestion,
    suggestionError,
    lastSelectedText,
    activeSuggestionType,
    wasSelectionTruncated,
    handleGenerateSuggestions,
    applyAISuggestion,
    handleClearSuggestionState,
    handleCancelSuggestion,
  };
};

