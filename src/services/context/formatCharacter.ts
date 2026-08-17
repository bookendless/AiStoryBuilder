/**
 * プロンプト用キャラクター整形の単一の実装
 *
 * 以前は草案生成の経路ごとに3つの実装があり、**RAG経由のものだけが外見を含んでいた**。
 * そのため関連情報検索のON/OFFでAIに渡る人物像が変わり、同じ章を生成しても
 * 容姿描写の一貫性が変化していた。ここを唯一の正にして非対称を解消する。
 *
 * 対象は草案生成系（章全体生成・続き生成・先回り生成・RAGの強制包含）。
 * 「キャラクター情報のブレ修正」や一括生成は別のテンプレート契約（【名前】+役割 形式）を
 * 持つため、意図的にこの整形を使わない。
 */

import { Character } from '../../types/project/character';

/** 口調の切り詰め上限。長い口調設定でプロンプトが人物1人に食われるのを防ぐ */
export const SPEECH_STYLE_LIMIT = 100;

export const formatCharacter = (char: Character): string => {
    let info = char.name;
    if (char.role) info += ` (${char.role})`;
    if (char.personality) info += `\n  性格: ${char.personality}`;
    if (char.appearance) info += `\n  外見: ${char.appearance}`;
    if (char.background) info += `\n  背景: ${char.background}`;
    if (char.speechStyle) {
        const speechStyle = char.speechStyle.trim();
        info += `\n  口調: ${speechStyle.length > SPEECH_STYLE_LIMIT
            ? speechStyle.substring(0, SPEECH_STYLE_LIMIT) + '...'
            : speechStyle
            }`;
    }
    return info;
};

/** 複数キャラクターをプロンプト用の1ブロックに整形する */
export const formatCharacters = (characters: Character[]): string =>
    characters.map(formatCharacter).join('\n\n');
