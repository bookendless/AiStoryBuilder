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
  it('waits for the replacing generation when a queued immediate save is superseded', async () => {
    const releases: Array<() => void> = [];
    const save = vi.fn(() => new Promise<void>(resolve => releases.push(resolve)));
    const coordinator = new ProjectSaveCoordinator({ save });
    const first = coordinator.schedule(makeProject('first'), true);
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    let durable = false;
    const barrier = coordinator.schedule(makeProject('second'), true).then(() => { durable = true; });
    await coordinator.schedule(makeProject('newest'));
    releases[0](); await first;
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]).toEqual([expect.objectContaining({ title: 'newest' })]);
    expect(durable).toBe(false);
    releases[1](); await barrier;
    expect(durable).toBe(true);
    expect(await coordinator.flushThrough('project-1', 3)).toBe(3);
  });
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
