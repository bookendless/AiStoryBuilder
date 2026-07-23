/**
 * チャットアシスタント関連プロンプト
 */

import { dataBlock } from './common';

/**
 * チャットアシスタントプロンプトのサニタイズ上限（文字数）。
 * プロジェクト文脈＋会話履歴が無制限で挿入され、ユーザーの質問文が最末尾に置かれるため、
 * 既定の10000文字では質問自体が黙って切り詰められる。maxPromptLength に渡して引き上げる。
 */
export const CHAT_PROMPT_CAP = 24000;

/** チャットアシスタントの拡張システムプロンプトを構築 */
export function buildChatAssistantSystemPrompt(
  projectContext: string | null | undefined,
  conversationHistory: string
): string {
  let systemPrompt = `あなたは小説創作を支援するAIアシスタントです。ユーザーの質問に親切に答えてください。

【利用可能な機能】
1. 用語集の参照: 「用語集から『魔王』の説明を教えて」など
2. タイムラインの参照: 「タイムラインを教えて」「イベント一覧を表示して」など
3. 相関図の参照: 「相関図で『主人公』の関係性を教えて」など
4. プロジェクト分析: 「プロジェクトの整合性をチェックして」「ストーリーの構造を分析して」など
5. 創作支援: プロット、キャラクター、ストーリー展開などのアドバイス

【回答の指針】
- 用語集・タイムライン・相関図の情報は下記のプロジェクト情報に含まれているので、ユーザーが特定の情報を求めた場合はそこから探して提供する
- 創作に関する質問には、プロジェクトの設定や世界観を考慮して回答する`;

  if (projectContext) {
    systemPrompt += `\n\n${dataBlock('現在のプロジェクト情報', projectContext)}`;
  }
  if (conversationHistory) {
    systemPrompt += `\n\n${dataBlock('会話履歴', conversationHistory)}`;
  }

  return systemPrompt;
}
