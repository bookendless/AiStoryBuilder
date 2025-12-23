/**
 * キャラクター解析ユーティリティ
 * AI応答からキャラクター情報を抽出する関数
 * JSON形式とテキスト形式の両方に対応
 */

import { Character } from '../contexts/ProjectContext';
import { generateUUID } from './securityUtils';
import { TEXT_LIMITS } from '../constants/character';
import { parseAIResponse } from './aiResponseParser';

/**
 * 解析結果のインターフェース
 */
export interface ParseResult {
  characters: Character[];
  parseMethod: 'json' | 'text' | 'fallback';
  errors: string[];
  warnings: string[];
}

/**
 * JSON形式からキャラクターを抽出
 */
const parseJsonCharacters = (content: string): ParseResult => {
  const result: ParseResult = {
    characters: [],
    parseMethod: 'json',
    errors: [],
    warnings: [],
  };

  try {
    // JSON文字列を抽出（コードブロック内のJSONも対応）
    let jsonString = content.trim();
    
    // コードブロック内のJSONを抽出
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    // 波括弧で囲まれたJSONオブジェクトを抽出
    const objectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonString = objectMatch[0];
    }

    // 角括弧で囲まれたJSON配列を抽出
    const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonString = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonString);
    
    // 配列形式: [{name: "...", role: "...", ...}, ...]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let characterArray: any[] = [];
    if (Array.isArray(parsed)) {
      characterArray = parsed;
    } else if (parsed.characters && Array.isArray(parsed.characters)) {
      characterArray = parsed.characters;
    } else if (parsed.data && Array.isArray(parsed.data)) {
      characterArray = parsed.data;
    } else {
      result.errors.push('JSON形式が認識できませんでした。配列またはcharacters/dataプロパティが必要です。');
      return result;
    }

    // 各キャラクターを変換
    for (const char of characterArray) {
      if (!char || typeof char !== 'object') continue;

      const character: Character = {
        id: generateUUID(),
        name: char.name || char.名前 || `AI生成キャラクター${result.characters.length + 1}`,
        role: char.role || char.役割 || char.基本設定 || char.basic || '主要キャラクター',
        appearance: (char.appearance || char.外見 || '').substring(0, TEXT_LIMITS.APPEARANCE_MAX),
        personality: (char.personality || char.性格 || '').substring(0, TEXT_LIMITS.PERSONALITY_MAX),
        background: (char.background || char.背景 || '').substring(0, TEXT_LIMITS.BACKGROUND_MAX),
        image: '',
      };

      // 必須フィールドのチェック
      if (!character.name || character.name === `AI生成キャラクター${result.characters.length + 1}`) {
        result.warnings.push(`キャラクター${result.characters.length + 1}の名前が取得できませんでした`);
      }

      result.characters.push(character);
    }

    if (result.characters.length === 0) {
      result.errors.push('JSONからキャラクターを抽出できませんでした');
    }

  } catch (error) {
    result.errors.push(`JSON解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }

  return result;
};

/**
 * テキスト形式からキャラクターを抽出（複数パターン対応）
 */
const parseTextCharacters = (content: string, maxCharacters: number = 5): ParseResult => {
  const result: ParseResult = {
    characters: [],
    parseMethod: 'text',
    errors: [],
    warnings: [],
  };

  // 複数のキャラクター開始パターン
  const characterStartPatterns = [
    /【キャラクター(\d+)】/g,           // 【キャラクター1】
    /キャラクター(\d+)[：:]/g,          // キャラクター1:
    /^(\d+)\.\s*キャラクター/gm,        // 1. キャラクター
    /^(\d+)\.\s*【/gm,                  // 1. 【
    /^##\s*キャラクター\s*(\d+)/gim,    // ## キャラクター 1
    /^###\s*キャラクター\s*(\d+)/gim,   // ### キャラクター 1
  ];

  // キャラクターセクションを分割
  const sections: Array<{ index: number; content: string }> = [];
  
  for (const pattern of characterStartPatterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const startPos = match.index || 0;
        const nextMatch = matches[i + 1];
        const endPos = nextMatch ? (nextMatch.index || content.length) : content.length;
        const sectionContent = content.substring(startPos, endPos);
        const index = parseInt(match[1] || '1');
        
        sections.push({ index, content: sectionContent });
      }
      break; // 最初にマッチしたパターンを使用
    }
  }

  // パターンマッチが見つからない場合、改行で分割して試行
  if (sections.length === 0) {
    const lines = content.split('\n');
    let currentSection: string[] = [];
    let currentIndex = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      // 新しいキャラクターの開始を検出
      if (trimmed.match(/^(名前|name)[：:]/i) && currentSection.length > 0) {
        sections.push({ index: currentIndex, content: currentSection.join('\n') });
        currentSection = [];
        currentIndex++;
      }
      currentSection.push(line);
    }
    if (currentSection.length > 0) {
      sections.push({ index: currentIndex, content: currentSection.join('\n') });
    }
  }

  // 各セクションからキャラクター情報を抽出
  for (const section of sections.slice(0, maxCharacters)) {
    const char = extractCharacterFromText(section.content, section.index);
    if (char) {
      result.characters.push(char);
    } else {
      result.warnings.push(`キャラクター${section.index}の解析に失敗しました`);
    }
  }

  if (result.characters.length === 0) {
    result.errors.push('テキスト形式からキャラクターを抽出できませんでした');
  }

  return result;
};

/**
 * テキストセクションから単一のキャラクター情報を抽出
 */
const extractCharacterFromText = (content: string, index: number): Character | null => {
  // 名前の抽出（複数パターン）
  const namePatterns = [
    /名前[：:]\s*([^\n]+)/,
    /^名前[：:]\s*([^\n]+)/m,
    /name[：:]\s*([^\n]+)/i,
    /^【([^】]+)】/,
  ];

  let name = '';
  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      name = match[1].trim();
      break;
    }
  }

  if (!name) {
    name = `AI生成キャラクター${index}`;
  }

  // 基本設定/役割の抽出（複数パターン）
  const rolePatterns = [
    /基本設定[：:]\s*([^\n]+)/,
    /役割[：:]\s*([^\n]+)/,
    /ロール[：:]\s*([^\n]+)/i,
    /role[：:]\s*([^\n]+)/i,
  ];

  let role = '';
  for (const pattern of rolePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      role = match[1].trim();
      break;
    }
  }

  // 外見の抽出（複数行対応）
  const appearancePatterns = [
    /外見[：:]\s*([\s\S]*?)(?=性格[：:]|背景[：:]|$)/,
    /appearance[：:]\s*([\s\S]*?)(?=personality[：:]|background[：:]|$)/i,
  ];

  let appearance = '';
  for (const pattern of appearancePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      appearance = match[1].trim();
      break;
    }
  }

  // 性格の抽出（複数行対応）
  const personalityPatterns = [
    /性格[：:]\s*([\s\S]*?)(?=背景[：:]|$)/,
    /personality[：:]\s*([\s\S]*?)(?=background[：:]|$)/i,
  ];

  let personality = '';
  for (const pattern of personalityPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      personality = match[1].trim();
      break;
    }
  }

  // 背景の抽出（複数行対応）
  const backgroundPatterns = [
    /背景[：:]\s*([\s\S]*?)$/,
    /background[：:]\s*([\s\S]*?)$/i,
  ];

  let background = '';
  for (const pattern of backgroundPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      background = match[1].trim();
      break;
    }
  }

  // 最低限の情報があればキャラクターとして認識
  if (!name || name === `AI生成キャラクター${index}`) {
    return null;
  }

  return {
    id: generateUUID(),
    name,
    role: role || '主要キャラクター',
    appearance: appearance.substring(0, TEXT_LIMITS.APPEARANCE_MAX),
    personality: personality.substring(0, TEXT_LIMITS.PERSONALITY_MAX),
    background: background.substring(0, TEXT_LIMITS.BACKGROUND_MAX),
    image: '',
  };
};

/**
 * AI応答からキャラクター情報を抽出（旧形式との互換性のため保持）
 * @param content AI応答のテキスト
 * @param index キャラクターのインデックス（1-5）
 * @returns 抽出されたキャラクター情報、またはnull
 */
export const extractCharacterFromContent = (
  content: string,
  index: number
): Character | null => {
  // キャラクターセクションを抽出
  const nextIndex = index + 1;
  const pattern = index === 5
    ? new RegExp(`【キャラクター${index}】\\s*([\\s\\S]*?)$`)
    : new RegExp(`【キャラクター${index}】\\s*([\\s\\S]*?)(?=【キャラクター${nextIndex}】|$)`);
  
  const match = content.match(pattern);
  if (!match) {
    return null;
  }

  const charContent = match[1];
  return extractCharacterFromText(charContent, index);
};

/**
 * AI応答から複数のキャラクターを抽出（改善版）
 * JSON形式とテキスト形式の両方に対応し、フォールバック処理を含む
 * @param content AI応答のテキスト
 * @param maxCharacters 最大抽出数（デフォルト: 5）
 * @param preferredFormat 優先形式（'json' | 'text' | 'auto'）
 * @returns 解析結果
 */
export const extractCharactersFromContent = (
  content: string,
  maxCharacters: number = 5,
  preferredFormat: 'json' | 'text' | 'auto' = 'auto'
): ParseResult => {
  if (!content || typeof content !== 'string') {
    return {
      characters: [],
      parseMethod: 'text',
      errors: ['無効な応答内容'],
      warnings: [],
    };
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return {
      characters: [],
      parseMethod: 'text',
      errors: ['応答内容が空です'],
      warnings: [],
    };
  }

  // 形式の自動検出
  const format: 'json' | 'text' = preferredFormat === 'auto' 
    ? (trimmedContent.match(/^\s*[\[\{]/) ? 'json' : 'text')
    : preferredFormat;

  // JSON形式を試行
  if (format === 'json' || preferredFormat === 'auto') {
    const jsonResult = parseJsonCharacters(trimmedContent);
    if (jsonResult.characters.length > 0) {
      return jsonResult;
    }
    // JSON形式が失敗した場合、テキスト形式にフォールバック
    if (format === 'json') {
      const textResult = parseTextCharacters(trimmedContent, maxCharacters);
      textResult.parseMethod = 'fallback';
      textResult.errors.unshift('JSON形式の解析に失敗したため、テキスト形式で再試行しました');
      return textResult;
    }
  }

  // テキスト形式を試行
  const textResult = parseTextCharacters(trimmedContent, maxCharacters);
  
  // テキスト形式でも失敗した場合、aiResponseParserのparseCharacterInfoをフォールバックとして試行
  if (textResult.characters.length === 0 && textResult.errors.length > 0) {
    try {
              const fallbackResult = parseAIResponse(trimmedContent, 'text');
        if (fallbackResult.success && fallbackResult.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = fallbackResult.data as any;
        if (data.type === 'characters' && Array.isArray(data.characters)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fallbackCharacters: Character[] = data.characters.map((char: any) => ({
            id: generateUUID(),
            name: char.name || `AI生成キャラクター${textResult.characters.length + 1}`,
            role: char.role || '主要キャラクター',
            appearance: (char.appearance || '').substring(0, TEXT_LIMITS.APPEARANCE_MAX),
            personality: (char.personality || '').substring(0, TEXT_LIMITS.PERSONALITY_MAX),
            background: (char.background || '').substring(0, TEXT_LIMITS.BACKGROUND_MAX),
            image: '',
          })).filter((char: Character) => char.name && char.name !== `AI生成キャラクター${textResult.characters.length + 1}`);
          
          if (fallbackCharacters.length > 0) {
            return {
              characters: fallbackCharacters,
              parseMethod: 'fallback',
              errors: [],
              warnings: ['aiResponseParserのフォールバック解析を使用しました'],
            };
          }
        }
      }
    } catch (error) {
      // フォールバックも失敗した場合は、元のエラーを返す
      textResult.errors.push(`フォールバック解析も失敗: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }
  
  return textResult;
};
