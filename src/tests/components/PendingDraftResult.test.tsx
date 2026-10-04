import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PendingResultProvider } from '../../contexts/PendingResultContext';
import { usePendingResult } from '../../contexts/usePendingResult';
import { PendingResultModal } from '../../components/common/PendingResultModal';
import { useDraftResult } from '../../components/steps/draft/hooks/useDraftResult';
import { narrativeProject } from '../services/narrativeFixtures';
import type { Project } from '../../types/project';

let project: Project;
const persist = vi.fn(async () => {});
const commit = async (change: (p: Project) => Partial<Project>, id: string) => {
  if (project.id !== id) throw new Error('作品が違います');
  project = { ...project, ...change(project) };
  await persist();
  return { generation: 1, project };
};
vi.mock('../../contexts/useProject', () => ({ useProject: () => ({ currentProject: project, getCurrentProject: () => project, commitProjectUpdate: commit }) }));
vi.mock('../../components/useToast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showInfo: vi.fn(), showError: vi.fn() }) }));

function Generator({ response }: { response: Promise<string> }) {
  const stage = useDraftResult(project, 'c1', project.chapters[0].draft ?? '');
  return <button onClick={() => { void response.then(text => stage(text, '保存しました', { review: true })); }}>生成</button>;
}
function Inbox() {
  const { pendingResults, openResult } = usePendingResult();
  return <>{pendingResults.map(r => <button key={r.id} onClick={() => openResult(r.id)}>確認待ちを開く</button>)}</>;
}
function App({ visible, response }: { visible: boolean; response: Promise<string> }) {
  return <PendingResultProvider>{visible && <Generator response={response} />}<Inbox /><PendingResultModal /></PendingResultProvider>;
}

describe('global draft review', () => {
  beforeEach(() => { vi.clearAllMocks(); project = narrativeProject(); persist.mockResolvedValue(undefined); });
  it('keeps late results after sidebar removal, closing review, and reopens with full text', async () => {
    let finish!: (text: string) => void;
    const response = new Promise<string>(resolve => { finish = resolve; });
    const view = render(<App visible response={response} />);
    fireEvent.click(screen.getByText('生成'));
    view.rerender(<App visible={false} response={response} />);
    await act(async () => { finish('移動後の草案全文'); });
    fireEvent.click(screen.getByText('確認待ちを開く'));
    expect(screen.getByText('移動後の草案全文')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('確認待ちを開く')).toBeTruthy();
    fireEvent.click(screen.getByText('確認待ちを開く'));
    fireEvent.click(screen.getByRole('button', { name: /^適用$/ }));
    await waitFor(() => expect(screen.queryByText('確認待ちを開く')).toBeNull());
    expect(project.chapters[0].draft).toBe('移動後の草案全文');
  });
  it('retains review on save failure and only removes it after a successful retry', async () => {
    persist.mockRejectedValueOnce(new Error('保存失敗'));
    render(<App visible response={Promise.resolve('再試行する本文')} />);
    fireEvent.click(screen.getByText('生成'));
    await screen.findByRole('button', { name: /^適用$/ });
    fireEvent.click(screen.getByRole('button', { name: /^適用$/ }));
    await waitFor(() => expect(persist).toHaveBeenCalledOnce());
    await screen.findByRole('button', { name: /^適用$/ });
    expect(screen.getByText('再試行する本文')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^適用$/ }));
    await waitFor(() => expect(screen.queryByText('確認待ちを開く')).toBeNull());
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
