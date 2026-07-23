/**
 * RAG テスト用のプロジェクトフィクスチャ
 */

import { Project } from '../../../contexts/ProjectContext';
import { Chapter } from '../../../types/project/chapter';
import { Character } from '../../../types/project/character';

export const makeCharacter = (overrides: Partial<Character> & { id: string; name: string }): Character => ({
    role: '',
    appearance: '',
    personality: '',
    background: '',
    ...overrides,
});

export const makeChapter = (overrides: Partial<Chapter> & { id: string; title: string }): Chapter => ({
    summary: '',
    ...overrides,
});

export const makeProject = (overrides: Partial<Project> & { id: string }): Project => ({
    title: 'テスト小説',
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
    ...overrides,
});
