import { PlotStructureType, PlotFormData, ProjectContext, StructureField } from './types';
import { CHARACTER_LIMIT, PLOT_STRUCTURE_CONFIGS } from './constants';
import type { Project } from '../../../contexts/ProjectContext';

/**
 * プロジェクト情報からコンテキストを取得
 */
export function getProjectContext(project: Project | null): ProjectContext | null {
  if (!project) return null;

  return {
    title: project.title,
    description: project.description,
    genre: project.genre || '一般小説',
    mainGenre: project.mainGenre || project.genre || '一般小説',
    subGenre: project.subGenre || '未設定',
    targetReader: project.targetReader || '全年齢',
    projectTheme: project.projectTheme || '成長・自己発見',
    characters: project.characters.map(c => ({
      name: c.name,
      role: c.role,
      personality: c.personality,
      background: c.background,
    })),
  };
}

/**
 * 構造タイプに応じたフィールド情報を取得
 */
export function getStructureFields(
  structure: PlotStructureType,
  formData: PlotFormData
): StructureField[] {
  const config = PLOT_STRUCTURE_CONFIGS[structure];
  return config.fields.map(field => ({
    key: field.key as keyof PlotFormData,
    label: field.label,
    value: formData[field.key as keyof PlotFormData],
  }));
}

/**
 * 文字数に応じた色を取得
 */
export function getCharacterCountColor(count: number, max: number): string {
  if (count > max) return 'text-red-500 dark:text-red-400';
  if (count > max * 0.9) return 'text-orange-500 dark:text-orange-400';
  if (count > max * 0.8) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-gray-500 dark:text-gray-400';
}

/**
 * 文字数に応じたプログレスバーの色を取得
 */
export function getProgressBarColor(count: number, max: number): string {
  if (count > max) return 'bg-red-500';
  if (count > max * 0.9) return 'bg-orange-500';
  if (count > max * 0.8) return 'bg-yellow-500';
  return 'bg-blue-500';
}

/**
 * 文字数が制限を超えているかチェック
 */
export function isOverLimit(
  fieldKey: keyof PlotFormData,
  formData: PlotFormData,
  limit: number = CHARACTER_LIMIT
): boolean {
  return formData[fieldKey].length > limit;
}

/**
 * 任意のフィールドが制限超過しているかチェック
 */
export function hasAnyOverLimit(
  structure: PlotStructureType,
  formData: PlotFormData,
  limit: number = CHARACTER_LIMIT
): boolean {
  const config = PLOT_STRUCTURE_CONFIGS[structure];
  return config.fields.some(field => {
    const value = formData[field.key as keyof PlotFormData];
    return value.length > limit;
  });
}

/**
 * 最終保存時刻のテキストを取得
 */
export function getLastSavedText(lastSaved: Date | null): string {
  if (!lastSaved) return '未保存';

  const now = new Date();
  const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

  if (diff < 10) return '数秒前に保存';
  if (diff < 60) return `${diff}秒前に保存`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前に保存`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前に保存`;
  return lastSaved.toLocaleDateString('ja-JP');
}

/**
 * キャラクター情報を文字列化
 */
export function formatCharactersInfo(characters: ProjectContext['characters']): string {
  if (characters.length === 0) return 'キャラクター未設定';

  return characters
    .map(c => `・${c.name} (${c.role})\n  性格: ${c.personality}\n  背景: ${c.background}`)
    .join('\n');
}

