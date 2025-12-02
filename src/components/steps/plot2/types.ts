export type PlotStructureType = 'kishotenketsu' | 'three-act' | 'four-act' | 'heroes-journey' | 'beat-sheet' | 'mystery-suspense';

export type Step = 'home' | 'character' | 'plot1' | 'plot2' | 'synopsis' | 'chapter' | 'draft' | 'export';

export interface PlotStep2Props {
  onNavigateToStep?: (step: Step) => void;
}

export interface PlotFormData {
  ki: string;
  sho: string;
  ten: string;
  ketsu: string;
  act1: string;
  act2: string;
  act3: string;
  fourAct1: string;
  fourAct2: string;
  fourAct3: string;
  fourAct4: string;
  // ヒーローズ・ジャーニー
  hj1: string; // 日常の世界
  hj2: string; // 冒険への誘い
  hj3: string; // 境界越え
  hj4: string; // 試練と仲間
  hj5: string; // 最大の試練
  hj6: string; // 報酬
  hj7: string; // 帰路
  hj8: string; // 復活と帰還
  // ビートシート
  bs1: string; // 導入 (Setup)
  bs2: string; // 決断 (Break into Two)
  bs3: string; // 試練 (Fun and Games)
  bs4: string; // 転換点 (Midpoint)
  bs5: string; // 危機 (All Is Lost)
  bs6: string; // クライマックス (Finale)
  bs7: string; // 結末 (Final Image)
  // ミステリー・サスペンス
  ms1: string; // 発端（事件発生）
  ms2: string; // 捜査（初期）
  ms3: string; // 仮説とミスリード
  ms4: string; // 第二の事件/急展開
  ms5: string; // 手がかりの統合
  ms6: string; // 解決（真相解明）
  ms7: string; // エピローグ
}

export interface HistoryState {
  formData: PlotFormData;
  plotStructure: PlotStructureType;
  timestamp: number;
}

export interface ConsistencyCheck {
  hasIssues: boolean;
  issues: string[];
}

export interface SidebarSection {
  id: string;
  title: string;
  collapsed: boolean;
}

export interface StructureField {
  key: keyof PlotFormData;
  label: string;
  value: string;
}

export interface ProgressInfo {
  completed: number;
  total: number;
  percentage: number;
  fields: Array<{
    key: string;
    label: string;
    completed: boolean;
  }>;
}

export interface ProjectContext {
  title: string;
  description: string;
  genre: string;
  mainGenre: string;
  subGenre: string;
  targetReader: string;
  projectTheme: string;
  characters: Array<{
    name: string;
    role: string;
    personality: string;
    background: string;
  }>;
}

