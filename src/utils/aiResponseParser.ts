/**
 * AI応答解析のユーティリティ関数
 * より柔軟なJSON解析とフォールバック処理を提供
 */

export interface ParsedResponse {
  success: boolean;
  data: unknown;
  rawContent: string;
  error?: string;
  warnings?: string[];
}

/**
 * AI応答を解析し、構造化されたデータを返す
 * @param content AIからの生の応答
 * @param expectedFormat 期待する形式（'json' | 'text' | 'auto'）
 * @returns 解析結果
 */
export const parseAIResponse = (
  content: string, 
  expectedFormat: 'json' | 'text' | 'auto' = 'auto'
): ParsedResponse => {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      data: null,
      rawContent: content || '',
      error: '無効な応答内容'
    };
  }

  const trimmedContent = content.trim();

  // 自動形式検出
  if (expectedFormat === 'auto') {
    expectedFormat = detectResponseFormat(trimmedContent);
  }

  try {
    if (expectedFormat === 'json') {
      return parseJsonResponse(trimmedContent);
    } else {
      return parseTextResponse(trimmedContent);
    }
  } catch (error) {
    console.error('AI response parsing error:', error);
    return {
      success: false,
      data: null,
      rawContent: trimmedContent,
      error: `解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
    };
  }
};

/**
 * 応答形式を自動検出
 */
const detectResponseFormat = (content: string): 'json' | 'text' => {
  // JSONの可能性が高いパターンをチェック
  const jsonIndicators = [
    /^\s*\{[\s\S]*\}\s*$/,  // 完全なJSONオブジェクト
    /^\s*\[[\s\S]*\]\s*$/,  // 完全なJSON配列
    /"[\w\s]+"\s*:\s*/,     // キー:値のペア
    /^\s*\{[\s\S]*\}\s*$/m, // 複数行のJSON
  ];

  const hasJsonIndicators = jsonIndicators.some(pattern => pattern.test(content));
  
  // 文字数が少なく、JSONの構造が明確な場合はJSONとして扱う
  if (hasJsonIndicators && content.length < 10000) {
    return 'json';
  }

  return 'text';
};

/**
 * JSON形式の応答を解析（強化版）
 */
const parseJsonResponse = (content: string): ParsedResponse => {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      data: null,
      rawContent: content || '',
      error: '無効な応答内容'
    };
  }

  const trimmedContent = content.trim();
  
  // 複数のパターンでJSONを抽出（優先順位順）
  const extractionPatterns = [
    // 1. コードブロック内のJSON（json指定あり）
    {
      pattern: /```json\s*([\s\S]*?)\s*```/,
      description: 'jsonコードブロック'
    },
    // 2. コードブロック内のJSON（json指定なし）
    {
      pattern: /```\s*([\s\S]*?)\s*```/,
      description: 'コードブロック'
    },
    // 3. 波括弧で囲まれたJSONオブジェクト（最も長いものを選択）
    {
      pattern: /\{[\s\S]*\}/,
      description: 'JSONオブジェクト',
      extractLongest: true
    },
    // 4. 角括弧で囲まれたJSON配列
    {
      pattern: /\[[\s\S]*\]/,
      description: 'JSON配列',
      extractLongest: true
    }
  ];

  let jsonString = '';
  let extractionMethod = '';

  // パターンマッチングでJSONを抽出
  for (const { pattern, description, extractLongest } of extractionPatterns) {
    const matches = trimmedContent.match(pattern);
    if (matches && matches.length > 0) {
      if (extractLongest) {
        // 最も長いマッチを選択
        const longestMatch = matches.reduce((a, b) => a.length > b.length ? a : b);
        jsonString = longestMatch.trim();
      } else {
        // 最初のマッチを使用
        jsonString = matches[1] ? matches[1].trim() : matches[0].trim();
      }
      extractionMethod = description;
      break;
    }
  }

  // パターンマッチングで見つからない場合は、全体をJSONとして試行
  if (!jsonString) {
    jsonString = trimmedContent;
    extractionMethod = '全体';
  }

  // JSON文字列のクリーニング
  jsonString = jsonString
    .replace(/```json\s*|\s*```/g, '') // コードブロックマーカーを除去
    .replace(/^[\s\n\r]*/, '') // 先頭の空白・改行を除去
    .replace(/[\s\n\r]*$/, ''); // 末尾の空白・改行を除去
  
  // {{ と }} で囲まれたJSONを正しく処理するため、外側の波括弧を1つ削除
  if (jsonString.startsWith('{{') && jsonString.endsWith('}}')) {
    jsonString = jsonString.slice(1, -1);
  }

  // 空の場合は失敗
  if (!jsonString) {
    return {
      success: false,
      data: null,
      rawContent: content,
      error: 'JSON文字列が抽出できませんでした'
    };
  }

  // JSON解析を試行
  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed,
      rawContent: content
    };
  } catch (error) {
    // JSON解析に失敗した場合、より詳細なエラー情報を記録
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`JSON parsing failed (${extractionMethod}), falling back to text parsing:`, errorMessage);
    console.debug('Attempted JSON string (first 200 chars):', jsonString.substring(0, 200));
    
    // テキスト解析にフォールバック
    return parseTextResponse(content);
  }
};

/**
 * テキスト形式の応答を解析
 */
const parseTextResponse = (content: string): ParsedResponse => {
  // テキストから構造化データを抽出
  const lines = content.split('\n').filter(line => line.trim());
  
  // 章立ての解析
  if (content.includes('第') && content.includes('章')) {
    return parseChapterStructure(content);
  }
  
  // キャラクター情報の解析
  if (content.includes('キャラクター') || content.includes('登場人物')) {
    return parseCharacterInfo(content);
  }
  
  // プロット情報の解析
  if (content.includes('プロット') || content.includes('構成')) {
    return parsePlotInfo(content);
  }
  
  // デフォルトのテキスト解析
  return {
    success: true,
    data: {
      type: 'text',
      content: content,
      lines: lines,
      wordCount: content.length,
      lineCount: lines.length
    },
    rawContent: content
  };
};

/**
 * 章立て構造を解析（強化版）
 */
interface Chapter {
  id: string;
  number: number;
  title: string;
  summary: string;
  setting: string;
  mood: string;
  keyEvents: string[];
  characters: string[];
}

const parseChapterStructure = (content: string): ParsedResponse => {
  const chapters: Chapter[] = [];
  const lines = content.split('\n');
  let currentChapter: Chapter | null = null;
  const warnings: string[] = [];

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
    summary: [
      /概要[：:]\s*(.+)/,
      /あらすじ[：:]\s*(.+)/,
      /内容[：:]\s*(.+)/,
      /要約[：:]\s*(.+)/
    ],
    setting: [
      /設定[・・]場所[：:]\s*(.+)/,
      /舞台[：:]\s*(.+)/,
      /場所[：:]\s*(.+)/,
      /設定[：:]\s*(.+)/
    ],
    mood: [
      /雰囲気[・・]ムード[：:]\s*(.+)/,
      /ムード[：:]\s*(.+)/,
      /雰囲気[：:]\s*(.+)/,
      /トーン[：:]\s*(.+)/
    ],
    keyEvents: [
      /重要な出来事[：:]\s*(.+)/,
      /キーイベント[：:]\s*(.+)/,
      /出来事[：:]\s*(.+)/,
      /イベント[：:]\s*(.+)/
    ],
    characters: [
      /登場キャラクター[：:]\s*(.+)/,
      /登場人物[：:]\s*(.+)/,
      /キャラクター[：:]\s*(.+)/,
      /人物[：:]\s*(.+)/
    ]
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 章の開始を検出（複数パターンを試行）
    let chapterMatch: RegExpMatchArray | null = null;
    let chapterNumber = 0;
    let chapterTitle = '';

    for (const pattern of chapterPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        chapterMatch = match;
        chapterNumber = parseInt(match[1]);
        chapterTitle = match[2].trim();
        break;
      }
    }
    
    if (chapterMatch) {
      // 前の章を保存
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      
      // 新しい章を開始
      currentChapter = {
        id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        number: chapterNumber,
        title: chapterTitle,
        summary: '',
        setting: '',
        mood: '',
        keyEvents: [],
        characters: []
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
            currentChapter.keyEvents = eventsText.split(/[,、;；]/).map(event => event.trim()).filter(event => event);
            detailFound = true;
            break;
          }
        }
      }

      // 登場キャラクターの検出
      if (!detailFound) {
        for (const pattern of detailPatterns.characters) {
          const match = trimmedLine.match(pattern);
          if (match) {
            const charactersText = match[1].trim();
            currentChapter.characters = charactersText.split(/[,、;；]/).map(char => char.trim()).filter(char => char);
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

  // 最後の章を保存
  if (currentChapter) {
    chapters.push(currentChapter);
  }

  // 解析結果の検証と警告生成
  const incompleteChapters = chapters.filter(ch => 
    !ch.summary || !ch.setting || !ch.mood || ch.keyEvents.length === 0 || ch.characters.length === 0
  );

  if (incompleteChapters.length > 0) {
    warnings.push(`${incompleteChapters.length}章で情報が不完全です。手動で編集することをお勧めします。`);
  }

  if (chapters.length === 0) {
    return {
      success: false,
      data: null,
      rawContent: content,
      error: '章立ての解析に失敗しました。AI応答の形式を確認してください。',
      warnings: ['章の開始パターンが見つかりませんでした。']
    };
  }

  return {
    success: true,
    data: {
      type: 'chapters',
      chapters: chapters,
      count: chapters.length,
      warnings: warnings
    },
    rawContent: content
  };
};

/**
 * キャラクター情報を解析
 */
interface Character {
  id: string;
  name: string;
  role: string;
  appearance: string;
  personality: string;
  background: string;
}

const parseCharacterInfo = (content: string): ParsedResponse => {
  const characters: Character[] = [];
  const lines = content.split('\n');
  let currentCharacter: Character | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // キャラクター名の検出
    if (trimmedLine.match(/^【(.+)】/) || trimmedLine.match(/^・(.+)\s*\(/)) {
      if (currentCharacter) {
        characters.push(currentCharacter);
      }
      
      const nameMatch = trimmedLine.match(/^【(.+)】/) || trimmedLine.match(/^・(.+)\s*\(/);
      currentCharacter = {
        id: `char_${Date.now()}_${Math.random()}`,
        name: nameMatch ? nameMatch[1].trim() : trimmedLine,
        role: '',
        appearance: '',
        personality: '',
        background: ''
      };
    } else if (currentCharacter) {
      // キャラクターの詳細情報を解析
      if (trimmedLine.includes('役割') || trimmedLine.includes('役割：')) {
        currentCharacter.role = trimmedLine.replace(/役割[：:]\s*/, '').trim();
      } else if (trimmedLine.includes('外見') || trimmedLine.includes('外見：')) {
        currentCharacter.appearance = trimmedLine.replace(/外見[：:]\s*/, '').trim();
      } else if (trimmedLine.includes('性格') || trimmedLine.includes('性格：')) {
        currentCharacter.personality = trimmedLine.replace(/性格[：:]\s*/, '').trim();
      } else if (trimmedLine.includes('背景') || trimmedLine.includes('背景：')) {
        currentCharacter.background = trimmedLine.replace(/背景[：:]\s*/, '').trim();
      }
    }
  }

  // 最後のキャラクターを保存
  if (currentCharacter) {
    characters.push(currentCharacter);
  }

  return {
    success: true,
    data: {
      type: 'characters',
      characters: characters,
      count: characters.length
    },
    rawContent: content
  };
};

/**
 * プロット情報を解析
 */
interface PlotData {
  theme?: string;
  setting?: string;
  hook?: string;
  protagonistGoal?: string;
  mainObstacle?: string;
}

const parsePlotInfo = (content: string): ParsedResponse => {
  const plotData: PlotData = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.includes('テーマ') || trimmedLine.includes('テーマ：')) {
      plotData.theme = trimmedLine.replace(/テーマ[：:]\s*/, '').trim();
    } else if (trimmedLine.includes('舞台') || trimmedLine.includes('舞台：')) {
      plotData.setting = trimmedLine.replace(/舞台[：:]\s*/, '').trim();
    } else if (trimmedLine.includes('フック') || trimmedLine.includes('フック：')) {
      plotData.hook = trimmedLine.replace(/フック[：:]\s*/, '').trim();
    } else if (trimmedLine.includes('主人公の目標') || trimmedLine.includes('主人公の目標：')) {
      plotData.protagonistGoal = trimmedLine.replace(/主人公の目標[：:]\s*/, '').trim();
    } else if (trimmedLine.includes('主要な障害') || trimmedLine.includes('主要な障害：')) {
      plotData.mainObstacle = trimmedLine.replace(/主要な障害[：:]\s*/, '').trim();
    }
  }

  return {
    success: true,
    data: {
      type: 'plot',
      plot: plotData
    },
    rawContent: content
  };
};

/**
 * エラーメッセージを生成
 */
export const generateErrorMessage = (error: unknown, context: string = ''): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return `${context}${context ? ': ' : ''}${error.message}`;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return `${context}${context ? ': ' : ''}${(error as Error).message}`;
  }
  
  return `${context}${context ? ': ' : ''}不明なエラーが発生しました`;
};

/**
 * 応答内容を検証
 */
export const validateResponse = (response: ParsedResponse): boolean => {
  if (!response.success) {
    return false;
  }
  
  if (!response.data) {
    return false;
  }
  
  // データの型に応じた検証
  const data = response.data as Record<string, unknown>;
  
  if (data.type === 'chapters') {
    return Array.isArray(data.chapters) && data.chapters.length > 0;
  }
  
  if (data.type === 'characters') {
    return Array.isArray(data.characters) && data.characters.length > 0;
  }
  
  if (data.type === 'plot') {
    return !!(data.plot && typeof data.plot === 'object' && data.plot !== null && Object.keys(data.plot as Record<string, unknown>).length > 0);
  }
  
  return true;
};


