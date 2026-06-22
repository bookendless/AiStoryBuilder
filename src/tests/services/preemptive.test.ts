import { describe, it, expect, vi } from 'vitest';
import { AIRunner } from '../../types/sequel';
import { Project } from '../../types/project';
import { generatePreemptiveSynopsis } from '../../services/preemptive/generatePreemptiveSynopsis';
import { generatePreemptiveChapters } from '../../services/preemptive/generatePreemptiveChapters';
import { generatePreemptiveDraft, findFirstUndraftedChapter } from '../../services/preemptive/generatePreemptiveDraft';
import { parseChapterList } from '../../services/chapter/parseChapterList';

/**
 * 先回り生成（Phase D）のサービス層を、実APIを使わず注入したフェイク AIRunner で検証する。
 * - 各 generatePreemptive* が project からプロンプトを組み立て run を1回呼ぶ
 * - 戻り値の kind / 整形が正しい
 * - draft は最初の未草案章のみを対象にし、全章草案済みなら null
 */

function makeProject(overrides: Partial<Project> = {}): Project {
  const base = {
    id: 'p1',
    title: 'テスト作品',
    description: '記憶を失った少女の物語',
    mainGenre: 'ファンタジー',
    subGenre: '冒険',
    targetReader: '全年齢',
    projectTheme: '記憶',
    theme: '',
    customSubGenre: '',
    customTargetReader: '',
    customTheme: '',
    characters: [
      { id: 'c1', name: 'ミナ', role: '主人公', appearance: '銀髪', personality: '芯が強い', background: '記憶喪失' },
      { id: 'c2', name: 'ハル', role: '案内人', appearance: '白髭', personality: '穏やか', background: '長老' },
    ],
    plot: {
      theme: '記憶と自己', setting: '港町', hook: '名前を思い出せない',
      protagonistGoal: '記憶を取り戻す', mainObstacle: '住人が真実を隠す',
      structure: 'kishotenketsu', ki: '港町に現れる', sho: '探索', ten: '真実', ketsu: '居場所',
    },
    synopsis: '',
    chapters: [],
    relationships: [],
    worldSettings: [],
    glossary: [],
    timeline: [],
    writingStyle: { style: '現代小説風', perspective: '三人称' },
  };
  return { ...base, ...overrides } as unknown as Project;
}

describe('generatePreemptiveSynopsis', () => {
  it('project からプロンプトを組み立て run を1回呼び、synopsis を返す', async () => {
    const run = vi.fn<AIRunner>(async () => '霧の港町で少女ミナが記憶を辿る物語。');
    const result = await generatePreemptiveSynopsis(makeProject(), { run });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('synopsis');
    expect(result.synopsis).toContain('ミナ');
    // プロンプトにプロジェクト情報が含まれている
    const prompt = run.mock.calls[0][0];
    expect(prompt).toContain('テスト作品');
    expect(prompt).toContain('記憶と自己');
  });
});

describe('generatePreemptiveChapters', () => {
  it('AI応答を章配列にパースして返す', async () => {
    const aiOutput = [
      '第1章: 港町の朝',
      '概要: 少女が港町で目を覚ます',
      '第2章: 失われた名前',
      '概要: 自分の名前すら思い出せない',
    ].join('\n');
    const run = vi.fn<AIRunner>(async () => aiOutput);
    const result = await generatePreemptiveChapters(makeProject(), { run });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('chapter');
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].title).toBe('港町の朝');
    expect(result.chapters[1].summary).toContain('名前');
  });
});

describe('generatePreemptiveDraft', () => {
  it('最初の未草案章を対象に草案を返す', async () => {
    const project = makeProject({
      chapters: [
        { id: 'ch1', title: '第1章', summary: '導入', draft: '既に書かれた草案' },
        { id: 'ch2', title: '第2章', summary: '展開' },
        { id: 'ch3', title: '第3章', summary: '転換' },
      ],
    } as Partial<Project>);
    const run = vi.fn<AIRunner>(async () => '第2章の草案本文。');
    const result = await generatePreemptiveDraft(project, { run });
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('draft');
    expect(result!.chapterId).toBe('ch2');
    expect(result!.chapterTitle).toBe('第2章');
    expect(result!.draft).toContain('草案本文');
  });

  it('全章が草案済みなら null を返し run を呼ばない', async () => {
    const project = makeProject({
      chapters: [
        { id: 'ch1', title: '第1章', summary: '導入', draft: '草案1' },
        { id: 'ch2', title: '第2章', summary: '展開', draft: '草案2' },
      ],
    } as Partial<Project>);
    const run = vi.fn<AIRunner>(async () => 'should not be called');
    const result = await generatePreemptiveDraft(project, { run });
    expect(result).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('findFirstUndraftedChapter は空白のみの draft も未草案として扱う', () => {
    const project = makeProject({
      chapters: [
        { id: 'ch1', title: '第1章', summary: '導入', draft: '   ' },
        { id: 'ch2', title: '第2章', summary: '展開', draft: '本文' },
      ],
    } as Partial<Project>);
    expect(findFirstUndraftedChapter(project)?.id).toBe('ch1');
  });
});

describe('parseChapterList', () => {
  it('複数パターンの章見出しを検出する', () => {
    const content = ['第1章: 始まり', '1. 次の章', '【第3章】 終幕'].join('\n');
    const chapters = parseChapterList(content);
    expect(chapters.map(c => c.title)).toEqual(['始まり', '次の章', '終幕']);
  });

  it('章が無ければ空配列を返す', () => {
    expect(parseChapterList('章見出しのないテキスト')).toEqual([]);
  });
});
