export interface ChapterDetailsInput {
  characters?: string[];
  setting?: string;
  mood?: string;
  keyEvents?: string[];
  knowledge?: string;
  foreshadowing?: string;
}

export interface ChapterDetails {
  characters: string;
  setting: string;
  mood: string;
  keyEvents: string;
  /**
   * 章の計画メモ（知識の変化・伏線）を見出し込みで整形したもの。空なら空文字。
   *
   * 個別のプレースホルダーではなく1つにまとめてあるのは、buildPrompt が
   * **未指定のプレースホルダーを文字列のまま残す**ため。呼び出し側が1箇所でも
   * 渡し忘れると `{chapterKnowledge}` がそのままAIに送られる。
   * 1変数・空なら消える形にして、渡し忘れの被害を空行1つに抑える。
   */
  planNotes: string;
}

const UNSET = '未設定';

export const getChapterDetails = (
  chapter: ChapterDetailsInput | null | undefined,
  projectCharacters: Array<{ id: string; name: string }>
): ChapterDetails => {
  if (!chapter) return { characters: UNSET, setting: UNSET, mood: UNSET, keyEvents: UNSET, planNotes: '' };

  const characters =
    chapter.characters && chapter.characters.length > 0
      ? chapter.characters
          .map(charIdOrName => {
            const found = projectCharacters.find(c => c.id === charIdOrName);
            return found ? found.name : charIdOrName;
          })
          .join(', ')
      : UNSET;

  // 未設定の項目は行ごと出さない。「未設定」と書くとAIがその語に反応して
  // 「まだ何も分かっていない」描写を書き足すことがあるため
  const planNotes = [
    chapter.knowledge?.trim() ? `この章での知識の変化: ${chapter.knowledge.trim()}` : '',
    chapter.foreshadowing?.trim() ? `この章で扱う伏線: ${chapter.foreshadowing.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    characters,
    setting: chapter.setting || UNSET,
    mood: chapter.mood || UNSET,
    keyEvents:
      chapter.keyEvents && chapter.keyEvents.length > 0
        ? chapter.keyEvents.join(', ')
        : UNSET,
    planNotes,
  };
};
