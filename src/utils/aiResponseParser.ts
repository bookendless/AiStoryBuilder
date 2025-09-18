/**
 * AI応答解析のユーティリティ関数
 * より柔軟なJSON解析とフォールバック処理を提供
 */

export interface ParsedResponse {
  success: boolean;
  data: any;
  rawContent: string;
  error?: string;
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
 * JSON形式の応答を解析
 */
const parseJsonResponse = (content: string): ParsedResponse => {
  // 複数のパターンでJSONを抽出
  const jsonPatterns = [
    /```json\s*([\s\S]*?)\s*```/g,  // ```json ... ``` ブロック
    /```\s*([\s\S]*?)\s*```/g,      // ``` ... ``` ブロック
    /\{[\s\S]*\}/g,                  // { ... } オブジェクト
    /\[[\s\S]*\]/g,                  // [ ... ] 配列
  ];

  let jsonString = '';
  
  // パターンマッチングでJSONを抽出
  for (const pattern of jsonPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // 最も長いマッチを選択
      const longestMatch = matches.reduce((a, b) => a.length > b.length ? a : b);
      jsonString = longestMatch.replace(/```json\s*|\s*```/g, '').trim();
      break;
    }
  }

  // パターンマッチングで見つからない場合は、全体をJSONとして試行
  if (!jsonString) {
    jsonString = content;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed,
      rawContent: content
    };
  } catch (error) {
    // JSON解析に失敗した場合は、テキスト解析にフォールバック
    console.warn('JSON parsing failed, falling back to text parsing:', error);
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
 * 章立て構造を解析
 */
const parseChapterStructure = (content: string): ParsedResponse => {
  const chapters: any[] = [];
  const lines = content.split('\n');
  let currentChapter: any = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 章の開始を検出
    const chapterMatch = trimmedLine.match(/第(\d+)章[：:]\s*(.+)/) || 
                       trimmedLine.match(/(\d+)\.\s*(.+)/);
    
    if (chapterMatch) {
      // 前の章を保存
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      
      // 新しい章を開始
      currentChapter = {
        id: `chapter_${chapterMatch[1]}`,
        number: parseInt(chapterMatch[1]),
        title: chapterMatch[2].trim(),
        summary: '',
        setting: '',
        mood: '',
        keyEvents: [],
        characters: []
      };
    } else if (currentChapter) {
      // 章の詳細情報を解析
      if (trimmedLine.includes('概要') || trimmedLine.includes('概要：')) {
        currentChapter.summary = trimmedLine.replace(/概要[：:]\s*/, '').trim();
      } else if (trimmedLine.includes('設定・場所') || trimmedLine.includes('設定・場所：')) {
        currentChapter.setting = trimmedLine.replace(/設定・場所[：:]\s*/, '').trim();
      } else if (trimmedLine.includes('雰囲気・ムード') || trimmedLine.includes('雰囲気・ムード：')) {
        currentChapter.mood = trimmedLine.replace(/雰囲気・ムード[：:]\s*/, '').trim();
      } else if (trimmedLine.includes('重要な出来事') || trimmedLine.includes('重要な出来事：')) {
        const eventsText = trimmedLine.replace(/重要な出来事[：:]\s*/, '').trim();
        currentChapter.keyEvents = eventsText.split(/[,、]/).map(event => event.trim()).filter(event => event);
      } else if (trimmedLine.includes('登場キャラクター') || trimmedLine.includes('登場人物')) {
        const charactersText = trimmedLine.replace(/登場(キャラクター|人物)[：:]\s*/, '').trim();
        currentChapter.characters = charactersText.split(/[,、]/).map(char => char.trim()).filter(char => char);
      } else if (!currentChapter.summary && !trimmedLine.startsWith('役割:') && !trimmedLine.startsWith('ペース:')) {
        // 最初の説明文を概要として使用
        currentChapter.summary = trimmedLine;
      }
    }
  }

  // 最後の章を保存
  if (currentChapter) {
    chapters.push(currentChapter);
  }

  return {
    success: true,
    data: {
      type: 'chapters',
      chapters: chapters,
      count: chapters.length
    },
    rawContent: content
  };
};

/**
 * キャラクター情報を解析
 */
const parseCharacterInfo = (content: string): ParsedResponse => {
  const characters: any[] = [];
  const lines = content.split('\n');
  let currentCharacter: any = null;

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
const parsePlotInfo = (content: string): ParsedResponse => {
  const plotData: any = {};
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
export const generateErrorMessage = (error: any, context: string = ''): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return `${context}${context ? ': ' : ''}${error.message}`;
  }
  
  if (error?.message) {
    return `${context}${context ? ': ' : ''}${error.message}`;
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
  if (response.data.type === 'chapters') {
    return Array.isArray(response.data.chapters) && response.data.chapters.length > 0;
  }
  
  if (response.data.type === 'characters') {
    return Array.isArray(response.data.characters) && response.data.characters.length > 0;
  }
  
  if (response.data.type === 'plot') {
    return response.data.plot && Object.keys(response.data.plot).length > 0;
  }
  
  return true;
};


