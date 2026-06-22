/**
 * 草案の先回り生成（Phase D）
 *
 * 最初の未草案章ひとつだけを対象に、DraftAssistantPanel の buildCustomPrompt 相当を
 * project から組み立て、aiService.buildPrompt('draft','generateSingle', ...) を駆動する。
 * パネルのカスタムプロンプト/コンテキストON-OFFトグルには依存せず、既定（全コンテキスト含む）で生成。
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { Project, Character } from '../../types/project';
import { Chapter } from '../../types/project/chapter';
import { PreemptiveDraftResult } from '../../types/preemptive';
import { getChapterDetails } from '../../utils/chapterUtils';

interface Options {
  run: AIRunner;
  signal?: AbortSignal;
}

const UNSET = '未設定';

/** 最初の未草案章を返す（全章が草案済みなら null） */
export function findFirstUndraftedChapter(project: Project): Chapter | null {
  return project.chapters.find(c => !c.draft || !c.draft.trim()) ?? null;
}

function buildProjectCharacters(characters: Character[]): string {
  return characters
    .map(char => {
      let info = `${char.name}`;
      if (char.role) info += ` (${char.role})`;
      if (char.personality) info += `\n  性格: ${char.personality}`;
      if (char.background) info += `\n  背景: ${char.background}`;
      if (char.speechStyle) {
        const s = char.speechStyle.trim();
        info += `\n  口調: ${s.length > 100 ? s.substring(0, 100) + '...' : s}`;
      }
      return info;
    })
    .join('\n\n');
}

function buildPlotStructure(plot: Project['plot']): string {
  if (!plot?.structure) return UNSET;
  switch (plot.structure) {
    case 'kishotenketsu':
      return `起承転結構成\n起: ${plot.ki || UNSET}\n承: ${plot.sho || UNSET}\n転: ${plot.ten || UNSET}\n結: ${plot.ketsu || UNSET}`;
    case 'three-act':
      return `三幕構成\n第1幕: ${plot.act1 || UNSET}\n第2幕: ${plot.act2 || UNSET}\n第3幕: ${plot.act3 || UNSET}`;
    case 'four-act':
      return `四幕構成\n第1幕: ${plot.fourAct1 || UNSET}\n第2幕: ${plot.fourAct2 || UNSET}\n第3幕: ${plot.fourAct3 || UNSET}\n第4幕: ${plot.fourAct4 || UNSET}`;
    case 'heroes-journey':
      return `ヒーローズ・ジャーニー\n日常の世界: ${plot.hj1 || UNSET}\n冒険への誘い: ${plot.hj2 || UNSET}\n境界越え: ${plot.hj3 || UNSET}\n試練と仲間: ${plot.hj4 || UNSET}\n最大の試練: ${plot.hj5 || UNSET}\n報酬: ${plot.hj6 || UNSET}\n帰路: ${plot.hj7 || UNSET}\n復活と帰還: ${plot.hj8 || UNSET}`;
    case 'beat-sheet':
      return `ビートシート\n導入 (Setup): ${plot.bs1 || UNSET}\n決断 (Break into Two): ${plot.bs2 || UNSET}\n試練 (Fun and Games): ${plot.bs3 || UNSET}\n転換点 (Midpoint): ${plot.bs4 || UNSET}\n危機 (All Is Lost): ${plot.bs5 || UNSET}\nクライマックス (Finale): ${plot.bs6 || UNSET}\n結末 (Final Image): ${plot.bs7 || UNSET}`;
    case 'mystery-suspense':
      return `ミステリー・サスペンス構成\n発端（事件発生）: ${plot.ms1 || UNSET}\n捜査（初期）: ${plot.ms2 || UNSET}\n仮説とミスリード: ${plot.ms3 || UNSET}\n第二の事件/急展開: ${plot.ms4 || UNSET}\n手がかりの統合: ${plot.ms5 || UNSET}\n解決（真相解明）: ${plot.ms6 || UNSET}\nエピローグ: ${plot.ms7 || UNSET}`;
    default:
      return UNSET;
  }
}

function buildStyleDetails(project: Project): string {
  const ws = project.writingStyle || {};
  const arr: string[] = [];
  if (ws.perspective || ws.formality || ws.rhythm || ws.metaphor || ws.dialogue || ws.emotion || ws.tone) {
    arr.push('【文体の詳細指示】');
    if (ws.perspective) arr.push(`- **人称**: ${ws.perspective}`);
    if (ws.formality) arr.push(`- **硬軟**: ${ws.formality}`);
    if (ws.rhythm) arr.push(`- **リズム**: ${ws.rhythm}`);
    if (ws.metaphor) arr.push(`- **比喩表現**: ${ws.metaphor}`);
    if (ws.dialogue) arr.push(`- **会話比率**: ${ws.dialogue}`);
    if (ws.emotion) arr.push(`- **感情描写**: ${ws.emotion}`);
    if (ws.tone) arr.push(`\n【参考となるトーン】\n${ws.tone}`);
  }
  if (project.styleSample) {
    arr.push(`\n【文体見本（最重要・この文章の雰囲気・文体・語り口に合わせて執筆する）】\n---\n${project.styleSample}\n---\n※見本の内容（出来事・人物）を流用せず、文体・リズム・語彙の傾向だけを真似てください。`);
  }
  return arr.length > 0 ? arr.join('\n') + '\n' : '';
}

/** 設定資料・用語集・相関図・タイムラインを整形（全コンテキスト含む既定動作） */
function buildContextSections(project: Project): string {
  const sections: string[] = [];

  const relationships = (project.relationships || [])
    .map(r => {
      const from = project.characters.find(c => c.id === r.from)?.name || '不明';
      const to = project.characters.find(c => c.id === r.to)?.name || '不明';
      return `・${from} → ${to}: ${r.type} (${r.description || ''})`;
    })
    .join('\n');
  if (relationships) sections.push(`\n\n【キャラクター相関図】\n${relationships}`);

  const worldSettings = (project.worldSettings || [])
    .map(w => `・${w.title}: ${w.content.substring(0, 100)}...`)
    .join('\n');
  if (worldSettings) sections.push(`\n\n【設定資料・世界観】\n${worldSettings}`);

  const glossary = (project.glossary || [])
    .map(g => `・${g.term}: ${g.definition.substring(0, 100)}...`)
    .join('\n');
  if (glossary) sections.push(`\n\n【重要用語集】\n${glossary}`);

  const timeline = [...(project.timeline || [])]
    .sort((a, b) => a.order - b.order)
    .map(t => {
      let entry = `・${t.title}`;
      if (t.date) entry += ` (${t.date})`;
      if (t.description) entry += `: ${t.description.substring(0, 100)}...`;
      return entry;
    })
    .join('\n');
  if (timeline) sections.push(`\n\n【タイムライン】\n${timeline}`);

  return sections.join('');
}

export async function generatePreemptiveDraft(
  project: Project,
  options: Options
): Promise<PreemptiveDraftResult | null> {
  const { run, signal } = options;

  const target = findFirstUndraftedChapter(project);
  if (!target) return null;

  const targetIndex = project.chapters.findIndex(c => c.id === target.id);
  const chapterDetails = getChapterDetails(target, project.characters);

  // 前章までのあらすじ
  const previousStory =
    project.chapters
      .slice(0, targetIndex)
      .map((c, i) => `第${i + 1}章「${c.title}」\nあらすじ: ${c.summary || '（あらすじなし）'}`)
      .join('\n\n') || 'これが最初の章です。';

  // 直前章の末尾（接続用、末尾1000文字）
  let previousChapterEnd = '';
  if (targetIndex > 0) {
    const prev = project.chapters[targetIndex - 1];
    if (prev.draft && prev.draft.trim()) {
      const d = prev.draft.trim();
      const tail = d.length > 1000 ? '...' + d.slice(-1000) : d;
      previousChapterEnd = `\n【直前の章のラストシーン（接続用）】\n以下の文章は、直前の章の終わりの部分です。この流れを汲んで、自然に接続するように新しい章を書き始めてください。\n---\n${tail}\n---`;
    }
  }

  const ws = project.writingStyle || {};
  const prompt = aiService.buildPrompt('draft', 'generateSingle', {
    chapterTitle: target.title,
    chapterSummary: target.summary,
    characters: chapterDetails.characters,
    setting: chapterDetails.setting,
    mood: chapterDetails.mood,
    keyEvents: chapterDetails.keyEvents,
    projectTitle: project.title || UNSET,
    mainGenre: project.mainGenre || UNSET,
    subGenre: project.subGenre || UNSET,
    targetReader: project.targetReader || UNSET,
    previousStory,
    previousChapterEnd,
    projectCharacters: `${buildProjectCharacters(project.characters)}${buildContextSections(project)}`,
    plotTheme: project.plot?.theme || UNSET,
    plotSetting: project.plot?.setting || UNSET,
    plotStructure: buildPlotStructure(project.plot),
    style: ws.style || '現代小説風',
    styleDetails: buildStyleDetails(project),
    customPrompt: '',
  });

  const content = await run(prompt, { signal });
  return {
    kind: 'draft',
    chapterId: target.id,
    chapterTitle: target.title,
    draft: content,
  };
}
