export interface ChapterDetailsInput {
  characters?: string[];
  setting?: string;
  mood?: string;
  keyEvents?: string[];
}

export interface ChapterDetails {
  characters: string;
  setting: string;
  mood: string;
  keyEvents: string;
}

const UNSET = '未設定';

export const getChapterDetails = (
  chapter: ChapterDetailsInput | null | undefined,
  projectCharacters: Array<{ id: string; name: string }>
): ChapterDetails => {
  if (!chapter) return { characters: UNSET, setting: UNSET, mood: UNSET, keyEvents: UNSET };

  const characters =
    chapter.characters && chapter.characters.length > 0
      ? chapter.characters
          .map(charIdOrName => {
            const found = projectCharacters.find(c => c.id === charIdOrName);
            return found ? found.name : charIdOrName;
          })
          .join(', ')
      : UNSET;

  return {
    characters,
    setting: chapter.setting || UNSET,
    mood: chapter.mood || UNSET,
    keyEvents:
      chapter.keyEvents && chapter.keyEvents.length > 0
        ? chapter.keyEvents.join(', ')
        : UNSET,
  };
};
