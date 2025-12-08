/**
 * AIが生成した物語プロジェクト提案をパースするユーティリティ
 */

export interface StoryProposal {
  title: string;
  theme: string;
  mainGenre: string;
  subGenre?: string;
  targetReader?: string;
  description: string;
  synopsis: string;
  imageAnalysis?: string;
  audioAnalysis?: string;
  integratedAnalysis?: string;
  transcription?: string;
}

/**
 * AIの応答からJSONを抽出してパースする
 */
export function parseStoryProposal(response: string): StoryProposal | null {
  try {
    // JSON部分を抽出（コードブロック内にある場合に対応）
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('JSON形式が見つかりませんでした:', response);
      return null;
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr) as Partial<StoryProposal>;

    // 必須フィールドの検証
    if (!parsed.title || !parsed.theme || !parsed.mainGenre || !parsed.description || !parsed.synopsis) {
      console.warn('必須フィールドが不足しています:', parsed);
      return null;
    }

    // プロジェクト提案オブジェクトを構築
    const proposal: StoryProposal = {
      title: parsed.title.trim(),
      theme: parsed.theme.trim(),
      mainGenre: parsed.mainGenre.trim(),
      description: parsed.description.trim(),
      synopsis: parsed.synopsis.trim(),
    };

    // オプショナルフィールドを追加
    if (parsed.subGenre) {
      proposal.subGenre = parsed.subGenre.trim();
    }
    if (parsed.targetReader) {
      proposal.targetReader = parsed.targetReader.trim();
    }
    if (parsed.imageAnalysis) {
      proposal.imageAnalysis = parsed.imageAnalysis.trim();
    }
    if (parsed.audioAnalysis) {
      proposal.audioAnalysis = parsed.audioAnalysis.trim();
    }
    if (parsed.integratedAnalysis) {
      proposal.integratedAnalysis = parsed.integratedAnalysis.trim();
    }
    if (parsed.transcription) {
      proposal.transcription = parsed.transcription.trim();
    }

    return proposal;
  } catch (error) {
    console.error('プロジェクト提案のパースエラー:', error);
    console.error('応答内容:', response);
    return null;
  }
}

/**
 * プロジェクト提案のバリデーション
 */
export function validateStoryProposal(proposal: StoryProposal): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!proposal.title || proposal.title.trim().length === 0) {
    errors.push('タイトルは必須です');
  } else if (proposal.title.length > 100) {
    errors.push('タイトルは100文字以内で入力してください');
  }

  if (!proposal.theme || proposal.theme.trim().length === 0) {
    errors.push('テーマは必須です');
  }

  if (!proposal.mainGenre || proposal.mainGenre.trim().length === 0) {
    errors.push('メインジャンルは必須です');
  }

  if (!proposal.description || proposal.description.trim().length === 0) {
    errors.push('説明は必須です');
  } else if (proposal.description.length > 500) {
    errors.push('説明は500文字以内で入力してください');
  }

  if (!proposal.synopsis || proposal.synopsis.trim().length === 0) {
    errors.push('あらすじは必須です');
  } else if (proposal.synopsis.length > 2000) {
    errors.push('あらすじは2000文字以内で入力してください');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}










