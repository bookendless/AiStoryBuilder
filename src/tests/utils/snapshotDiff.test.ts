import { describe, it, expect } from 'vitest';
import { diffSnapshots } from '../../utils/snapshotDiff';
import type { Project } from '../../contexts/ProjectContext';

const base = (): Project => ({
  id: 'p1',
  title: '物語',
  description: '説明',
  theme: '',
  imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [
    { id: 'c1', name: '太郎', role: '主人公', appearance: '', personality: '', background: '' },
  ],
  plot: { theme: 'A', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' },
  synopsis: 'あらすじ本文',
  chapters: [
    { id: 'ch1', title: '第一章', summary: '要約', draft: '本文です' },
  ],
  draft: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  glossary: [],
});

describe('diffSnapshots', () => {
  it('変更がなければ空の配列を返す', () => {
    const result = diffSnapshots(base(), base());
    expect(result.changedCount).toBe(0);
    expect(result.changes).toEqual([]);
  });

  it('あらすじの変更を検出する', () => {
    const after = base();
    after.synopsis = 'あらすじ本文を大幅に加筆した';
    const result = diffSnapshots(base(), after);
    const synopsis = result.changes.find(c => c.label === 'あらすじ');
    expect(synopsis?.kind).toBe('modified');
  });

  it('章草案の文字数差分を検出する', () => {
    const after = base();
    after.chapters[0].draft = '本文ですが、加筆されました';
    const result = diffSnapshots(base(), after);
    const draft = result.changes.find(c => c.label.includes('草案'));
    expect(draft).toBeDefined();
    expect(draft?.kind).toBe('modified');
  });

  it('キャラクターの追加を検出する', () => {
    const after = base();
    after.characters.push({ id: 'c2', name: '花子', role: '', appearance: '', personality: '', background: '' });
    const result = diffSnapshots(base(), after);
    const chars = result.changes.find(c => c.label === 'キャラクター');
    expect(chars?.kind).toBe('added');
    expect(chars?.detail).toContain('1件追加');
  });

  it('キャラクターの削除を検出する', () => {
    const before = base();
    const after = base();
    after.characters = [];
    const result = diffSnapshots(before, after);
    const chars = result.changes.find(c => c.label === 'キャラクター');
    expect(chars?.kind).toBe('removed');
  });

  it('プロットのフィールド変更を検出する', () => {
    const after = base();
    after.plot = { ...after.plot, theme: 'B', hook: '新しいフック' };
    const result = diffSnapshots(base(), after);
    const plot = result.changes.find(c => c.label === 'プロット');
    expect(plot?.kind).toBe('modified');
    expect(plot?.detail).toContain('2項目');
  });

  it('複数セクションの変更を同時に検出する', () => {
    const after = base();
    after.title = '新しい物語';
    after.synopsis = '別のあらすじ';
    const result = diffSnapshots(base(), after);
    expect(result.changedCount).toBeGreaterThanOrEqual(2);
  });
});
