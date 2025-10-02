import React, { createContext, useContext, useState, ReactNode } from 'react';
import { databaseService } from '../services/databaseService';
import { useSafeEffect, useTimer } from '../hooks/useMemoryLeakPrevention';

export interface Character {
  id: string;
  name: string;
  role: string;
  appearance: string;
  personality: string;
  background: string;
  image?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  genre?: string; // 後方互換性のため残す
  mainGenre?: string;
  subGenre?: string;
  targetReader?: string;
  projectTheme?: string;
  customMainGenre?: string;
  customSubGenre?: string;
  customTargetReader?: string;
  customTheme?: string;
  theme: string;
  imageBoard: Array<{
    id: string;
    url: string;
    title: string;
    description?: string;
    category: 'character' | 'setting' | 'mood' | 'reference' | 'other';
    addedAt: Date;
  }>;
  progress: {
    character: number;
    plot: number;
    synopsis: number;
    chapter: number;
    draft: number;
  };
  structureProgress?: {
    introduction: boolean;
    development: boolean;
    climax: boolean;
    conclusion: boolean;
  };
  characters: Character[];
  plot: {
    // PlotStep1の基本設定
    theme: string;
    setting: string;
    hook: string;
    protagonistGoal: string; // 主人公の目標
    mainObstacle: string; // 主要な障害
    // PlotStep2の構成詳細
    structure?: 'kishotenketsu' | 'three-act' | 'four-act';
    ki?: string; // 起 - 導入
    sho?: string; // 承 - 展開
    ten?: string; // 転 - 転換
    ketsu?: string; // 結 - 結末
    act1?: string; // 第1幕 - 導入
    act2?: string; // 第2幕 - 展開
    act3?: string; // 第3幕 - 結末
    fourAct1?: string; // 第1幕 - 秩序
    fourAct2?: string; // 第2幕 - 混沌
    fourAct3?: string; // 第3幕 - 秩序
    fourAct4?: string; // 第4幕 - 混沌
  };
  synopsis: string;
  chapters: Array<{
    id: string;
    title: string;
    summary: string;
    characters?: string[]; // 登場キャラクターのIDリスト
    setting?: string; // 設定・場所
    mood?: string; // 雰囲気・ムード
    keyEvents?: string[]; // 重要な出来事
    draft?: string; // 章単位の草案
  }>;
  draft: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  updateProject: (updates: Partial<Project>, immediate?: boolean) => Promise<void>;
  createNewProject: (title: string, description: string, mainGenre?: string, subGenre?: string, coverImage?: string, targetReader?: string, projectTheme?: string) => Project;
  saveProject: () => Promise<void>;
  createManualBackup: (description?: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  loadAllProjects: () => Promise<void>;
  deleteChapter: (chapterId: string) => void;
  isLoading: boolean;
  lastSaved: Date | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { setTimer } = useTimer();

  // 初期化時にプロジェクト一覧を読み込み
  useSafeEffect(() => {
    const initializeProjects = async () => {
      try {
        await loadAllProjects();
      } catch (err) {
        console.error('プロジェクト初期化エラー:', err);
        console.error('プロジェクトの読み込みに失敗しました');
        // エラーが発生してもアプリケーションは動作し続ける
      }
    };
    
    initializeProjects();
  }, []);

  // 現在のプロジェクトが変更されたら自動保存を開始
  useSafeEffect(() => {
    if (currentProject) {
      const startAutoSave = async () => {
        try {
          await databaseService.startAutoSave(currentProject, () => {
            setLastSaved(new Date());
          });
        } catch (err) {
          console.error('自動保存開始エラー:', err);
        }
      };
      startAutoSave();
    } else {
      try {
        databaseService.stopAutoSave();
      } catch (err) {
        console.error('自動保存停止エラー:', err);
      }
    }

    return () => {
      try {
        databaseService.stopAutoSave();
      } catch (err) {
        console.error('自動保存停止エラー:', err);
      }
    };
  }, [currentProject]);

  const updateProject = async (updates: Partial<Project>, immediate: boolean = false) => {
    if (!currentProject) return;
    
    const updatedProject = {
      ...currentProject,
      ...updates,
      updatedAt: new Date(),
    };
    
    setCurrentProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    
    if (immediate) {
      // 即座に保存（手動保存時など）
      try {
        await databaseService.saveProject(updatedProject);
        setLastSaved(new Date());
        console.log('プロジェクトを即座に保存しました');
      } catch (error) {
        console.error('即座保存エラー:', error);
      }
    } else {
      // デバウンス付きで保存（自動保存時）
      setTimer(() => {
        saveProject();
      }, 500);
    }
  };

  const createNewProject = (title: string, description: string, mainGenre?: string, subGenre?: string, coverImage?: string, targetReader?: string, projectTheme?: string): Project => {
    const newProject: Project = {
      id: Date.now().toString(),
      title,
      description,
      genre: mainGenre, // 後方互換性のため
      mainGenre,
      subGenre,
      coverImage,
      targetReader,
      projectTheme,
      customMainGenre: '',
      customSubGenre: '',
      customTargetReader: '',
      customTheme: '',
      theme: '',
      imageBoard: [],
      progress: {
        character: 0,
        plot: 0,
        synopsis: 0,
        chapter: 0,
        draft: 0,
      },
      characters: [],
      plot: {
        theme: '',
        setting: '',
        hook: '',
        protagonistGoal: '',
        mainObstacle: '',
        structure: 'kishotenketsu',
        ki: '',
        sho: '',
        ten: '',
        ketsu: '',
        act1: '',
        act2: '',
        act3: '',
        fourAct1: '',
        fourAct2: '',
        fourAct3: '',
        fourAct4: '',
      },
      synopsis: '',
      chapters: [],
      draft: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setProjects(prev => [...prev, newProject]);
    setCurrentProject(newProject);
    
    return newProject;
  };

  const saveProject = async (): Promise<void> => {
    if (!currentProject) return;
    
    setIsLoading(true);
    try {
      await databaseService.saveProject(currentProject);
      setLastSaved(new Date());
      
      // プロジェクト一覧も更新
      setProjects(prev => prev.map(p => 
        p.id === currentProject.id ? currentProject : p
      ));
    } catch (error) {
      console.error('プロジェクト保存エラー:', error);
      alert('プロジェクトの保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const createManualBackup = async (description: string = '手動バックアップ'): Promise<void> => {
    if (!currentProject) return;
    
    setIsLoading(true);
    try {
      await databaseService.createManualBackup(currentProject, description);
      alert('手動バックアップを作成しました');
    } catch (error) {
      console.error('手動バックアップ作成エラー:', error);
      alert('手動バックアップの作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      const project = await databaseService.loadProject(id);
      if (project) {
        // 日付フィールドの整合性を確保
        const normalizedProject = {
          ...project,
          createdAt: project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt),
          updatedAt: project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt),
          imageBoard: project.imageBoard?.map(img => ({
            ...img,
            addedAt: img.addedAt instanceof Date ? img.addedAt : new Date(img.addedAt)
          })) || []
        };
        setCurrentProject(normalizedProject);
      } else {
        alert('プロジェクトが見つかりません');
      }
    } catch (error) {
      console.error('プロジェクト読み込みエラー:', error);
      alert('プロジェクトの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    if (!confirm('このプロジェクトを削除しますか？この操作は取り消せません。')) {
      return;
    }

    setIsLoading(true);
    try {
      await databaseService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      alert('プロジェクトの削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const duplicateProject = async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      const duplicated = await databaseService.duplicateProject(id);
      if (duplicated) {
        setProjects(prev => [duplicated, ...prev]);
      }
    } catch (error) {
      console.error('プロジェクト複製エラー:', error);
      alert('プロジェクトの複製に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllProjects = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const allProjects = await databaseService.getAllProjects();
      // 日付フィールドの整合性を確保
      const normalizedProjects = allProjects.map(project => ({
        ...project,
        createdAt: project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt),
        updatedAt: project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt),
        imageBoard: project.imageBoard?.map(img => ({
          ...img,
          addedAt: img.addedAt instanceof Date ? img.addedAt : new Date(img.addedAt)
        })) || []
      }));
      setProjects(normalizedProjects);
    } catch (error) {
      console.error('プロジェクト一覧読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 章削除関数（草案データも含めて削除）
  const deleteChapter = (chapterId: string): void => {
    if (!currentProject) return;
    
    // 章を削除
    const updatedChapters = currentProject.chapters.filter(c => c.id !== chapterId);
    
    updateProject({
      chapters: updatedChapters,
    });
  };
  return (
    <ProjectContext.Provider value={{
      currentProject,
      setCurrentProject,
      projects,
      setProjects,
      updateProject,
      createNewProject,
      saveProject,
      createManualBackup,
      loadProject,
      deleteProject,
      duplicateProject,
      loadAllProjects,
      deleteChapter,
      isLoading,
      lastSaved,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};