/**
 * モデルごとのAPIパラメータ対応状況の判定。
 *
 * 接続テスト（AISettings）と実際の生成（aiService）で判定がずれると、
 * 「テストは通るのに生成で400」あるいはその逆が起きるため、ここに集約する。
 */

/**
 * OpenAI のリーズニング系モデル（GPT-5系 / o1・o3・o4系）か判定する。
 *
 * これらのモデルは max_tokens ではなく max_completion_tokens を使う。
 * また temperature の変更を受け付けない（OpenAI公式ドキュメント:
 * "temperature changes are not supported for reasoning models"）。
 */
export const isOpenAIReasoningModel = (model: string): boolean => {
  if (!model) return false;
  if (model.startsWith('gpt-5')) return true;
  return model.startsWith('o1-') || model.startsWith('o3') || model.startsWith('o4');
};

/**
 * モデルが temperature パラメータを受け付けるか判定する。
 * 非対応モデルに temperature を送ると 400 になるため、リクエストボディから省略する。
 *
 * - Claude: opus 4.7 / 4.8 / 4.9 系、opus-5 / sonnet-5 / fable-5 / mythos-5 系
 * - OpenAI: GPT-5 系および o1 / o3 / o4 系（リーズニングモデル）
 */
export const modelSupportsTemperature = (model: string): boolean => {
  if (!model) return true;
  if (/opus-4-[789]|opus-5|sonnet-5|fable-5|mythos-5/.test(model)) return false;
  if (isOpenAIReasoningModel(model)) return false;
  return true;
};
