import { useState, useCallback, useRef } from 'react';
import { Project } from '../../../../contexts/ProjectContext';
import { AISettings } from '../../../../types/ai';
import { aiService } from '../../../../services/aiService';
import { useGeneration } from '../../../../contexts/GenerationContext';
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
  const { startTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [lastSelectedText, setLastSelectedText] = useState<string>('');
  const [activeSuggestionType, setActiveSuggestionType] = useState<AISuggestionType>('rewrite');
  const [wasSelectionTruncated, setWasSelectionTruncated] = useState<boolean>(false);
  // 提案生成時の選択範囲を保持（適用時に現在のカーソル位置ではなくこの範囲へ置換する）
  const selectionRangeRef = useRef<{ start: number; end: number; text: string } | null>(null);

  // 生成タスクの識別キー。実行中判定はマネージャから導出（ステップ移動でも維持）
  const pid = currentProject?.id ?? 'none';
  const suggestionKey = `${pid}:draft:suggestion`;
  const isGeneratingSuggestion = isKeyActive(suggestionKey);

  // 現在の選択テキストを取得
  const getCurrentSelection = useCallback(() => {
    if (!mainEditorRef.current) return '';
    return mainEditorRef.current.getCurrentSelection();
  }, [mainEditorRef]);

  // AI提案生成のキャンセル処理（マネージャ経由でabort）
  const handleCancelSuggestion = useCallback(() => {
    cancelByKey(suggestionKey);
    setSuggestionError(null);
  }, [cancelByKey, suggestionKey]);

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

      // 適用時にカーソルが移動していても正しい範囲へ置換できるよう、生成時点の選択範囲を保存
      const textarea = mainEditorRef.current?.getTextareaRef();
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        selectionRangeRef.current = {
          start,
          end,
          text: textarea.value.slice(start, end),
        };
      } else {
        selectionRangeRef.current = null;
      }

      let truncatedSelection = selection.trim();
      let truncated = false;
      if (truncatedSelection.length > MAX_SUGGESTION_TEXT_LENGTH) {
        truncatedSelection = truncatedSelection.slice(0, MAX_SUGGESTION_TEXT_LENGTH);
        truncated = true;
      }

      setActiveSuggestionType(type);
      setSuggestionError(null);
      setAISuggestions([]);
      setLastSelectedText(truncatedSelection);
      setWasSelectionTruncated(truncated);

      // マネージャに生成タスクを登録（同keyの既存タスクは自動でキャンセル・置換）
      const { id: taskId, signal } = startTask({
        key: suggestionKey,
        label: 'AI提案を生成中',
        step: 'draft',
      });
      const abortController = { signal };

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
        // 成否・キャンセルに関わらずタスクを除去（キャンセル済みならno-op）
        completeTask(taskId);
      }
    },
    [
      currentChapter,
      currentProject,
      getCurrentSelection,
      isConfigured,
      mainEditorRef,
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

      // 生成時に保存した選択範囲を優先使用。生成後にdraftが編集され範囲が無効化されている場合は、
      // 誤位置への挿入（草案破損）を避けるため適用を中止して再選択を促す。
      const saved = selectionRangeRef.current;
      if (!saved || saved.end > draft.length || draft.slice(saved.start, saved.end) !== saved.text) {
        onError('提案生成後に文章が変更されたため、提案を適用できませんでした。対象を選択し直してください。', 7000, {
          title: '提案を適用できません',
        });
        return;
      }
      const selectionStart = saved.start;
      const selectionEnd = saved.end;
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
      onError,
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

