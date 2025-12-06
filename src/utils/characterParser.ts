/**
 * キャラクター解析ユーティリティ
 * AI応答からキャラクター情報を抽出する関数
 */

import { Character } from '../contexts/ProjectContext';
import { generateUUID } from './securityUtils';
import { TEXT_LIMITS } from '../constants/character';

/**
 * AI応答からキャラクター情報を抽出
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
  
  // 各フィールドを抽出
  const name = charContent.match(/名前:\s*([^\n]+)/)?.[1]?.trim() || `AI生成キャラクター${index}`;
  const basic = charContent.match(/基本設定:\s*([^\n]+)/)?.[1]?.trim() || '';
  const appearance = charContent.match(/外見:\s*([\s\S]*?)(?=性格:|$)/)?.[1]?.trim() || '';
  const personality = charContent.match(/性格:\s*([\s\S]*?)(?=背景:|$)/)?.[1]?.trim() || '';
  const background = charContent.match(/背景:\s*([\s\S]*?)$/)?.[1]?.trim() || '';

  return {
    id: generateUUID(),
    name,
    role: basic || '主要キャラクター',
    appearance: appearance.substring(0, TEXT_LIMITS.APPEARANCE_MAX),
    personality: personality.substring(0, TEXT_LIMITS.PERSONALITY_MAX),
    background: background.substring(0, TEXT_LIMITS.BACKGROUND_MAX),
    image: '',
  };
};

/**
 * AI応答から複数のキャラクターを抽出
 * @param content AI応答のテキスト
 * @param maxCharacters 最大抽出数（デフォルト: 5）
 * @returns 抽出されたキャラクターの配列
 */
export const extractCharactersFromContent = (
  content: string,
  maxCharacters: number = 5
): Character[] => {
  const characters: Character[] = [];
  
  for (let i = 1; i <= maxCharacters; i++) {
    const character = extractCharacterFromContent(content, i);
    if (character) {
      characters.push(character);
    }
  }
  
  return characters;
};













