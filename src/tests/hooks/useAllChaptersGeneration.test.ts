import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAllChaptersGeneration } from '../../components/steps/draft/hooks/useAllChaptersGeneration';
import { Project } from '../../types/project';
import { AISettings } from '../../types/ai';

vi.mock('../../services/aiService', () => ({
  aiService: {
    generateContent: vi.fn(),
  },
}));

const makeProject = (): Project => ({
  id: 'proj-1',
  title: 'テスト',
  description: '',
  theme: '',
  imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [],
  plot: { theme: 'テーマ', setting: '設定', hook: 'フック', protagonistGoal: '目標', mainObstacle: '障害' },
  synopsis: '',
  draft: '',
  chapters: [
    { id: 'ch-1', title: '第1章', summary: '要約', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const defaultSettings: AISettings = {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'test-key',
  apiKeys: {},
  localEndpoint: 'http://localhost:1234',
  temperature: 0.7,
  maxTokens: 4000,
};

describe('useAllChaptersGeneration', () => {
  const onError = vi.fn();
  const onWarning = vi.fn();
  const updateProject = vi.fn();
  const setChapterDrafts = vi.fn();
  const setShowCompletionToast = vi.fn();
  const getChapterDetails = vi.fn().mockReturnValue({
    characters: '', setting: '', mood: '', keyEvents: '',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleCancelAllChaptersGeneration で isGeneratingAllChapters が false になる', async () => {
    const { aiService } = await import('../../services/aiService');
    (aiService.generateContent as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    const { result } = renderHook(() =>
      useAllChaptersGeneration({
        currentProject: makeProject(),
        settings: defaultSettings,
        isConfigured: true,
        getChapterDetails,
        onError,
        onWarning,
        updateProject,
        setChapterDrafts,
        setShowCompletionToast,
      })
    );

    act(() => { void result.current.handleGenerateAllChapters(); });

    act(() => { result.current.handleCancelAllChaptersGeneration(); });

    expect(result.current.isGeneratingAllChapters).toBe(false);
  });

  it('aiService がエラーを投げた場合に onError が呼ばれる', async () => {
    const { aiService } = await import('../../services/aiService');
    (aiService.generateContent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('API Error')
    );

    const { result } = renderHook(() =>
      useAllChaptersGeneration({
        currentProject: makeProject(),
        settings: defaultSettings,
        isConfigured: true,
        getChapterDetails,
        onError,
        onWarning,
        updateProject,
        setChapterDrafts,
        setShowCompletionToast,
      })
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    expect(onError).toHaveBeenCalled();
  });

  it('isConfigured=false の場合は生成が開始されない', async () => {
    const { aiService } = await import('../../services/aiService');

    const { result } = renderHook(() =>
      useAllChaptersGeneration({
        currentProject: makeProject(),
        settings: defaultSettings,
        isConfigured: false,
        getChapterDetails,
        onError,
        onWarning,
        updateProject,
        setChapterDrafts,
        setShowCompletionToast,
      })
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    expect(aiService.generateContent).not.toHaveBeenCalled();
  });
});
