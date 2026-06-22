/**
 * 章立ての先回り生成（Phase D）
 *
 * ChapterAssistantPanel の projectContext + buildAIPrompt('basic') 相当を project から組み立て、
 * aiService.buildPrompt('chapter','generateBasic', ...) を駆動する。解析は共有 parseChapterList。
 * 先回りでは構成バランス分析（structure）ではなく基本提案（basic）を使う。
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { Project } from '../../types/project';
import { Chapter } from '../../types/project/chapter';
import { PreemptiveChaptersResult } from '../../types/preemptive';
import { parseChapterList } from '../chapter/parseChapterList';

interface Options {
  run: AIRunner;
  signal?: AbortSignal;
}

const UNSET = '未設定';

/** プロット構成の詳細情報を章づくり向けに整形（ChapterAssistantPanel の buildStructureDetails 相当） */
function buildStructureDetails(plot: Project['plot']): string {
  if (!plot) return '';
  const {
    structure,
    ki, sho, ten, ketsu,
    act1, act2, act3,
    fourAct1, fourAct2, fourAct3, fourAct4,
    hj1, hj2, hj3, hj4, hj5, hj6, hj7, hj8,
    bs1, bs2, bs3, bs4, bs5, bs6, bs7,
    ms1, ms2, ms3, ms4, ms5, ms6, ms7,
  } = plot;

  const parts: string[] = [];
  if (structure === 'kishotenketsu') {
    if (ki) parts.push(`【起】導入部（1-2章程度）: ${ki}`);
    if (sho) parts.push(`【承】展開部（3-6章程度）: ${sho}`);
    if (ten) parts.push(`【転】転換部（7-8章程度）: ${ten}`);
    if (ketsu) parts.push(`【結】結末部（9-10章程度）: ${ketsu}`);
  } else if (structure === 'three-act') {
    if (act1) parts.push(`【第1幕】導入部（1-3章程度）: ${act1}`);
    if (act2) parts.push(`【第2幕】展開部（4-8章程度）: ${act2}`);
    if (act3) parts.push(`【第3幕】結末部（9-10章程度）: ${act3}`);
  } else if (structure === 'four-act') {
    if (fourAct1) parts.push(`【第1幕】秩序（1-2章程度）: ${fourAct1}`);
    if (fourAct2) parts.push(`【第2幕】混沌（3-5章程度）: ${fourAct2}`);
    if (fourAct3) parts.push(`【第3幕】秩序（6-8章程度）: ${fourAct3}`);
    if (fourAct4) parts.push(`【第4幕】混沌（9-10章程度）: ${fourAct4}`);
  } else if (structure === 'heroes-journey') {
    if (hj1) parts.push(`【日常の世界】（1章程度）: ${hj1}`);
    if (hj2) parts.push(`【冒険への誘い】（1-2章程度）: ${hj2}`);
    if (hj3) parts.push(`【境界越え】（1章程度）: ${hj3}`);
    if (hj4) parts.push(`【試練と仲間】（2-3章程度）: ${hj4}`);
    if (hj5) parts.push(`【最大の試練】（1-2章程度）: ${hj5}`);
    if (hj6) parts.push(`【報酬】（1章程度）: ${hj6}`);
    if (hj7) parts.push(`【帰路】（1-2章程度）: ${hj7}`);
    if (hj8) parts.push(`【復活と帰還】（1章程度）: ${hj8}`);
  } else if (structure === 'beat-sheet') {
    if (bs1) parts.push(`【導入 (Setup)】（1-2章程度）: ${bs1}`);
    if (bs2) parts.push(`【決断 (Break into Two)】（1章程度）: ${bs2}`);
    if (bs3) parts.push(`【試練 (Fun and Games)】（2-4章程度）: ${bs3}`);
    if (bs4) parts.push(`【転換点 (Midpoint)】（1章程度）: ${bs4}`);
    if (bs5) parts.push(`【危機 (All Is Lost)】（1-2章程度）: ${bs5}`);
    if (bs6) parts.push(`【クライマックス (Finale)】（1-2章程度）: ${bs6}`);
    if (bs7) parts.push(`【結末 (Final Image)】（1章程度）: ${bs7}`);
  } else if (structure === 'mystery-suspense') {
    if (ms1) parts.push(`【発端（事件発生）】（1章程度）: ${ms1}`);
    if (ms2) parts.push(`【捜査（初期）】（1-2章程度）: ${ms2}`);
    if (ms3) parts.push(`【仮説とミスリード】（2-3章程度）: ${ms3}`);
    if (ms4) parts.push(`【第二の事件/急展開】（1-2章程度）: ${ms4}`);
    if (ms5) parts.push(`【手がかりの統合】（1-2章程度）: ${ms5}`);
    if (ms6) parts.push(`【解決（真相解明）】（1-2章程度）: ${ms6}`);
    if (ms7) parts.push(`【エピローグ】（1章程度）: ${ms7}`);
  }
  return parts.join('\n');
}

function buildWritingStyle(project: Project): string {
  const ws = project.writingStyle;
  if (!ws) return '';
  const parts: string[] = [];
  if (ws.style || ws.customStyle) parts.push(`文体: ${ws.customStyle || ws.style}`);
  if (ws.perspective || ws.customPerspective) parts.push(`人称: ${ws.customPerspective || ws.perspective}`);
  if (ws.tone || ws.customTone) parts.push(`トーン: ${ws.customTone || ws.tone}`);
  return parts.join(', ');
}

export async function generatePreemptiveChapters(
  project: Project,
  options: Options
): Promise<PreemptiveChaptersResult> {
  const { run, signal } = options;

  const existingChapters =
    project.chapters
      .map((c, index) => {
        let info = `${index + 1}. ${c.title}: ${c.summary}`;
        if (c.setting) info += `\n   設定・場所: ${c.setting}`;
        if (c.mood) info += `\n   雰囲気・ムード: ${c.mood}`;
        if (c.keyEvents && c.keyEvents.length > 0) {
          info += `\n   重要な出来事: ${c.keyEvents.join(', ')}`;
        }
        return info;
      })
      .join('\n') || '既存の章はありません';

  const characters =
    project.characters
      .map(
        c =>
          `・${c.name} (${c.role})\n  外見: ${c.appearance}\n  性格: ${c.personality}\n  背景: ${c.background}`
      )
      .join('\n') || 'キャラクターが設定されていません';

  const prompt = aiService.buildPrompt('chapter', 'generateBasic', {
    title: project.title || '無題',
    mainGenre: project.mainGenre || UNSET,
    subGenre: project.subGenre || project.customSubGenre || UNSET,
    targetReader: project.targetReader || project.customTargetReader || UNSET,
    projectTheme: project.projectTheme || project.theme || project.customTheme || UNSET,
    writingStyle: buildWritingStyle(project) || UNSET,
    structureDetails: buildStructureDetails(project.plot) || '構成詳細が設定されていません',
    characters,
    existingChapters,
  });

  const content = await run(prompt, { signal });
  const chapters = parseChapterList(content) as Chapter[];
  return { kind: 'chapter', chapters };
}
