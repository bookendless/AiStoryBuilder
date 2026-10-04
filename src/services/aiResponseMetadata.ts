import type { AIResponse } from '../types/ai';

const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' ? v as Record<string, unknown> : {};
export function responseMetadata(value: unknown): Pick<AIResponse, 'finishReason' | 'rawFinishReason' | 'usage'> {
  const data = object(value);
  const choice = object(Array.isArray(data.choices) ? data.choices[0] : undefined);
  const candidate = object(Array.isArray(data.candidates) ? data.candidates[0] : undefined);
  const raw = choice.finish_reason ?? data.stop_reason ?? object(data.delta).stop_reason ?? candidate.finishReason ?? object(data.promptFeedback).blockReason ?? data.done_reason;
  const reason = typeof raw === 'string' ? raw : undefined;
  const normalized = reason?.toLowerCase();
  const finishReason = ['stop', 'end_turn', 'stop_sequence'].includes(normalized ?? '') ? 'stop'
    : ['length', 'max_tokens', 'model_context_window_exceeded'].includes(normalized ?? '') ? 'length'
      : ['content_filter', 'refusal', 'safety', 'recitation', 'blocklist', 'prohibited_content', 'spii'].includes(normalized ?? '') ? 'blocked' : 'unknown';
  const usage = object(data.usage ?? object(data.message).usage ?? data.usageMetadata);
  const input = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? data.prompt_eval_count;
  const output = usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? data.eval_count;
  const total = usage.total_tokens ?? usage.totalTokenCount;
  return {
    finishReason, rawFinishReason: reason,
    usage: typeof input === 'number' || typeof output === 'number' ? {
      promptTokens: typeof input === 'number' ? input : 0,
      completionTokens: typeof output === 'number' ? output : 0,
      totalTokens: typeof total === 'number' ? total : Number(input ?? 0) + Number(output ?? 0),
    } : undefined,
  };
}

/** An HTTP success can still contain an incomplete or refused generation. */
export function getAIResponseIssue(response: AIResponse): string | undefined {
  if (response.error) return response.error;
  if (response.finishReason === 'blocked') return 'AIが安全上の理由で応答を控えました。依頼内容を見直してください。';
  if (response.finishReason === 'length') return response.content?.trim()
    ? '最大出力トークン数に達したため、本文の生成が途中で終了しました。受信した本文を確認し、出力予算を見直してください。'
    : '本文を出力する前に最大出力トークン数に達しました（思考で使い切った可能性があります）。AI設定の出力予算を見直してください。';
  if (response.finishReason === 'unknown' && response.rawFinishReason) return `AIの生成を完了扱いにできません（終了理由: ${response.rawFinishReason}）。`;
  if (typeof response.content !== 'string' || !response.content.trim()) return 'AIから本文を受信できませんでした。出力予算またはモデルの設定を確認してください。';
  return undefined;
}

/** Handles fragmented SSE objects and Gemini's streamed JSON array without parsing partial tokens. */
export class AIStreamDecoder {
  private buffer = '';
  private depth = 0;
  private quoted = false;
  private escaped = false;
  private metadata: ReturnType<typeof responseMetadata> = { finishReason: 'unknown' };

  push(chunk: string, onText?: (text: string) => void): string[] {
    const pieces: string[] = [];
    const emit = (text: string) => { pieces.push(text); onText?.(text); };
    for (const c of chunk) {
      if (!this.depth) { if (c !== '{') continue; this.buffer = ''; }
      this.buffer += c;
      if (this.quoted) {
        if (this.escaped) this.escaped = false;
        else if (c === '\\') this.escaped = true;
        else if (c === '"') this.quoted = false;
      } else if (c === '"') this.quoted = true;
      else if (c === '{') this.depth++;
      else if (c === '}') this.depth--;
      if (!this.depth) {
        const value: unknown = JSON.parse(this.buffer);
        const data = object(value);
        if (data.error || data.type === 'error') throw new Error(typeof object(data.error).message === 'string' ? String(object(data.error).message) : 'AIのストリーミング応答でエラーが発生しました');
        const meta = responseMetadata(data);
        if (meta.rawFinishReason) {
          this.metadata.finishReason = meta.finishReason;
          this.metadata.rawFinishReason = meta.rawFinishReason;
        }
        if (meta.usage) {
          // Claude sends input usage at message_start and output usage at message_delta.
          const previous = this.metadata.usage;
          this.metadata.usage = { ...meta.usage, promptTokens: meta.usage.promptTokens || previous?.promptTokens || 0 };
          this.metadata.usage.totalTokens = Math.max(meta.usage.totalTokens, this.metadata.usage.promptTokens + this.metadata.usage.completionTokens);
        }
        const choice = object(Array.isArray(data.choices) ? data.choices[0] : undefined);
        const delta = object(choice.delta ?? data.delta);
        if (typeof delta.content === 'string') emit(delta.content);
        else if (typeof data.response === 'string') emit(data.response);
        else if (typeof data.content === 'string') emit(data.content);
        if (data.type === 'content_block_delta' && typeof delta.text === 'string') emit(delta.text);
        const candidate = object(Array.isArray(data.candidates) ? data.candidates[0] : undefined);
        const parts = object(candidate.content).parts;
        if (Array.isArray(parts)) for (const part of parts) {
          const p = object(part);
          if (typeof p.text === 'string' && p.thought !== true) emit(p.text);
        }
      }
    }
    return pieces;
  }
  finish(): ReturnType<typeof responseMetadata> {
    if (this.depth) throw new Error('AI応答の受信が途中で終了しました');
    return this.metadata;
  }
  snapshot(): ReturnType<typeof responseMetadata> { return { ...this.metadata }; }
}
