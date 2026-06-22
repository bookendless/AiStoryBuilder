/**
 * あらすじの先回り生成（Phase D）
 *
 * SynopsisAssistantPanel の promptVariables 組み立て（project オブジェクトのみから導出）を
 * 移植し、aiService.buildPrompt('synopsis','generate', ...) を駆動する。パネル外（ヘッドレス）
 * から呼べるようにしたもの。創造ポイント付記や別案指定は先回りでは付けない（既定生成）。
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { Project } from '../../types/project';
import { PreemptiveSynopsisResult } from '../../types/preemptive';

interface Options {
  run: AIRunner;
  signal?: AbortSignal;
}

const UNSET = '未設定';

function buildCharactersInfo(characters: Project['characters']): string {
  if (!characters || characters.length === 0) {
    return 'キャラクター情報が設定されていません';
  }
  return characters
    .map(
      c =>
        `【${c.name}】\n` +
        `役割: ${c.role}\n` +
        `外見: ${c.appearance || UNSET}\n` +
        `性格: ${c.personality || UNSET}\n` +
        `背景: ${c.background || UNSET}\n`
    )
    .join('\n');
}

function buildBasicPlotInfo(plot: Project['plot']): string {
  if (!plot) return '';
  return [
    `メインテーマ: ${plot.theme || UNSET}`,
    `舞台設定: ${plot.setting || UNSET}`,
    `フック要素: ${plot.hook || UNSET}`,
    `主人公の目標: ${plot.protagonistGoal || UNSET}`,
    `主要な障害: ${plot.mainObstacle || UNSET}`,
  ].join('\n');
}

function buildDetailedStructureInfo(plot: Project['plot']): string {
  if (!plot) return '物語構造の詳細が設定されていません';

  switch (plot.structure) {
    case 'kishotenketsu':
      return [
        `【起承転結構成】`,
        `起（導入）: ${plot.ki || UNSET}`,
        `承（展開）: ${plot.sho || UNSET}`,
        `転（転換）: ${plot.ten || UNSET}`,
        `結（結末）: ${plot.ketsu || UNSET}`,
      ].join('\n');
    case 'three-act':
      return [
        `【三幕構成】`,
        `第1幕（導入）: ${plot.act1 || UNSET}`,
        `第2幕（展開）: ${plot.act2 || UNSET}`,
        `第3幕（結末）: ${plot.act3 || UNSET}`,
      ].join('\n');
    case 'four-act':
      return [
        `【四幕構成】`,
        `第1幕（秩序）: ${plot.fourAct1 || UNSET}`,
        `第2幕（混沌）: ${plot.fourAct2 || UNSET}`,
        `第3幕（秩序）: ${plot.fourAct3 || UNSET}`,
        `第4幕（混沌）: ${plot.fourAct4 || UNSET}`,
      ].join('\n');
    case 'heroes-journey':
      return [
        `【ヒーローズ・ジャーニー】`,
        `日常の世界: ${plot.hj1 || UNSET}`,
        `冒険への誘い: ${plot.hj2 || UNSET}`,
        `境界越え: ${plot.hj3 || UNSET}`,
        `試練と仲間: ${plot.hj4 || UNSET}`,
        `最大の試練: ${plot.hj5 || UNSET}`,
        `報酬: ${plot.hj6 || UNSET}`,
        `帰路: ${plot.hj7 || UNSET}`,
        `復活と帰還: ${plot.hj8 || UNSET}`,
      ].join('\n');
    case 'beat-sheet':
      return [
        `【ビートシート】`,
        `導入 (Setup): ${plot.bs1 || UNSET}`,
        `決断 (Break into Two): ${plot.bs2 || UNSET}`,
        `試練 (Fun and Games): ${plot.bs3 || UNSET}`,
        `転換点 (Midpoint): ${plot.bs4 || UNSET}`,
        `危機 (All Is Lost): ${plot.bs5 || UNSET}`,
        `クライマックス (Finale): ${plot.bs6 || UNSET}`,
        `結末 (Final Image): ${plot.bs7 || UNSET}`,
      ].join('\n');
    case 'mystery-suspense':
      return [
        `【ミステリー・サスペンス構成】`,
        `発端（事件発生）: ${plot.ms1 || UNSET}`,
        `捜査（初期）: ${plot.ms2 || UNSET}`,
        `仮説とミスリード: ${plot.ms3 || UNSET}`,
        `第二の事件/急展開: ${plot.ms4 || UNSET}`,
        `手がかりの統合: ${plot.ms5 || UNSET}`,
        `解決（真相解明）: ${plot.ms6 || UNSET}`,
        `エピローグ: ${plot.ms7 || UNSET}`,
      ].join('\n');
    default:
      return '物語構造の詳細が設定されていません';
  }
}

function buildProjectInfo(project: Project): string {
  return [
    `作品タイトル: ${project.title || '無題'}`,
    `メインジャンル: ${project.mainGenre || project.genre || UNSET}`,
    `サブジャンル: ${project.subGenre || UNSET}`,
    `ターゲット読者: ${project.targetReader || UNSET}`,
    `プロジェクトテーマ: ${project.projectTheme || UNSET}`,
    `作品説明: ${project.description || UNSET}`,
  ].join('\n');
}

export async function generatePreemptiveSynopsis(
  project: Project,
  options: Options
): Promise<PreemptiveSynopsisResult> {
  const { run, signal } = options;

  const prompt = aiService.buildPrompt('synopsis', 'generate', {
    title: project.title || '無題',
    projectInfo: buildProjectInfo(project),
    characters: buildCharactersInfo(project.characters),
    basicPlotInfo: buildBasicPlotInfo(project.plot),
    detailedStructureInfo: buildDetailedStructureInfo(project.plot),
  });

  const content = await run(prompt, { signal });
  return { kind: 'synopsis', synopsis: content.trim() };
}
