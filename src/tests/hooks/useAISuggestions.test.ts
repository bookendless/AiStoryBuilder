import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useAISuggestions } from '../../components/steps/draft/hooks/useAISuggestions';
import { GenerationProvider } from '../../contexts/GenerationContext';
import { Project } from '../../contexts/ProjectContext';
import { AISettings } from '../../types/ai';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(GenerationProvider, null, children);

vi.mock('../../services/aiService', () => ({
  aiService: {
    generateContent: vi.fn(),
    buildPrompt: vi.fn().mockReturnValue('提案プロンプト'),
  },
}));

const defaultSettings: AISettings = {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'test-key',
  apiKeys: {},
  localEndpoint: 'http://localhost:1234',
  temperature: 0.7,
  maxTokens: 4000,
};

// 選択範囲: '0123456789ABCDEF' の index2-6（"2345"）を選択した状態を再現する
const DRAFT = '0123456789ABCDEF';
const SEL_START = 2;
const SEL_END = 6;
const SELECTED_TEXT = DRAFT.slice(SEL_START, SEL_END); // "2345"
const REPLACEMENT = 'XXXX';

describe('useAISuggestions - applyAISuggestion の位置保全', () => {
  const onDraftUpdate = vi.fn();
  const onSaveChapterDraft = vi.fn().mockResolvedValue(undefined);
  const onError = vi.fn();
  const addLog = vi.fn();
  const createHistorySnapshot = vi.fn().mockResolvedValue(true);
  const setChapterDrafts = vi.fn();

  const makeTextarea = (value: string) => ({
    selectionStart: SEL_START,
    selectionEnd: SEL_END,
    value,
    focus: vi.fn(),
    setSelectionRange: vi.fn(),
  });

  // mainEditorRef は生成時に getTextareaRef().value から範囲テキストを保存する
  const makeEditorRef = (textareaValue: string) =>
    ({
      current: {
        getCurrentSelection: () => SELECTED_TEXT,
        getTextareaRef: () => makeTextarea(textareaValue),
      },
    }) as unknown as React.RefObject<import('../../components/steps/draft/MainEditor').MainEditorHandle>;

  const baseProps = (draft: string, mainEditorRef: ReturnType<typeof makeEditorRef>) => ({
    currentProject: { id: 'proj-1', title: 'テスト' } as unknown as Project,
    currentChapter: { id: 'ch-1', title: '第1章', summary: '要約' },
    selectedChapter: 'ch-1',
    draft,
    settings: defaultSettings,
    isConfigured: true,
    mainEditorRef,
    onDraftUpdate,
    onSaveChapterDraft,
    onError,
    addLog,
    createHistorySnapshot,
    setChapterDrafts,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { aiService } = await import('../../services/aiService');
    (aiService.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: JSON.stringify({ suggestions: [{ title: '提案', body: REPLACEMENT }] }),
    });
  });

  it('生成→draft不変で適用すると、生成時の選択範囲へ正しく置換される', async () => {
    const mainEditorRef = makeEditorRef(DRAFT);
    const { result } = renderHook(() => useAISuggestions(baseProps(DRAFT, mainEditorRef)), { wrapper });

    await act(async () => {
      await result.current.handleGenerateSuggestions('rewrite');
    });

    const suggestion = result.current.aiSuggestions[0];
    expect(suggestion).toBeDefined();

    await act(async () => {
      await result.current.applyAISuggestion(suggestion);
    });

    // "01" + "XXXX" + "6789ABCDEF"
    expect(onDraftUpdate).toHaveBeenCalledWith('01XXXX6789ABCDEF');
    expect(onError).not.toHaveBeenCalled();
  });

  it('生成後にdraftが変化し選択範囲が無効になった場合、適用を中止してonErrorを出す', async () => {
    const mainEditorRef = makeEditorRef(DRAFT);
    const { result, rerender } = renderHook(
      (props: ReturnType<typeof baseProps>) => useAISuggestions(props),
      { wrapper, initialProps: baseProps(DRAFT, mainEditorRef) }
    );

    await act(async () => {
      await result.current.handleGenerateSuggestions('rewrite');
    });
    const suggestion = result.current.aiSuggestions[0];

    // 生成後にユーザーが本文を編集 → 保存範囲のテキストと一致しなくなる
    const mutatedDraft = 'ZZZZ' + DRAFT;
    rerender(baseProps(mutatedDraft, mainEditorRef));

    await act(async () => {
      await result.current.applyAISuggestion(suggestion);
    });

    expect(onError).toHaveBeenCalled();
    expect(onDraftUpdate).not.toHaveBeenCalled();
  });
});
