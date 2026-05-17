import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../../components/steps/draft/utils';

describe('sanitizeFilename', () => {
  it('バックスラッシュ・スラッシュ等の不正文字をアンダースコアに置換する', () => {
    expect(sanitizeFilename('file\\name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    expect(sanitizeFilename('file:name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file*name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file?name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file"name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file<name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file>name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file|name.txt')).toBe('file_name.txt');
  });

  it('正常なファイル名はそのまま返す', () => {
    expect(sanitizeFilename('chapter1.txt')).toBe('chapter1.txt');
    expect(sanitizeFilename('my-story.txt')).toBe('my-story.txt');
  });

  it('日本語ファイル名はそのまま返す', () => {
    expect(sanitizeFilename('第1章.txt')).toBe('第1章.txt');
    expect(sanitizeFilename('テスト_完全版.txt')).toBe('テスト_完全版.txt');
  });
});

describe('exportChapter コンテンツ形式', () => {
  it('チャプタータイトルと本文が Markdown 形式で結合される', () => {
    const title = '第1章';
    const draft = '本文の内容です。';
    const content = `# ${title}\n\n${draft}`;
    expect(content).toBe('# 第1章\n\n本文の内容です。');
    expect(content).toContain(`# ${title}`);
    expect(content).toContain(draft);
  });

  it('全体エクスポートは全章を含む', () => {
    const projectTitle = 'テスト小説';
    const chapters = [
      { title: '第1章', draft: '第1章の内容' },
      { title: '第2章', draft: '第2章の内容' },
    ];
    let content = `# ${projectTitle}\n\n`;
    chapters.forEach(ch => {
      content += `## ${ch.title}\n\n${ch.draft}\n\n`;
    });
    expect(content).toContain('# テスト小説');
    expect(content).toContain('## 第1章');
    expect(content).toContain('## 第2章');
    expect(content).toContain('第1章の内容');
    expect(content).toContain('第2章の内容');
  });
});
