import { PlotStructureType, SidebarSection } from './types';

export const CHARACTER_LIMIT = 500;
export const MAX_HISTORY_SIZE = 50;
export const HISTORY_SAVE_DELAY = 1000; // 1秒

export const PLOT_STRUCTURE_CONFIGS: Record<
  PlotStructureType,
  {
    label: string;
    description: string;
    fields: Array<{
      key: string;
      label: string;
      description: string;
      placeholder: string;
      color: {
        bg: string;
        border: string;
        text: string;
        icon: string;
      };
    }>;
  }
> = {
  kishotenketsu: {
    label: '起承転結',
    description: '日本伝統の4段階構成',
    fields: [
      {
        key: 'ki',
        label: '起 - 導入',
        description: '物語の始まり',
        placeholder: '登場人物の紹介、日常の描写、事件の発端...',
        color: {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: 'bg-blue-500',
        },
      },
      {
        key: 'sho',
        label: '承 - 展開',
        description: '事件の発展',
        placeholder: '問題の詳細化、新たな登場人物、状況の発展...',
        color: {
          bg: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-900 dark:text-green-100',
          icon: 'bg-green-500',
        },
      },
      {
        key: 'ten',
        label: '転 - 転換',
        description: '大きな変化',
        placeholder: '予想外の展開、大きな転換点、クライマックス...',
        color: {
          bg: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-900 dark:text-orange-100',
          icon: 'bg-orange-500',
        },
      },
      {
        key: 'ketsu',
        label: '結 - 結末',
        description: '物語の終結',
        placeholder: '問題の解決、キャラクターの成長、新たな始まり...',
        color: {
          bg: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-900 dark:text-purple-100',
          icon: 'bg-purple-500',
        },
      },
    ],
  },
  'three-act': {
    label: '三幕構成',
    description: '西洋古典の3段階構成',
    fields: [
      {
        key: 'act1',
        label: '第1幕 - 導入',
        description: '物語の始まりと設定',
        placeholder: '登場人物の紹介、世界観の設定、事件の発端...',
        color: {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: 'bg-blue-500',
        },
      },
      {
        key: 'act2',
        label: '第2幕 - 展開',
        description: '物語の核心部分',
        placeholder: '主人公の試練、対立の激化、クライマックスへの準備...',
        color: {
          bg: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-900 dark:text-green-100',
          icon: 'bg-green-500',
        },
      },
      {
        key: 'act3',
        label: '第3幕 - 結末',
        description: '物語の解決と結末',
        placeholder: 'クライマックス、問題の解決、物語の結末、キャラクターの成長...',
        color: {
          bg: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-900 dark:text-purple-100',
          icon: 'bg-purple-500',
        },
      },
    ],
  },
  'four-act': {
    label: '四幕構成',
    description: '秩序と混沌の対比を重視した現代的な4段階構成',
    fields: [
      {
        key: 'fourAct1',
        label: '第1幕 - 秩序',
        description: '日常の確立',
        placeholder: 'キャラクター紹介、世界観の設定、日常の確立...',
        color: {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: 'bg-blue-500',
        },
      },
      {
        key: 'fourAct2',
        label: '第2幕 - 混沌',
        description: '問題発生と状況悪化',
        placeholder: '問題の発生、状況の悪化、困難の増大...',
        color: {
          bg: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-900 dark:text-red-100',
          icon: 'bg-red-500',
        },
      },
      {
        key: 'fourAct3',
        label: '第3幕 - 秩序',
        description: '解決への取り組み',
        placeholder: '解決への取り組み、希望の光、状況の改善...',
        color: {
          bg: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-900 dark:text-green-100',
          icon: 'bg-green-500',
        },
      },
      {
        key: 'fourAct4',
        label: '第4幕 - 混沌',
        description: '最終的な試練と真の解決',
        placeholder: '最終的な試練、真の解決、物語の結末...',
        color: {
          bg: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-900 dark:text-purple-100',
          icon: 'bg-purple-500',
        },
      },
    ],
  },
  'heroes-journey': {
    label: 'ヒーローズ・ジャーニー',
    description: 'ジョセフ・キャンベルの単一神話論をベースにした、主人公の成長と冒険を描くための構成',
    fields: [
      {
        key: 'hj1',
        label: '日常の世界',
        description: '主人公の現状',
        placeholder: '主人公の日常、現状の描写、平穏な世界...',
        color: {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: 'bg-blue-500',
        },
      },
      {
        key: 'hj2',
        label: '冒険への誘い',
        description: '事件の始まり',
        placeholder: '事件の発端、冒険への呼びかけ、変化の兆し...',
        color: {
          bg: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-900 dark:text-green-100',
          icon: 'bg-green-500',
        },
      },
      {
        key: 'hj3',
        label: '境界越え',
        description: '非日常への旅立ち',
        placeholder: '日常から非日常への移行、新しい世界への入り口...',
        color: {
          bg: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-900 dark:text-yellow-100',
          icon: 'bg-yellow-500',
        },
      },
      {
        key: 'hj4',
        label: '試練と仲間',
        description: '敵との遭遇、協力者',
        placeholder: '最初の試練、仲間との出会い、敵との遭遇...',
        color: {
          bg: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-900 dark:text-orange-100',
          icon: 'bg-orange-500',
        },
      },
      {
        key: 'hj5',
        label: '最大の試練',
        description: '物語の底、敗北や死の危険',
        placeholder: '最大の困難、絶望の瞬間、死の淵...',
        color: {
          bg: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-900 dark:text-red-100',
          icon: 'bg-red-500',
        },
      },
      {
        key: 'hj6',
        label: '報酬',
        description: '剣（力）の獲得',
        placeholder: '勝利の報酬、新たな力の獲得、重要な発見...',
        color: {
          bg: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-900 dark:text-purple-100',
          icon: 'bg-purple-500',
        },
      },
      {
        key: 'hj7',
        label: '帰路',
        description: '追跡、脱出',
        placeholder: '追跡される帰路、最後の試練、脱出...',
        color: {
          bg: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20',
          border: 'border-indigo-200 dark:border-indigo-800',
          text: 'text-indigo-900 dark:text-indigo-100',
          icon: 'bg-indigo-500',
        },
      },
      {
        key: 'hj8',
        label: '復活と帰還',
        description: '変化した主人公の帰還',
        placeholder: '成長した主人公の帰還、新しい日常、変化の完成...',
        color: {
          bg: 'from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20',
          border: 'border-emerald-200 dark:border-emerald-800',
          text: 'text-emerald-900 dark:text-emerald-100',
          icon: 'bg-emerald-500',
        },
      },
    ],
  },
  'beat-sheet': {
    label: 'ビートシート',
    description: '商業映画脚本で多用される、ヒットの法則に基づいた構成。感情の動きとテンポを重視',
    fields: [
      {
        key: 'bs1',
        label: '導入 (Setup)',
        description: '日常、テーマの提示、きっかけ（事件発生）',
        placeholder: '日常の描写、テーマの提示、事件のきっかけ...',
        color: {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: 'bg-blue-500',
        },
      },
      {
        key: 'bs2',
        label: '決断 (Break into Two)',
        description: '葛藤の末の決断、新しい世界への旅立ち',
        placeholder: '葛藤、決断の瞬間、新しい世界への旅立ち...',
        color: {
          bg: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-900 dark:text-green-100',
          icon: 'bg-green-500',
        },
      },
      {
        key: 'bs3',
        label: '試練 (Fun and Games)',
        description: '新しい世界での試行錯誤、サブプロットの展開',
        placeholder: '新しい世界での試行錯誤、サブプロットの展開、楽しさと困難...',
        color: {
          bg: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-900 dark:text-yellow-100',
          icon: 'bg-yellow-500',
        },
      },
      {
        key: 'bs4',
        label: '転換点 (Midpoint)',
        description: '物語の中間点、状況の一変（偽の勝利または敗北）',
        placeholder: '物語の中間点、状況の一変、偽の勝利または敗北...',
        color: {
          bg: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-900 dark:text-orange-100',
          icon: 'bg-orange-500',
        },
      },
      {
        key: 'bs5',
        label: '危機 (All Is Lost)',
        description: '迫り来る敵、絶望、魂の暗夜',
        placeholder: '迫り来る敵、絶望の瞬間、魂の暗夜...',
        color: {
          bg: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-900 dark:text-red-100',
          icon: 'bg-red-500',
        },
      },
      {
        key: 'bs6',
        label: 'クライマックス (Finale)',
        description: '再起、解決への最後の戦い',
        placeholder: '再起、解決への最後の戦い、最終的な対決...',
        color: {
          bg: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-900 dark:text-purple-100',
          icon: 'bg-purple-500',
        },
      },
      {
        key: 'bs7',
        label: '結末 (Final Image)',
        description: '変化した世界、新たな日常',
        placeholder: '変化した世界、新たな日常、物語の結末...',
        color: {
          bg: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20',
          border: 'border-indigo-200 dark:border-indigo-800',
          text: 'text-indigo-900 dark:text-indigo-100',
          icon: 'bg-indigo-500',
        },
      },
    ],
  },
  'mystery-suspense': {
    label: 'ミステリー・サスペンス',
    description: '謎解きに特化した構成。情報の開示順序をコントロールする',
    fields: [
      {
        key: 'ms1',
        label: '発端（事件発生）',
        description: '不可解な事件の提示',
        placeholder: '不可解な事件の提示、謎の始まり...',
        color: {
          bg: 'from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20',
          border: 'border-slate-200 dark:border-slate-800',
          text: 'text-slate-900 dark:text-slate-100',
          icon: 'bg-slate-500',
        },
      },
      {
        key: 'ms2',
        label: '捜査（初期）',
        description: '状況確認、関係者への聴取',
        placeholder: '状況確認、関係者への聴取、初期の手がかり...',
        color: {
          bg: 'from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20',
          border: 'border-gray-200 dark:border-gray-800',
          text: 'text-gray-900 dark:text-gray-100',
          icon: 'bg-gray-500',
        },
      },
      {
        key: 'ms3',
        label: '仮説とミスリード',
        description: '誤った推理、深まる謎',
        placeholder: '誤った推理、ミスリード、謎が深まる...',
        color: {
          bg: 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-900 dark:text-amber-100',
          icon: 'bg-amber-500',
        },
      },
      {
        key: 'ms4',
        label: '第二の事件/急展開',
        description: '捜査の行き詰まりや新たな危機',
        placeholder: '捜査の行き詰まり、新たな事件、急展開...',
        color: {
          bg: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-900 dark:text-orange-100',
          icon: 'bg-orange-500',
        },
      },
      {
        key: 'ms5',
        label: '手がかりの統合',
        description: '真相への気づき',
        placeholder: '手がかりの統合、真相への気づき、重要な発見...',
        color: {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          icon: 'bg-blue-500',
        },
      },
      {
        key: 'ms6',
        label: '解決（真相解明）',
        description: '犯人の指摘、トリックの暴き',
        placeholder: '犯人の指摘、トリックの暴き、真相の解明...',
        color: {
          bg: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
          border: 'border-purple-200 dark:border-purple-800',
          text: 'text-purple-900 dark:text-purple-100',
          icon: 'bg-purple-500',
        },
      },
      {
        key: 'ms7',
        label: 'エピローグ',
        description: '事件後の余韻',
        placeholder: '事件後の余韻、影響、物語の結末...',
        color: {
          bg: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20',
          border: 'border-indigo-200 dark:border-indigo-800',
          text: 'text-indigo-900 dark:text-indigo-100',
          icon: 'bg-indigo-500',
        },
      },
    ],
  },
};

export const DEFAULT_SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 'guide', title: '構成スタイルガイド', collapsed: true },
  { id: 'settings', title: 'プロット基礎設定', collapsed: true },
  { id: 'assistant', title: 'AI提案アシスタント', collapsed: true },
  { id: 'progress', title: '完成度', collapsed: true },
  { id: 'aiLogs', title: 'AIログ', collapsed: true },
];

export const AI_LOG_TYPE_LABELS: Record<string, string> = {
  supplement: '補完',
  consistency: '一貫性チェック',
  generateStructure: '構造生成',
};

