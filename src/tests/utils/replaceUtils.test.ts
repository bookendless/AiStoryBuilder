import { describe, it, expect } from 'vitest';
import {
  countOccurrences,
  buildReplacePreview,
  applyReplace,
  ReplaceScope,
} from '../../utils/replaceUtils';
import type { Project } from '../../contexts/ProjectContext';

const createProject = (): Project => ({
  id: 'p1',
  title: '太郎の冒険',
  description: '太郎が旅に出る物語',
  theme: '成長',
  imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [
    {
      id: 'c1',
      name: '太郎',
      role: '主人公',
      appearance: '黒髪の少年',
      personality: '太郎は素直な性格',
      background: '村で育った',
    },
  ],
  plot: {
    theme: '太郎の成長',
    setting: '中世風の王国',
    hook: '村が襲われる',
    protagonistGoal: '太郎が王を救う',
    mainObstacle: '魔王軍',
  },
  synopsis: '太郎は村を出て、太郎の運命に立ち向かう。',
  chapters: [
    {
      id: 'ch1',
      title: '太郎の旅立ち',
      summary: '太郎が村を出る',
      draft: '「行ってきます」と太郎は言った。太郎の目は輝いていた。',
      keyEvents: ['太郎の決意'],
    },
  ],
  draft: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  glossary: [
    {
      id: 'g1',
      term: '太郎',
      definition: '本作の主人公',
      category: 'character',
      createdAt: new Date(),
    },
  ],
});

describe('countOccurrences', () => {
  it('出現回数を数える', () => {
    expect(countOccurrences('太郎と太郎の影', '太郎')).toBe(2);
  });

  it('空文字列やundefinedは0', () => {
    expect(countOccurrences('', '太郎')).toBe(0);
    expect(countOccurrences(undefined, '太郎')).toBe(0);
    expect(countOccurrences('テキスト', '')).toBe(0);
  });
});

describe('buildReplacePreview', () => {
  it('スコープごとの件数を集計する', () => {
    const preview = buildReplacePreview(createProject(), '太郎');

    const byScope = Object.fromEntries(preview.scopes.map(s => [s.scope, s.count]));
    expect(byScope.basic).toBe(2); // タイトル1 + 説明1
    expect(byScope.characters).toBe(2); // name + personality
    expect(byScope.plot).toBe(2); // theme + protagonistGoal
    expect(byScope.synopsis).toBe(2);
    expect(byScope.chapters).toBe(3); // title + summary + keyEvents
    expect(byScope.drafts).toBe(2);
    expect(byScope.glossary).toBe(1);
    expect(preview.total).toBe(14);
  });

  it('ヒットしないスコープは含まれない', () => {
    const preview = buildReplacePreview(createProject(), '存在しない語');
    expect(preview.total).toBe(0);
    expect(preview.scopes).toEqual([]);
  });
});

describe('applyReplace', () => {
  it('選択したスコープのみ置換する', () => {
    const project = createProject();
    const scopes = new Set<ReplaceScope>(['drafts', 'synopsis']);
    const updates = applyReplace(project, '太郎', '花子', scopes);

    expect(updates.synopsis).toBe('花子は村を出て、花子の運命に立ち向かう。');
    expect(updates.chapters?.[0].draft).toBe('「行ってきます」と花子は言った。花子の目は輝いていた。');
    // 選択外スコープは変更されない
    expect(updates.chapters?.[0].title).toBe('太郎の旅立ち');
    expect(updates.title).toBeUndefined();
    expect(updates.characters).toBeUndefined();
    expect(updates.glossary).toBeUndefined();
  });

  it('章立てと草案の両方を選択した場合は同じchapters配列で処理される', () => {
    const project = createProject();
    const scopes = new Set<ReplaceScope>(['chapters', 'drafts']);
    const updates = applyReplace(project, '太郎', '花子', scopes);

    expect(updates.chapters?.[0].title).toBe('花子の旅立ち');
    expect(updates.chapters?.[0].summary).toBe('花子が村を出る');
    expect(updates.chapters?.[0].keyEvents).toEqual(['花子の決意']);
    expect(updates.chapters?.[0].draft).toBe('「行ってきます」と花子は言った。花子の目は輝いていた。');
  });

  it('キャラクター・用語集も置換できる', () => {
    const project = createProject();
    const scopes = new Set<ReplaceScope>(['characters', 'glossary']);
    const updates = applyReplace(project, '太郎', '花子', scopes);

    expect(updates.characters?.[0].name).toBe('花子');
    expect(updates.characters?.[0].personality).toBe('花子は素直な性格');
    expect(updates.glossary?.[0].term).toBe('花子');
  });

  it('置換後が空文字列の場合は削除になる', () => {
    const project = createProject();
    const updates = applyReplace(project, '太郎', '', new Set<ReplaceScope>(['synopsis']));
    expect(updates.synopsis).toBe('は村を出て、の運命に立ち向かう。');
  });

  it('検索クエリが空文字列なら何も変更しない（全フィールド破壊の防止）', () => {
    const project = createProject();
    const updates = applyReplace(project, '', 'X', new Set<ReplaceScope>(['synopsis', 'drafts']));
    expect(updates).toEqual({});
  });
});
