import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { generateEpub, canGenerateEpub } from '../../services/epubService';
import type { Project } from '../../contexts/ProjectContext';

const createProject = (): Project => ({
  id: 'test-uuid',
  title: 'テスト小説',
  description: '',
  theme: '',
  imageBoard: [],
  progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
  characters: [],
  plot: { theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' },
  synopsis: 'あらすじの本文。',
  chapters: [
    { id: 'ch1', title: '旅立ち', summary: '', draft: '　｜東京《とうきょう》を出た。\n\n「行こう」' },
    { id: 'ch2', title: '', summary: '', draft: '' },
  ],
  draft: '',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('generateEpub', () => {
  it('EPUB3の必須ファイルを含むZIPを生成する', () => {
    const data = generateEpub(createProject(), {
      vertical: true,
      includeSynopsis: true,
      author: 'テスト著者',
    });
    const unzipped = unzipSync(data);

    expect(Object.keys(unzipped)).toContain('mimetype');
    expect(Object.keys(unzipped)).toContain('META-INF/container.xml');
    expect(Object.keys(unzipped)).toContain('OEBPS/content.opf');
    expect(Object.keys(unzipped)).toContain('OEBPS/nav.xhtml');
    expect(Object.keys(unzipped)).toContain('OEBPS/style.css');
    expect(Object.keys(unzipped)).toContain('OEBPS/synopsis.xhtml');
    expect(Object.keys(unzipped)).toContain('OEBPS/chapter-1.xhtml');
    // 草案のない章は含まれない
    expect(Object.keys(unzipped)).not.toContain('OEBPS/chapter-2.xhtml');

    expect(strFromU8(unzipped['mimetype'])).toBe('application/epub+zip');
  });

  it('メタデータと縦書き設定が反映される', () => {
    const data = generateEpub(createProject(), {
      vertical: true,
      includeSynopsis: false,
      author: 'テスト著者',
    });
    const unzipped = unzipSync(data);

    const opf = strFromU8(unzipped['OEBPS/content.opf']);
    expect(opf).toContain('<dc:title>テスト小説</dc:title>');
    expect(opf).toContain('<dc:creator>テスト著者</dc:creator>');
    expect(opf).toContain('page-progression-direction="rtl"');

    const css = strFromU8(unzipped['OEBPS/style.css']);
    expect(css).toContain('vertical-rl');

    expect(Object.keys(unzipped)).not.toContain('OEBPS/synopsis.xhtml');
  });

  it('横書きでは縦書き設定が入らない', () => {
    const data = generateEpub(createProject(), {
      vertical: false,
      includeSynopsis: false,
    });
    const unzipped = unzipSync(data);

    expect(strFromU8(unzipped['OEBPS/content.opf'])).not.toContain('page-progression-direction');
    expect(strFromU8(unzipped['OEBPS/style.css'])).not.toContain('vertical-rl');
  });

  it('ルビ記法がrubyタグへ変換される', () => {
    const data = generateEpub(createProject(), {
      vertical: true,
      includeSynopsis: false,
    });
    const unzipped = unzipSync(data);
    const chapter = strFromU8(unzipped['OEBPS/chapter-1.xhtml']);
    expect(chapter).toContain('<ruby>東京<rt>とうきょう</rt></ruby>');
  });

  it('XMLで不正な制御文字を本文から除去する', () => {
    const project = createProject();
    project.chapters = [
      { id: 'ch1', title: '制御文字', summary: '', draft: `本文${String.fromCharCode(0)}の${String.fromCharCode(7)}途中` },
    ];
    const data = generateEpub(project, { vertical: false, includeSynopsis: false });
    const chapter = strFromU8(unzipSync(data)['OEBPS/chapter-1.xhtml']);
    // 制御文字が残っていない（除去済み）
    expect(chapter).not.toContain(String.fromCharCode(0));
    expect(chapter).not.toContain(String.fromCharCode(7));
    expect(chapter).toContain('本文の途中');
  });
});

describe('canGenerateEpub', () => {
  it('本文のある章があればtrue', () => {
    expect(canGenerateEpub(createProject())).toBe(true);
  });

  it('本文がなければfalse', () => {
    const project = createProject();
    project.chapters = project.chapters.map(c => ({ ...c, draft: '' }));
    expect(canGenerateEpub(project)).toBe(false);
    expect(canGenerateEpub(null)).toBe(false);
  });
});
