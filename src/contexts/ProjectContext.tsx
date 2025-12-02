import React, { createContext, useContext, useState, ReactNode } from 'react';
import { databaseService } from '../services/databaseService';
import { useSafeEffect, useTimer } from '../hooks/useMemoryLeakPrevention';
import { SavedEvaluation } from '../types/evaluation';

export interface Character {
  id: string;
  name: string;
  role: string;
  appearance: string;
  personality: string;
  background: string;
  image?: string;
  speechStyle?: string; // キャラクターの口調・話し方
}

export interface GlossaryTerm {
  id: string;
  term: string;
  reading?: string;
  definition: string;
  category: 'character' | 'location' | 'concept' | 'item' | 'other';
  notes?: string;
  createdAt: Date;
}

export interface CharacterRelationship {
  id: string;
  from: string;
  to: string;
  type: 'friend' | 'enemy' | 'family' | 'romantic' | 'mentor' | 'rival' | 'other';
  strength: number;
  description?: string;
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date?: string;
  order: number;
  chapterId?: string;
  characterIds?: string[];
  category: 'plot' | 'character' | 'world' | 'other';
}

export interface WorldSetting {
  id: string;
  category: 'geography' | 'society' | 'culture' | 'technology' | 'magic' | 'history' | 'politics' | 'economy' | 'religion' | 'other';
  title: string;
  content: string; // 詳細な説明
  relatedLocations?: string[]; // 関連する場所（GlossaryTermのID）
  relatedCharacters?: string[]; // 関連するキャラクター（CharacterのID）
  relatedEvents?: string[]; // 関連するイベント（TimelineEventのID）
  tags?: string[]; // 検索・分類用のタグ
  createdAt: Date;
  updatedAt: Date;
  aiGenerated?: boolean; // AI生成かどうか
  aiPrompt?: string; // 生成に使ったプロンプト（参考用）
}

// 伏線のポイント（設置、ヒント、回収）
export interface ForeshadowingPoint {
  id: string;
  chapterId: string;           // 関連する章のID
  type: 'plant' | 'hint' | 'payoff';  // 設置/ヒント/回収
  description: string;         // 具体的な描写・内容
  lineReference?: string;      // 該当する文章の引用（任意）
  createdAt: Date;
}

// 伏線
export interface Foreshadowing {
  id: string;
  title: string;               // 伏線のタイトル（例：「主人公の過去の秘密」）
  description: string;         // 伏線の説明・意図
  importance: 'high' | 'medium' | 'low';  // 重要度
  status: 'planted' | 'hinted' | 'resolved' | 'abandoned';  // ステータス
  category: 'character' | 'plot' | 'world' | 'mystery' | 'relationship' | 'other';

  // 伏線のポイント（複数可能）
  points: ForeshadowingPoint[];

  // 関連要素
  relatedCharacterIds?: string[];   // 関連キャラクター
  relatedChapterIds?: string[];     // 関連する章（ポイント以外で関連づけたい場合）

  // 計画
  plannedPayoffChapterId?: string;  // 回収予定の章
  plannedPayoffDescription?: string; // 回収方法の計画

  // メタ情報
  tags?: string[];
  notes?: string;              // 作者メモ
  createdAt: Date;
  updatedAt: Date;
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
    ending?: string; // 物語の結末
    // PlotStep2の構成詳細
    structure?: 'kishotenketsu' | 'three-act' | 'four-act' | 'heroes-journey' | 'beat-sheet' | 'mystery-suspense';
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
    // ヒーローズ・ジャーニー
    hj1?: string; // 日常の世界
    hj2?: string; // 冒険への誘い
    hj3?: string; // 境界越え
    hj4?: string; // 試練と仲間
    hj5?: string; // 最大の試練
    hj6?: string; // 報酬
    hj7?: string; // 帰路
    hj8?: string; // 復活と帰還
    // ビートシート
    bs1?: string; // 導入 (Setup)
    bs2?: string; // 決断 (Break into Two)
    bs3?: string; // 試練 (Fun and Games)
    bs4?: string; // 転換点 (Midpoint)
    bs5?: string; // 危機 (All Is Lost)
    bs6?: string; // クライマックス (Finale)
    bs7?: string; // 結末 (Final Image)
    // ミステリー・サスペンス
    ms1?: string; // 発端（事件発生）
    ms2?: string; // 捜査（初期）
    ms3?: string; // 仮説とミスリード
    ms4?: string; // 第二の事件/急展開
    ms5?: string; // 手がかりの統合
    ms6?: string; // 解決（真相解明）
    ms7?: string; // エピローグ
  };
  evaluations?: SavedEvaluation[];
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
  lastAccessed?: Date; // 最後にアクセスした日時
  glossary?: GlossaryTerm[];
  relationships?: CharacterRelationship[];
  timeline?: TimelineEvent[];
  worldSettings?: WorldSetting[];
  foreshadowings?: Foreshadowing[];
  writingStyle?: {
    style?: string; // 基本文体（例：「現代小説風」「文語調」など）
    perspective?: string; // 人称（一人称 / 三人称 / 神の視点）
    formality?: string; // 硬軟（硬め / 柔らかめ / 口語的 / 文語的）
    rhythm?: string; // リズム（短文中心 / 長短混合 / 流れるような長文）
    metaphor?: string; // 比喩表現（多用 / 控えめ / 詩的 / 写実的）
    dialogue?: string; // 会話比率（会話多め / 描写重視 / バランス型）
    emotion?: string; // 感情描写（内面重視 / 行動で示す / 抑制的）
    tone?: string; // トーン（緊張感 / 穏やか / 希望 / 切なさ / 謎めいた）
  };
}

export interface StepProgress {
  step: string;
  completed: boolean;
}

export interface ProjectProgress {
  percentage: number;
  completedSteps: number;
  totalSteps: number;
  steps: StepProgress[];
  nextStep?: string;
}

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  updateProject: (updates: Partial<Project>, immediate?: boolean) => Promise<void>;
  createNewProject: (title: string, description: string, mainGenre?: string, subGenre?: string, coverImage?: string, targetReader?: string, projectTheme?: string, writingStyle?: Project['writingStyle']) => Project;
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

  // setCurrentProjectをラップしてlastAccessedを更新
  const setCurrentProject = (project: Project | null) => {
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
  };

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

  const createNewProject = (title: string, description: string, mainGenre?: string, subGenre?: string, coverImage?: string, targetReader?: string, projectTheme?: string, writingStyle?: Project['writingStyle']): Project => {
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
      setIsLoading(false); // 成功時にもローディング状態を解除
    } catch (error) {
      console.error('プロジェクト保存エラー:', error);
      setIsLoading(false);
      throw error; // エラーを呼び出し側に伝播
    }
  };

  const createManualBackup = async (description: string = '手動バックアップ'): Promise<void> => {
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
  };

  const loadProject = async (id: string): Promise<void> => {
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
      setIsLoading(false); // 成功時にもローディング状態を解除
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      setIsLoading(false);
      throw error; // エラーを呼び出し側に伝播
    }
  };

  const duplicateProject = async (id: string): Promise<void> => {
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

  // 特定のステップが完了しているかどうかを判定
  const getStepCompletion = (project: Project | null, step: string): boolean => {
    if (!project) return false;

    switch (step) {
      case 'character':
        return project.characters.length > 0;
      case 'plot1':
        return !!(project.plot.theme && project.plot.setting && project.plot.hook && project.plot.protagonistGoal && project.plot.mainObstacle);
      case 'plot2':
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
      case 'synopsis':
        return !!project.synopsis && project.synopsis.trim().length > 0;
      case 'chapter':
        return project.chapters.length > 0;
      case 'draft':
        return project.chapters.some(ch => ch.draft && ch.draft.trim().length > 0);
      default:
        return false;
    }
  };

  // プロジェクトの進捗を計算する関数
  const calculateProjectProgress = (project: Project | null): ProjectProgress => {
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
      calculateProjectProgress,
      getStepCompletion,
      isLoading,
      lastSaved,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};