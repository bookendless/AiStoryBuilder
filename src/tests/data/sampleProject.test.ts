import { describe, it, expect } from 'vitest';
import { createSampleProject } from '../../data/sampleProject';
import { canGenerateEpub } from '../../services/epubService';
import { computeTotalDraftChars } from '../../utils/writingStatsUtils';
import { hasRubyNotation } from '../../utils/rubyUtils';

describe('createSampleProject', () => {
  it('必須フィールドが揃った完成済みプロジェクトを返す', () => {
    const p = createSampleProject();
    expect(p.title).toContain('サンプル');
    expect(p.characters.length).toBeGreaterThanOrEqual(2);
    expect(p.chapters.length).toBeGreaterThanOrEqual(3);
    expect(p.synopsis.length).toBeGreaterThan(0);
    expect(p.plot.structure).toBe('kishotenketsu');
  });

  it('全ての章に草案が入っている（EPUB出力・執筆量計測が可能）', () => {
    const p = createSampleProject();
    expect(p.chapters.every(c => (c.draft ?? '').trim().length > 0)).toBe(true);
    expect(canGenerateEpub(p)).toBe(true);
    expect(computeTotalDraftChars(p.chapters, p.draft)).toBeGreaterThan(0);
  });

  it('ルビ・傍点記法を含み、新機能を体験できる', () => {
    const p = createSampleProject();
    const allDrafts = p.chapters.map(c => c.draft ?? '').join('\n');
    expect(hasRubyNotation(allDrafts)).toBe(true);
  });

  it('呼び出しごとに新しいIDを生成する', () => {
    const a = createSampleProject();
    const b = createSampleProject();
    expect(a.id).not.toBe(b.id);
    // 章IDもプロジェクト間で重複しない
    const aChapterIds = a.chapters.map(c => c.id);
    const bChapterIds = b.chapters.map(c => c.id);
    expect(aChapterIds.some(id => bChapterIds.includes(id))).toBe(false);
  });

  it('進捗は100%（完成済み扱い）', () => {
    const p = createSampleProject();
    expect(p.progress.draft).toBe(100);
  });
});
