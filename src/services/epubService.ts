/**
 * EPUB3生成サービス
 *
 * 外部サーバーを使わず、fflateでEPUB3（ZIPコンテナ）をクライアント内で生成する。
 * 日本語小説向けに縦書き（vertical-rl・右開き）と横書きの両方に対応し、
 * ルビ・傍点記法は <ruby> 要素と圏点スタイルへ変換される。
 */

import { zipSync, strToU8 } from 'fflate';
import { Project } from '../contexts/ProjectContext';
import { rubyNotationToHtml } from '../utils/rubyUtils';
import { escapeHtml } from '../utils/securityUtils';

export interface EpubOptions {
  /** 縦書き（右開き）で組むかどうか */
  vertical: boolean;
  /** あらすじページを含めるか */
  includeSynopsis: boolean;
  /** 著者名（奥付・メタデータ用） */
  author?: string;
}

/**
 * XML1.0で不正な制御文字を除去する。
 * escapeHtml は &<>"'/ しか変換しないため、AI生成テキストに紛れる制御文字
 * （U+0000–U+0008 等）が残ると準拠EPUBリーダーがXHTMLを不正と判定する。
 * タブ(U+0009)・改行(U+000A)・復帰(U+000D)は許容。
 */
const XML_INVALID_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
function stripInvalidXmlChars(text: string): string {
  return text.replace(XML_INVALID_CHARS, '');
}

/** 章本文をXHTMLの段落列へ変換（ルビ・傍点記法対応） */
function draftToXhtmlBody(draft: string): string {
  return stripInvalidXmlChars(draft)
    .split('\n')
    .map(line => {
      if (!line.trim()) {
        return '<p class="blank">&#160;</p>';
      }
      return `<p>${rubyNotationToHtml(line, escapeHtml)}</p>`;
    })
    .join('\n');
}

function buildChapterXhtml(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`;
}

function buildStyleCss(vertical: boolean): string {
  const writingMode = vertical
    ? `html {
  writing-mode: vertical-rl;
  -epub-writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  text-orientation: upright;
}`
    : '';

  return `@charset "UTF-8";
${writingMode}
body {
  font-family: serif;
  line-height: 1.8;
  margin: 0;
  padding: 0.5em;
}
h1 {
  font-size: 1.3em;
  font-weight: bold;
  margin: 0 0 1.5em 0;
}
p {
  margin: 0;
  text-indent: 0;
}
p.blank {
  min-height: 1em;
}
ruby rt {
  font-size: 0.5em;
}
.emphasis-dots {
  text-emphasis: filled sesame;
  -webkit-text-emphasis: filled sesame;
  -epub-text-emphasis: filled sesame;
}
`;
}

/**
 * プロジェクトからEPUB3バイナリを生成する
 */
export function generateEpub(project: Project, options: EpubOptions): Uint8Array {
  const uuid = `urn:uuid:${project.id}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const author = options.author?.trim() || '著者不明';

  // 本文のある章のみ対象
  const chapters = project.chapters
    .map((chapter, index) => ({
      id: `chapter-${index + 1}`,
      title: chapter.title || `第${index + 1}章`,
      draft: chapter.draft || '',
    }))
    .filter(chapter => chapter.draft.trim());

  const files: Record<string, Uint8Array> = {};

  // container.xml
  files['META-INF/container.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // スタイル
  files['OEBPS/style.css'] = strToU8(buildStyleCss(options.vertical));

  // コンテンツページ
  const contentEntries: Array<{ id: string; href: string; title: string }> = [];

  if (options.includeSynopsis && project.synopsis.trim()) {
    files['OEBPS/synopsis.xhtml'] = strToU8(
      buildChapterXhtml('あらすじ', draftToXhtmlBody(project.synopsis))
    );
    contentEntries.push({ id: 'synopsis', href: 'synopsis.xhtml', title: 'あらすじ' });
  }

  chapters.forEach(chapter => {
    files[`OEBPS/${chapter.id}.xhtml`] = strToU8(
      buildChapterXhtml(chapter.title, draftToXhtmlBody(chapter.draft))
    );
    contentEntries.push({ id: chapter.id, href: `${chapter.id}.xhtml`, title: chapter.title });
  });

  // 目次（nav.xhtml）
  const navItems = contentEntries
    .map(entry => `      <li><a href="${entry.href}">${escapeHtml(entry.title)}</a></li>`)
    .join('\n');
  files['OEBPS/nav.xhtml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">
<head>
<meta charset="UTF-8"/>
<title>目次</title>
</head>
<body>
<nav epub:type="toc" id="toc">
  <h1>目次</h1>
  <ol>
${navItems}
  </ol>
</nav>
</body>
</html>`);

  // content.opf
  const manifestItems = contentEntries
    .map(entry => `    <item id="${entry.id}" href="${entry.href}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spineItems = contentEntries
    .map(entry => `    <itemref idref="${entry.id}"/>`)
    .join('\n');
  const pageProgression = options.vertical ? ' page-progression-direction="rtl"' : '';

  files['OEBPS/content.opf'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${uuid}</dc:identifier>
    <dc:title>${escapeHtml(project.title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine${pageProgression}>
${spineItems}
  </spine>
</package>`);

  // zip化。EPUB仕様: mimetypeは無圧縮で先頭に配置する
  return zipSync(
    {
      mimetype: [strToU8('application/epub+zip'), { level: 0 }],
      ...Object.fromEntries(
        Object.entries(files).map(([path, data]) => [path, [data, { level: 6 }]] as const)
      ),
    } as Parameters<typeof zipSync>[0],
    { mtime: new Date() }
  );
}

/**
 * EPUBを生成できる状態か（本文のある章が1つ以上あるか）
 */
export function canGenerateEpub(project: Project | null): boolean {
  return !!project && project.chapters.some(chapter => chapter.draft?.trim());
}
