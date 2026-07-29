import React, { createContext, useContext } from 'react';
import { Project, ProjectProgress } from '../types/project';

/**
 * ProjectContext の型定義・Contextオブジェクト・参照フック
 *
 * Provider（ProjectContext.tsx）はコンポーネント専用ファイルに保つ必要があるため、
 * 非コンポーネントのexportを本ファイルへ分離している。
 *
 * 注意: 本ファイルを vi.mock でフルモックすると Context オブジェクトも潰れ、Provider が壊れる。
 * フックのみ差し替える場合は vi.importActual で元モジュールをスプレッドして維持すること。
 */

export interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  updateProject: (updates: Partial<Project>, immediate?: boolean) => Promise<void>;
  createNewProject: (title: string, description: string, mainGenre?: string, subGenre?: string, coverImage?: string, targetReader?: string, projectTheme?: string, writingStyle?: Project['writingStyle'], synopsis?: string) => Project;
  createSequelProject: (parent: Project, overrides: Partial<Project>) => Project;
  createImportedProject: (title: string, overrides: Partial<Project>) => Project;
  /** 平行世界ラボ: 分岐点までを複製したサンドボックスプロジェクトを生成する（本編は変更しない） */
  createBranchProject: (source: Project, options: { title: string; premise: string; branchChapterId?: string }) => Project;
  saveProject: () => Promise<void>;
  createManualBackup: (description?: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  loadAllProjects: () => Promise<void>;
  deleteChapter: (chapterId: string) => void;
  calculateProjectProgress: (project: Project | null) => ProjectProgress;
  getStepCompletion: (project: Project | null, step: string) => boolean;
  /** setCurrentProjectがlastAccessedを上書きする前の最終アクセス日時を返す（リキャップの経過時間判定用） */
  getPreviousAccess: (projectId: string) => Date | undefined;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
