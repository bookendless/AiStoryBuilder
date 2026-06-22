/**
 * 章立てAI応答のパーサ（ChapterAssistantPanel から抽出した純関数）
 *
 * AIが返す自由形式テキスト（「第N章: タイトル」＋概要/設定/ムード/出来事/登場人物）を
 * Chapter ドラフト配列へ変換する。パネルと先回り生成（Phase D）で共有し、解析結果の
 * 乖離を防ぐ。React 非依存・副作用なし。
 */

export interface ParsedChapter {
  id: string;
  title: string;
  summary: string;
  characters?: string[];
  setting?: string;
  mood?: string;
  keyEvents?: string[];
}

export function parseChapterList(content: string): ParsedChapter[] {
  const newChapters: ParsedChapter[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  let currentChapter: {
    id: string;
    title: string;
    summary: string;
    setting: string;
    mood: string;
    keyEvents: string[];
    characters: string[];
  } | null = null;

  // 拡張された章検出パターン
  const chapterPatterns = [
    /第(\d+)章[：:]\s*(.+)/,           // 標準形式: 第1章: タイトル
    /(\d+)\.\s*(.+)/,                  // 番号付き形式: 1. タイトル
    /【第(\d+)章】\s*(.+)/,            // 括弧形式: 【第1章】 タイトル
    /Chapter\s*(\d+)[：:]\s*(.+)/i,    // 英語形式: Chapter 1: タイトル
    /章(\d+)[：:]\s*(.+)/,             // 簡略形式: 章1: タイトル
    /^(\d+)\s*[．.]\s*(.+)/,           // 数字+句点形式: 1．タイトル
    /^(\d+)\s*[-－]\s*(.+)/,           // 数字+ハイフン形式: 1-タイトル
  ];

  // 詳細情報検出パターン（より柔軟）
  const detailPatterns = {
    summary: [/概要[：:]\s*(.+)/, /あらすじ[：:]\s*(.+)/, /内容[：:]\s*(.+)/, /要約[：:]\s*(.+)/],
    setting: [/設定[・・]場所[：:]\s*(.+)/, /舞台[：:]\s*(.+)/, /場所[：:]\s*(.+)/, /設定[：:]\s*(.+)/],
    mood: [/雰囲気[・・]ムード[：:]\s*(.+)/, /ムード[：:]\s*(.+)/, /雰囲気[：:]\s*(.+)/, /トーン[：:]\s*(.+)/],
    keyEvents: [/重要な出来事[：:]\s*(.+)/, /キーイベント[：:]\s*(.+)/, /出来事[：:]\s*(.+)/, /イベント[：:]\s*(.+)/],
    characters: [/登場キャラクター[：:]\s*(.+)/, /登場人物[：:]\s*(.+)/, /キャラクター[：:]\s*(.+)/, /人物[：:]\s*(.+)/]
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 章の開始を検出（複数パターンを試行）
    let chapterMatch: RegExpMatchArray | null = null;
    let chapterTitle = '';

    for (const pattern of chapterPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        chapterMatch = match;
        chapterTitle = match[2].trim();
        break;
      }
    }

    if (chapterMatch) {
      if (currentChapter) {
        newChapters.push(currentChapter);
      }
      currentChapter = {
        id: Date.now().toString() + Math.random(),
        title: chapterTitle,
        summary: '',
        setting: '',
        mood: '',
        keyEvents: [] as string[],
        characters: [] as string[],
      };
    } else if (currentChapter) {
      // 章の詳細情報を解析（複数パターンを試行）
      let detailFound = false;

      // 概要の検出
      for (const pattern of detailPatterns.summary) {
        const match = trimmedLine.match(pattern);
        if (match) {
          currentChapter.summary = match[1].trim();
          detailFound = true;
          break;
        }
      }

      // 設定・場所の検出
      if (!detailFound) {
        for (const pattern of detailPatterns.setting) {
          const match = trimmedLine.match(pattern);
          if (match) {
            currentChapter.setting = match[1].trim();
            detailFound = true;
            break;
          }
        }
      }

      // 雰囲気・ムードの検出
      if (!detailFound) {
        for (const pattern of detailPatterns.mood) {
          const match = trimmedLine.match(pattern);
          if (match) {
            currentChapter.mood = match[1].trim();
            detailFound = true;
            break;
          }
        }
      }

      // 重要な出来事の検出
      if (!detailFound) {
        for (const pattern of detailPatterns.keyEvents) {
          const match = trimmedLine.match(pattern);
          if (match) {
            const eventsText = match[1].trim();
            currentChapter.keyEvents = eventsText.split(/[,、;；]/).map(event => event.trim()).filter(event => event) as string[];
            detailFound = true;
            break;
          }
        }
      }

      // 登場キャラクターの検出（名前のまま保存）
      if (!detailFound) {
        for (const pattern of detailPatterns.characters) {
          const match = trimmedLine.match(pattern);
          if (match) {
            const charactersText = match[1].trim();
            currentChapter.characters = charactersText.split(/[,、;；]/).map(char => char.trim()).filter(char => char) as string[];
            detailFound = true;
            break;
          }
        }
      }

      // 詳細情報が見つからず、概要も空の場合は最初の説明文を概要として使用
      if (!detailFound && !currentChapter.summary &&
        !trimmedLine.startsWith('役割:') &&
        !trimmedLine.startsWith('ペース:') &&
        !trimmedLine.includes('【') &&
        !trimmedLine.includes('】') &&
        trimmedLine.length > 10) {
        currentChapter.summary = trimmedLine;
      }
    }
  }

  if (currentChapter) {
    newChapters.push(currentChapter);
  }

  return newChapters;
}
