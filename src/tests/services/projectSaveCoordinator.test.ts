import { describe, expect, it, vi } from 'vitest';
import { ProjectSaveCoordinator } from '../../services/projectSaveCoordinator';
import type { Project } from '../../types/project';

const makeProject = (title: string): Project => ({
  id: 'project-1',
  title,
  description: '',
  theme: '',
  imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [],
  plot: { theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' },
  synopsis: '',
  chapters: [],
  draft: '',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ProjectSaveCoordinator', () => {
  it('immediate save supersedes an older delayed snapshot', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const coordinator = new ProjectSaveCoordinator({ save });

    await coordinator.schedule(makeProject('old'));
    await coordinator.schedule(makeProject('latest'), true);
    await vi.advanceTimersByTimeAsync(500);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'latest' }));
    vi.useRealTimers();
  });

  it('cancels a pending write before deleting the project', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const coordinator = new ProjectSaveCoordinator({ save });

    await coordinator.schedule(makeProject('pending'));
    await coordinator.delete('project-1', remove);
    await vi.advanceTimersByTimeAsync(500);

    expect(save).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('project-1');
    vi.useRealTimers();
  });

  it('returns an error to an immediate caller when persistence fails', async () => {
    const error = new Error('storage full');
    const coordinator = new ProjectSaveCoordinator({ save: vi.fn().mockRejectedValue(error) });

    await expect(coordinator.schedule(makeProject('unsaved'), true)).rejects.toBe(error);
  });
});
