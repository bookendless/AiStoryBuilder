import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryDialog } from '../../components/RecoveryDialog';
import { getRecoveryData, saveRecoveryData } from '../../services/crashRecoveryService';
import type { Project } from '../../types/project';

const project: Project = {
  id: 'recovery-project', title: '復元テスト', description: '', theme: '', imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [], plot: { theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' },
  synopsis: '本文', chapters: [], draft: '', createdAt: new Date(), updatedAt: new Date(0),
};

describe('RecoveryDialog', () => {
  it('keeps recovery data until asynchronous recovery succeeds', async () => {
    saveRecoveryData(project);
    let finish: (() => void) | undefined;
    const onRecover = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const onClose = vi.fn();
    render(<RecoveryDialog isOpen onRecover={onRecover} onDiscard={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '復元する' }));
    expect(onRecover).toHaveBeenCalledTimes(1);
    expect(getRecoveryData()).not.toBeNull();

    await act(async () => { finish?.(); });
    await waitFor(() => expect(getRecoveryData()).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps recovery data when recovery fails', async () => {
    saveRecoveryData(project);
    const onRecover = vi.fn().mockRejectedValue(new Error('save failed'));
    render(<RecoveryDialog isOpen onRecover={onRecover} onDiscard={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '復元する' }));
    await waitFor(() => expect(onRecover).toHaveBeenCalledTimes(1));
    expect(getRecoveryData()).not.toBeNull();
  });
});
