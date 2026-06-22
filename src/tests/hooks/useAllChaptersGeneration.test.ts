import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useAllChaptersGeneration } from '../../components/steps/draft/hooks/useAllChaptersGeneration';
import { GenerationProvider } from '../../contexts/GenerationContext';
import { Project } from '../../types/project';
import { AISettings } from '../../types/ai';

// フックは GenerationProvider 配下で動作するため、テスト用ラッパーを用意
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(GenerationProvider, null, children);

vi.mock('../../services/aiService', () => ({
  aiService: {
    generateContent: vi.fn(),
    buildPrompt: vi.fn().mockReturnValue('全章生成プロンプト'),
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

  beforeEach(async () => {
    vi.clearAllMocks();
    // clearAllMocks後も有効な値を返すよう再設定（undefined参照を防ぐ）
    getChapterDetails.mockReturnValue({ characters: '', setting: '', mood: '', keyEvents: '' });
    const { aiService } = await import('../../services/aiService');
    (aiService.buildPrompt as ReturnType<typeof vi.fn>).mockReturnValue('全章生成プロンプト');
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
      }),
      { wrapper }
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
      }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    expect(onError).toHaveBeenCalled();
  });

  it('生成成功時に各章の草案がupdateProjectで保存される', async () => {
    const { aiService } = await import('../../services/aiService');
    // 2章分の `=== 第N章 ===` 区切りコンテンツを返す
    (aiService.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: '=== 第1章: 第1章 ===\n第1章の本文。\n=== 第2章: 第2章 ===\n第2章の本文。',
    });

    const project = makeProject();
    project.chapters = [
      { id: 'ch-1', title: '第1章', summary: '要約1', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
      { id: 'ch-2', title: '第2章', summary: '要約2', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
    ];

    const { result } = renderHook(() =>
      useAllChaptersGeneration({
        currentProject: project,
        settings: defaultSettings,
        isConfigured: true,
        getChapterDetails,
        onError,
        onWarning,
        updateProject,
        setChapterDrafts,
        setShowCompletionToast,
      }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    // updateProjectが各章の草案付きで呼ばれること
    expect(updateProject).toHaveBeenCalled();
    const lastCall = updateProject.mock.calls[updateProject.mock.calls.length - 1][0];
    expect(lastCall.chapters[0].draft).toContain('第1章の本文');
    expect(lastCall.chapters[1].draft).toContain('第2章の本文');
    // 完了後はタスクが除去され、実行中フラグがfalse
    expect(result.current.isGeneratingAllChapters).toBe(false);
  });

  it('全角数字・全角コロンのセパレータでも各章を正しく分割できる', async () => {
    const { aiService } = await import('../../services/aiService');
    // AIが全角数字「第１章」・全角コロン「：」・空白揺れで返すケース
    (aiService.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: '===第１章：第1章===\n第1章の本文。\n=== 第２章 ： 第2章 ===\n第2章の本文。',
    });

    const project = makeProject();
    project.chapters = [
      { id: 'ch-1', title: '第1章', summary: '要約1', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
      { id: 'ch-2', title: '第2章', summary: '要約2', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
    ];

    const { result } = renderHook(() =>
      useAllChaptersGeneration({
        currentProject: project,
        settings: defaultSettings,
        isConfigured: true,
        getChapterDetails,
        onError,
        onWarning,
        updateProject,
        setChapterDrafts,
        setShowCompletionToast,
      }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    const lastCall = updateProject.mock.calls[updateProject.mock.calls.length - 1][0];
    expect(lastCall.chapters[0].draft).toContain('第1章の本文');
    expect(lastCall.chapters[1].draft).toContain('第2章の本文');
    expect(onError).not.toHaveBeenCalled();
  });

  it('一部の章しか分割できない場合は onWarning で未生成を通知する', async () => {
    const { aiService } = await import('../../services/aiService');
    // 3章プロジェクトに対しAIが2章分のセパレータしか返さない
    (aiService.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: '=== 第1章: 第1章 ===\n第1章の本文。\n=== 第2章: 第2章 ===\n第2章の本文。',
    });

    const project = makeProject();
    project.chapters = [
      { id: 'ch-1', title: '第1章', summary: '要約1', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
      { id: 'ch-2', title: '第2章', summary: '要約2', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
      { id: 'ch-3', title: '第3章', summary: '要約3', draft: '', characters: [], setting: '', mood: '', keyEvents: [] },
    ];

    const { result } = renderHook(() =>
      useAllChaptersGeneration({
        currentProject: project,
        settings: defaultSettings,
        isConfigured: true,
        getChapterDetails,
        onError,
        onWarning,
        updateProject,
        setChapterDrafts,
        setShowCompletionToast,
      }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    // 未生成章があるため警告を出し、成功トーストは出さない
    expect(onWarning).toHaveBeenCalled();
    expect(setShowCompletionToast).not.toHaveBeenCalled();
  });

  it('1章も分割できなかった場合は onError でエラー扱いになり成功トーストを出さない', async () => {
    const { aiService } = await import('../../services/aiService');
    // セパレータを一切含まない出力（旧実装ではサイレントに0章で成功表示していた）
    (aiService.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: 'セパレータの無い本文だけが返ってきた。',
    });

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
      }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    expect(onError).toHaveBeenCalled();
    expect(setShowCompletionToast).not.toHaveBeenCalled();
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
      }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleGenerateAllChapters();
    });

    expect(aiService.generateContent).not.toHaveBeenCalled();
  });
});
