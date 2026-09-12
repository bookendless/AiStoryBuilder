import { describe, expect, it } from 'vitest';
import { mergeRecoveryData } from '../../services/crashRecoveryService';
import type { Project } from '../../types/project';

const project: Project = {
  id: 'project-1', title: '作品', description: '', theme: '', imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [], plot: { theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' },
  synopsis: '削除前', chapters: [], draft: '', createdAt: new Date(0), updatedAt: new Date(0),
};

describe('mergeRecoveryData', () => {
  it('preserves an intentional empty synopsis from recovery data', () => {
    const merged = mergeRecoveryData(project, {
      projectId: project.id,
      projectData: { synopsis: '' },
      timestamp: 1,
      version: 1,
    });

    expect(merged.synopsis).toBe('');
  });
});
