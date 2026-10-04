import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { useChapterDraft } from '../../components/steps/draft/hooks/useChapterDraft';

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
  it('shares unsaved edits between views and an old autosave callback flushes the latest text', async () => {
    const { result } = renderHook(() => {
      const [project, setProject] = useState(makeProject);
      const latest = useRef(project); latest.current = project;
      const update = useCallback<Parameters<typeof useChapterDraft>[0]['updateProject']>(async patch => {
        latest.current = { ...latest.current, ...(typeof patch === 'function' ? patch(latest.current) : patch) };
        setProject(latest.current);
      }, []);
      const editor = useChapterDraft({ currentProject: project, updateProject: update, selectedChapter: 'ch-1' });
      const assistant = useChapterDraft({ currentProject: project, updateProject: update, selectedChapter: 'ch-1' });
      return { editor, assistant };
    });
    const oldAutosave = result.current.editor.handleSaveChapterDraft;
    await act(async () => result.current.editor.setDraft('未保存の編集'));
    expect(result.current.assistant.draft).toBe('未保存の編集');
    await act(async () => result.current.assistant.setDraft('AIからの新しい本文'));
    await act(async () => oldAutosave('ch-1'));
    expect(result.current.editor.draft).toBe('AIからの新しい本文');
    await act(async () => result.current.editor.setDraft(''));
    expect(result.current.assistant.draft).toBe('');
  });
  const updateProject = vi.fn<Parameters<typeof useChapterDraft>[0]['updateProject']>(async () => {});
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

  it('handleSaveChapterDraft はProjectContext経由で即時保存する', async () => {
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
    expect(updateProject).toHaveBeenCalledWith(
      expect.any(Function),
      true,
      'proj-1'
    );
    const update = updateProject.mock.calls[0][0];
    expect(typeof update === 'function' ? update(makeProject()) : update).toMatchObject({ draft: '新しい内容' });
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

  it('空文字の草案を保存できる', async () => {
    const { result } = renderHook(() =>
      useChapterDraft({
        currentProject: makeProject(),
        updateProject,
        selectedChapter: 'ch-1',
      })
    );
    await act(async () => {
      await result.current.handleSaveChapterDraft('ch-1', '');
    });
    expect(updateProject).toHaveBeenCalledWith(
      expect.any(Function),
      true,
      'proj-1'
    );
    const update = updateProject.mock.calls[0][0];
    expect(typeof update === 'function' ? update(makeProject()) : update).toMatchObject({ draft: '' });
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
