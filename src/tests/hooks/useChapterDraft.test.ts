import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChapterDraft } from '../../components/steps/draft/hooks/useChapterDraft';

vi.mock('../../services/databaseService', () => ({
  databaseService: {
    saveProject: vi.fn().mockResolvedValue(undefined),
  },
}));

const makeProject = () => ({
  id: 'proj-1',
  title: 'テスト',
  description: '',
  theme: '',
  imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [],
  plot: { theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' },
  synopsis: '',
  draft: '',
  chapters: [
    { id: 'ch-1', title: '第1章', summary: '', draft: '第1章の内容' },
    { id: 'ch-2', title: '第2章', summary: '', draft: '第2章の内容' },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
} as Parameters<typeof useChapterDraft>[0]['currentProject'] & object);

describe('useChapterDraft', () => {
  const updateProject = vi.fn();
  const onSaveSuccess = vi.fn();
  const onSaveError = vi.fn();
  const onToastMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('章選択時に draft が chapterDrafts から読み込まれる', () => {
    const { result } = renderHook(() =>
      useChapterDraft({
        currentProject: makeProject(),
        updateProject,
        selectedChapter: 'ch-1',
        onSaveSuccess,
        onSaveError,
        onToastMessage,
      })
    );
    expect(result.current.draft).toBe('第1章の内容');
  });

  it('handleSaveChapterDraft が databaseService.saveProject を呼ぶ', async () => {
    const { databaseService } = await import('../../services/databaseService');
    const { result } = renderHook(() =>
      useChapterDraft({
        currentProject: makeProject(),
        updateProject,
        selectedChapter: 'ch-1',
        onSaveSuccess,
        onSaveError,
        onToastMessage,
      })
    );
    await act(async () => {
      await result.current.handleSaveChapterDraft('ch-1', '新しい内容');
    });
    expect(databaseService.saveProject).toHaveBeenCalled();
  });

  it('isAutoSave=false 時に onToastMessage が呼ばれない', async () => {
    const { result } = renderHook(() =>
      useChapterDraft({
        currentProject: makeProject(),
        updateProject,
        selectedChapter: 'ch-1',
        onSaveSuccess,
        onSaveError,
        onToastMessage,
      })
    );
    await act(async () => {
      await result.current.handleSaveChapterDraft('ch-1', '内容', false);
    });
    expect(onToastMessage).not.toHaveBeenCalled();
  });

  it('isAutoSave=true 時に onToastMessage が自動保存メッセージで呼ばれる', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useChapterDraft({
        currentProject: makeProject(),
        updateProject,
        selectedChapter: 'ch-1',
        onSaveSuccess,
        onSaveError,
        onToastMessage,
      })
    );
    await act(async () => {
      await result.current.handleSaveChapterDraft('ch-1', '内容', true);
    });
    expect(onToastMessage).toHaveBeenCalledWith('自動保存しました');
    vi.useRealTimers();
  });

  it('複数章切り替え時に draft が正しく切り替わる', async () => {
    const project = makeProject();
    let selectedChapter = 'ch-1';
    const { result, rerender } = renderHook(() =>
      useChapterDraft({
        currentProject: project,
        updateProject,
        selectedChapter,
        onSaveSuccess,
        onSaveError,
        onToastMessage,
      })
    );
    expect(result.current.draft).toBe('第1章の内容');

    selectedChapter = 'ch-2';
    rerender();
    expect(result.current.draft).toBe('第2章の内容');
  });
});
