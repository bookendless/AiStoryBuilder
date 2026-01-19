import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { databaseService } from '../services/databaseService';
import { useSafeEffect, useTimer } from '../hooks/useMemoryLeakPrevention';
import {
  startAutoRecovery,
  stopAutoRecovery,
  setupBeforeUnloadHandler,
  saveRecoveryData,
} from '../services/crashRecoveryService';

// 型定義をtypes/からインポート
import { Step } from '../types/common';
import {
  Character,
  CharacterRelationship,
  Chapter,
  GlossaryTerm,
  TimelineEvent,
  WorldSetting,
  Foreshadowing,
  ForeshadowingPoint,
  Project,
  StepProgress,
  ProjectProgress,
} from '../types/project';

// 型を再エクスポート（後方互換性のため）
export type { Step };
export type {
  Character,
  CharacterRelationship,
  Chapter,
  GlossaryTerm,
  TimelineEvent,
  WorldSetting,
  Foreshadowing,
  ForeshadowingPoint,
  Project,
  StepProgress,
  ProjectProgress,
};

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  updateProject: (updates: Partial<Project>, immediate?: boolean) => Promise<void>;
  createNewProject: (title: string, description: string, mainGenre?: string, subGenre?: string, coverImage?: string, targetReader?: string, projectTheme?: string, writingStyle?: Project['writingStyle'], synopsis?: string) => Project;
  saveProject: () => Promise<void>;
  createManualBackup: (description?: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  loadAllProjects: () => Promise<void>;
  deleteChapter: (chapterId: string) => void;
  calculateProjectProgress: (project: Project | null) => ProjectProgress;
  getStepCompletion: (project: Project | null, step: string) => boolean;
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
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { setTimer } = useTimer();

  // setCurrentProjectをラップしてlastAccessedを更新（メモ化）
  const setCurrentProject = useCallback((project: Project | null) => {
    if (project) {
      const now = new Date();
      const updatedProject = {
        ...project,
        lastAccessed: now,
      };
      setCurrentProjectState(updatedProject);
      // プロジェクト一覧も更新
      setProjects(prev => prev.map(p =>
        p.id === updatedProject.id ? updatedProject : p
      ));
      // データベースにも保存（非同期だがエラーは無視）
      databaseService.saveProject(updatedProject).catch(err => {
        console.error('lastAccessed更新エラー:', err);
      });
    } else {
      setCurrentProjectState(null);
    }
  }, []);

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
  // useRefを使用して、コールバック関数内から最新のcurrentProjectを参照する
  const currentProjectRef = React.useRef<Project | null>(currentProject);
  React.useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useSafeEffect(() => {
    if (currentProject) {
      const initAutoSave = async () => {
        try {
          // プロジェクト取得関数を渡すことでクロージャ問題を回避
          await databaseService.startAutoSave(
            () => currentProjectRef.current,
            (success, error) => {
              if (success) {
                setLastSaved(new Date());
              } else if (error) {
                console.error('自動保存エラー:', error);
              }
            }
          );
        } catch (err) {
          console.error('自動保存開始エラー:', err);
        }
      };
      initAutoSave();

      // クラッシュリカバリー用の自動保存を開始（モバイル安定化）
      startAutoRecovery(() => currentProjectRef.current);

      // ページアンロード時のリカバリーデータ保存
      const cleanupBeforeUnload = setupBeforeUnloadHandler(() => currentProjectRef.current);

      return () => {
        try {
          databaseService.stopAutoSave();
          stopAutoRecovery();
          cleanupBeforeUnload();
        } catch (err) {
          console.error('自動保存停止エラー:', err);
        }
      };
    } else {
      try {
        databaseService.stopAutoSave();
        stopAutoRecovery();
      } catch (err) {
        console.error('自動保存停止エラー:', err);
      }
    }

    return () => {
      try {
        databaseService.stopAutoSave();
        stopAutoRecovery();
      } catch (err) {
        console.error('自動保存停止エラー:', err);
      }
    };
  }, [currentProject]);

  const updateProject = useCallback(async (updates: Partial<Project>, immediate: boolean = false) => {
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
      // updatedProjectをクロージャー内でキャプチャするため、最新の値を取得するために
      // setCurrentProjectの更新後に保存処理を実行
      setTimer(async () => {
        setIsLoading(true);
        try {
          // 最新のプロジェクト状態を取得
          const latestProject = updatedProject;
          await databaseService.saveProject(latestProject);
          setLastSaved(new Date());
          setProjects(prev => prev.map(p => p.id === latestProject.id ? latestProject : p));
          setIsLoading(false);
        } catch (error) {
          console.error('プロジェクト保存エラー:', error);
          setIsLoading(false);
        }
      }, 500);
    }
  }, [currentProject, setTimer, setCurrentProject, setLastSaved]);

  // プロジェクト更新時にクラッシュリカバリーデータも保存（モバイル安定化）
  React.useEffect(() => {
    if (currentProject) {
      saveRecoveryData(currentProject);
    }
  }, [currentProject?.updatedAt]);

  const createNewProject = useCallback((title: string, description: string, mainGenre?: string, subGenre?: string, coverImage?: string, targetReader?: string, projectTheme?: string, writingStyle?: Project['writingStyle'], synopsis?: string): Project => {
    // デバッグ: あらすじの値を確認
    console.log('createNewProject で受け取ったあらすじ:', synopsis);
    console.log('あらすじの型:', typeof synopsis);
    console.log('あらすじの長さ:', synopsis?.length || 0);

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
      synopsis: synopsis || '',
      chapters: [],
      draft: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessed: new Date(),
      glossary: [],
      relationships: [],
      timeline: [],
      writingStyle: writingStyle,
      worldSettings: [],
      foreshadowings: [],
    };

    setProjects(prev => [...prev, newProject]);
    setCurrentProject(newProject);

    // デバッグ: 作成されたプロジェクトのあらすじを確認
    console.log('作成されたプロジェクトのあらすじ:', newProject.synopsis);
    console.log('作成されたプロジェクトのあらすじの長さ:', newProject.synopsis?.length || 0);

    return newProject;
  }, [setCurrentProject]);

  const saveProject = useCallback(async (): Promise<void> => {
    if (!currentProject) return;

    setIsLoading(true);
    try {
      await databaseService.saveProject(currentProject);
      setLastSaved(new Date());

      // プロジェクト一覧も更新
      setProjects(prev => prev.map(p =>
        p.id === currentProject.id ? currentProject : p
      ));
      setIsLoading(false); // 成功時にもローディング状態を解除
    } catch (error) {
      console.error('プロジェクト保存エラー:', error);
      setIsLoading(false);
      throw error; // エラーを呼び出し側に伝播
    }
  }, [currentProject, setLastSaved]);

  const createManualBackup = useCallback(async (description: string = '手動バックアップ'): Promise<void> => {
    if (!currentProject) return;

    setIsLoading(true);
    try {
      await databaseService.createManualBackup(currentProject, description);
      setIsLoading(false);
      // 成功は呼び出し側で通知
    } catch (error) {
      console.error('手動バックアップ作成エラー:', error);
      setIsLoading(false);
      throw error; // エラーを呼び出し側に伝播
    }
  }, [currentProject]);

  const loadProject = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      const project = await databaseService.loadProject(id);
      if (project) {
        // 日付フィールドの整合性を確保
        const now = new Date();
        const normalizedProject = {
          ...project,
          createdAt: project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt),
          updatedAt: project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt),
          lastAccessed: now,
          imageBoard: project.imageBoard?.map(img => ({
            ...img,
            addedAt: img.addedAt instanceof Date ? img.addedAt : new Date(img.addedAt)
          })) || [],
          worldSettings: project.worldSettings?.map(ws => ({
            ...ws,
            createdAt: ws.createdAt instanceof Date ? ws.createdAt : new Date(ws.createdAt),
            updatedAt: ws.updatedAt instanceof Date ? ws.updatedAt : new Date(ws.updatedAt)
          })) || []
        };
        setCurrentProject(normalizedProject);
        // プロジェクト一覧のlastAccessedも更新
        setProjects(prev => prev.map(p =>
          p.id === normalizedProject.id ? normalizedProject : p
        ));
        // データベースにも保存
        await databaseService.saveProject(normalizedProject);
        setIsLoading(false); // 成功時にもローディング状態を解除
      } else {
        setIsLoading(false);
        throw new Error('プロジェクトが見つかりません');
      }
    } catch (error) {
      console.error('プロジェクト読み込みエラー:', error);
      setIsLoading(false);
      throw error; // エラーを呼び出し側に伝播
    }
  }, [setCurrentProject]);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      await databaseService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));

      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
      setIsLoading(false); // 成功時にもローディング状態を解除
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      setIsLoading(false);
      throw error; // エラーを呼び出し側に伝播
    }
  }, [currentProject, setCurrentProject]);

  const duplicateProject = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      const duplicated = await databaseService.duplicateProject(id);
      if (duplicated) {
        setProjects(prev => [duplicated, ...prev]);
      }
      setIsLoading(false); // 成功時にもローディング状態を解除
    } catch (error) {
      console.error('プロジェクト複製エラー:', error);
      setIsLoading(false);
      throw error; // エラーを呼び出し側に伝播
    }
  }, [setProjects]);

  const loadAllProjects = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const allProjects = await databaseService.getAllProjects();
      // 日付フィールドの整合性を確保
      const normalizedProjects = allProjects.map(project => ({
        ...project,
        createdAt: project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt),
        updatedAt: project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt),
        lastAccessed: project.lastAccessed instanceof Date ? project.lastAccessed : (project.lastAccessed ? new Date(project.lastAccessed) : undefined),
        imageBoard: project.imageBoard?.map(img => ({
          ...img,
          addedAt: img.addedAt instanceof Date ? img.addedAt : new Date(img.addedAt)
        })) || [],
        worldSettings: project.worldSettings?.map(ws => ({
          ...ws,
          createdAt: ws.createdAt instanceof Date ? ws.createdAt : new Date(ws.createdAt),
          updatedAt: ws.updatedAt instanceof Date ? ws.updatedAt : new Date(ws.updatedAt)
        })) || []
      }));
      setProjects(normalizedProjects);
    } catch (error) {
      console.error('プロジェクト一覧読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 章削除関数（草案データも含めて削除）
  const deleteChapter = useCallback((chapterId: string): void => {
    if (!currentProject) return;

    // 章を削除
    const updatedChapters = currentProject.chapters.filter(c => c.id !== chapterId);

    updateProject({
      chapters: updatedChapters,
    });
  }, [currentProject, updateProject]);

  // 特定のステップが完了しているかどうかを判定（メモ化）
  const getStepCompletion = useCallback((project: Project | null, step: string): boolean => {
    if (!project) return false;

    switch (step) {
      case 'character':
        return project.characters.length > 0;
      case 'plot1':
        return !!(project.plot.theme && project.plot.setting && project.plot.hook && project.plot.protagonistGoal && project.plot.mainObstacle);
      case 'plot2': {
        if (!project.plot.structure) return false;
        const structure = project.plot.structure;
        if (structure === 'kishotenketsu') {
          return !!(project.plot.ki && project.plot.sho && project.plot.ten && project.plot.ketsu &&
            project.plot.ki.trim() && project.plot.sho.trim() && project.plot.ten.trim() && project.plot.ketsu.trim());
        } else if (structure === 'three-act') {
          return !!(project.plot.act1 && project.plot.act2 && project.plot.act3 &&
            project.plot.act1.trim() && project.plot.act2.trim() && project.plot.act3.trim());
        } else if (structure === 'four-act') {
          return !!(project.plot.fourAct1 && project.plot.fourAct2 && project.plot.fourAct3 && project.plot.fourAct4 &&
            project.plot.fourAct1.trim() && project.plot.fourAct2.trim() && project.plot.fourAct3.trim() && project.plot.fourAct4.trim());
        } else if (structure === 'heroes-journey') {
          return !!(project.plot.hj1 && project.plot.hj2 && project.plot.hj3 && project.plot.hj4 && project.plot.hj5 && project.plot.hj6 && project.plot.hj7 && project.plot.hj8 &&
            project.plot.hj1.trim() && project.plot.hj2.trim() && project.plot.hj3.trim() && project.plot.hj4.trim() &&
            project.plot.hj5.trim() && project.plot.hj6.trim() && project.plot.hj7.trim() && project.plot.hj8.trim());
        } else if (structure === 'beat-sheet') {
          return !!(project.plot.bs1 && project.plot.bs2 && project.plot.bs3 && project.plot.bs4 && project.plot.bs5 && project.plot.bs6 && project.plot.bs7 &&
            project.plot.bs1.trim() && project.plot.bs2.trim() && project.plot.bs3.trim() && project.plot.bs4.trim() &&
            project.plot.bs5.trim() && project.plot.bs6.trim() && project.plot.bs7.trim());
        } else if (structure === 'mystery-suspense') {
          return !!(project.plot.ms1 && project.plot.ms2 && project.plot.ms3 && project.plot.ms4 && project.plot.ms5 && project.plot.ms6 && project.plot.ms7 &&
            project.plot.ms1.trim() && project.plot.ms2.trim() && project.plot.ms3.trim() && project.plot.ms4.trim() &&
            project.plot.ms5.trim() && project.plot.ms6.trim() && project.plot.ms7.trim());
        }
        return false;
      }
      case 'synopsis':
        return !!project.synopsis && project.synopsis.trim().length > 0;
      case 'chapter':
        return project.chapters.length > 0;
      case 'draft':
        return project.chapters.some(ch => ch.draft && ch.draft.trim().length > 0);
      default:
        return false;
    }
  }, []);

  // プロジェクトの進捗を計算する関数（メモ化）
  const calculateProjectProgress = useCallback((project: Project | null): ProjectProgress => {
    if (!project) {
      return {
        percentage: 0,
        completedSteps: 0,
        totalSteps: 6,
        steps: [],
      };
    }

    const stepDefinitions = [
      { name: 'character', label: 'キャラクター' },
      { name: 'plot1', label: 'プロット基本設定' },
      { name: 'plot2', label: 'プロット構成詳細' },
      { name: 'synopsis', label: 'あらすじ' },
      { name: 'chapter', label: '章立て' },
      { name: 'draft', label: '草案' },
    ];

    const steps: StepProgress[] = stepDefinitions.map(stepDef => ({
      step: stepDef.name,
      completed: getStepCompletion(project, stepDef.name),
    }));

    const completedSteps = steps.filter(s => s.completed).length;
    const totalSteps = steps.length;
    const percentage = (completedSteps / totalSteps) * 100;

    // 次の未完了ステップを特定
    const nextStep = steps.find(s => !s.completed);
    const nextStepName = nextStep ? stepDefinitions.find(sd => sd.name === nextStep.step)?.label : undefined;

    return {
      percentage,
      completedSteps,
      totalSteps,
      steps,
      nextStep: nextStepName,
    };
  }, [getStepCompletion]);

  // コンテキストの値をメモ化（不要な再レンダリングを防止）
  // setProjectsはReactのstate setterなので既に安定した参照を持っている
  const contextValue = useMemo(() => ({
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
    calculateProjectProgress,
    getStepCompletion,
    isLoading,
    lastSaved,
  }), [
    currentProject,
    projects,
    setCurrentProject,
    updateProject,
    createNewProject,
    saveProject,
    createManualBackup,
    loadProject,
    deleteProject,
    duplicateProject,
    loadAllProjects,
    deleteChapter,
    calculateProjectProgress,
    getStepCompletion,
    isLoading,
    lastSaved,
  ]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};