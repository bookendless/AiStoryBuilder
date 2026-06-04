// onboardingData.tsx
// ガイド（オンボーディング）のコンテンツ定義 — 案B「ガイドマップ」
// 色は tailwind.config.js の伝統色トークン由来の hex を集約（data 駆動の
// アクセント色は動的 class 生成を避けるため inline style で適用する）。

import type { LucideIcon } from 'lucide-react';
import {
  Sparkles, BookOpen, Wrench, Settings,
  Users, LayoutTemplate, PenLine,
  BookMarked, Globe, Share2, Clock, Anchor, HeartPulse,
  Image as ImageIcon, BarChart3, Download, MessageCircle,
  Cloud, Cpu, Target,
} from 'lucide-react';

// ── パレット（伝統色トークン） ─────────────────────────────────
export const GUIDE_PALETTE = {
  ai500: '#4A6FA5',   // 藍色
  ai600: '#3D5A8A',
  ai700: '#30456F',
  ai800: '#233054',   // レール背景
  ai50: '#E8EDF5',
  uno50: '#F7FCFE',   // 卯の花色
  uno100: '#EFF9FD',
  murasaki: '#7C5B9E', // 執筆フェーズ
  murasaki100: '#EDE6F4',
  waka600: '#729C5A',  // 若草色（完了・仕上げ）
  waka500: '#8FC370',
  waka100: '#E1F1D7',
  waka700: '#557544',
  sumi900: '#1A1A22',
  sumi500: '#4A4A4A',
  sumi400: '#6B6B6B',
  line: '#E8EAF0',
} as const;

export const GUIDE_GRADIENT = 'linear-gradient(120deg, #3D5A8A, #7C5B9E)';

// ── 型 ─────────────────────────────────────────────────────────
export interface Chapter { id: string; short: string; icon: LucideIcon; }
export interface CoreValue { icon: LucideIcon; title: string; desc: string; tint: string; bg: string; }
export interface PhaseStep { n: string; label: string; desc: string; }
export interface Phase { id: string; name: string; sub: string; color: string; bg: string; steps: PhaseStep[]; }
export interface Tool { icon: LucideIcon; label: string; desc: string; }
export interface ToolGroup { name: string; color: string; bg: string; tools: Tool[]; }
export interface SetupItem { icon: LucideIcon; title: string; desc: string; badge: 'クラウド' | 'オフライン' | null; }

// ── 章（レール） ───────────────────────────────────────────────
export const CHAPTERS: Chapter[] = [
  { id: 'welcome', short: 'ようこそ', icon: Sparkles },
  { id: 'workflow', short: '制作の流れ', icon: BookOpen },
  { id: 'tools', short: '創作ツール', icon: Wrench },
  { id: 'settings', short: 'AI設定', icon: Settings },
];

// ── ようこそ：3つの核となる価値 ────────────────────────────────
export const CORE_VALUES: CoreValue[] = [
  { icon: Users, title: 'キャラクター設計', desc: '名前・性格・背景・外見をAIが提案', tint: GUIDE_PALETTE.ai500, bg: GUIDE_PALETTE.ai50 },
  { icon: LayoutTemplate, title: 'プロット自動生成', desc: '起承転結・3幕構成などから自動で骨組み', tint: GUIDE_PALETTE.murasaki, bg: GUIDE_PALETTE.murasaki100 },
  { icon: PenLine, title: 'AI執筆サポート', desc: '続きを書く・描写強化・リライトを伴走', tint: GUIDE_PALETTE.waka600, bg: GUIDE_PALETTE.waka100 },
];

// ── 制作の流れ：3フェーズ・8ステップ ──────────────────────────
export const PHASES: Phase[] = [
  {
    id: 'kousou', name: '構想', sub: '物語の土台をつくる', color: GUIDE_PALETTE.ai500, bg: GUIDE_PALETTE.ai50,
    steps: [
      { n: '1', label: '物語の種', desc: 'プロットの基本設定' },
      { n: '2', label: 'キャラクター', desc: '登場人物の設定' },
      { n: '3', label: '構成', desc: '起承転結・3幕構成' },
    ],
  },
  {
    id: 'shippitsu', name: '執筆', sub: 'AIと書き進める', color: GUIDE_PALETTE.murasaki, bg: GUIDE_PALETTE.murasaki100,
    steps: [
      { n: '4', label: 'あらすじ', desc: '物語の概要' },
      { n: '5', label: '章立て', desc: '各章の構成' },
      { n: '6', label: '執筆', desc: 'AI支援で本文を書く' },
    ],
  },
  {
    id: 'shiage', name: '仕上げ', sub: '磨いて世に出す', color: GUIDE_PALETTE.waka600, bg: GUIDE_PALETTE.waka100,
    steps: [
      { n: '7', label: '分析', desc: '評価・改善点の確認' },
      { n: '8', label: 'エクスポート', desc: '完成作品の出力' },
    ],
  },
];

// ── 創作ツール：目的別グループ ─────────────────────────────────
export const TOOL_GROUPS: ToolGroup[] = [
  {
    name: '世界づくり', color: GUIDE_PALETTE.ai500, bg: GUIDE_PALETTE.ai50,
    tools: [
      { icon: BookMarked, label: '用語集', desc: '用語と設定を整理' },
      { icon: Globe, label: '世界観', desc: '地理・文化・技術を管理' },
      { icon: Share2, label: '相関図', desc: '人物の関係を可視化' },
    ],
  },
  {
    name: '物語の管理', color: GUIDE_PALETTE.murasaki, bg: GUIDE_PALETTE.murasaki100,
    tools: [
      { icon: Clock, label: 'タイムライン', desc: '時系列を整理' },
      { icon: Anchor, label: '伏線トラッカー', desc: '伏線の設置と回収' },
      { icon: HeartPulse, label: '感情マップ', desc: '感情の起伏を可視化' },
    ],
  },
  {
    name: '仕上げ・相談', color: GUIDE_PALETTE.waka600, bg: GUIDE_PALETTE.waka100,
    tools: [
      { icon: ImageIcon, label: 'イメージボード', desc: '参考画像を管理' },
      { icon: BarChart3, label: '分析', desc: '構造と整合性をチェック' },
      { icon: Download, label: 'エクスポート', desc: '完成作品を出力' },
      { icon: MessageCircle, label: 'AIチャット相談', desc: '創作の疑問に回答' },
    ],
  },
];

// 見取り図の右レールに並べるツールアイコン（抜粋）
export const SCHEMATIC_TOOLS: LucideIcon[] = [BookMarked, Share2, Clock, BarChart3];

// ── AI設定 ─────────────────────────────────────────────────────
export const AI_SETUP: SetupItem[] = [
  { icon: Cloud, title: 'APIキーを登録', desc: 'Gemini・OpenAI・Anthropic に接続', badge: 'クラウド' },
  { icon: Cpu, title: 'ローカルLLMに接続', desc: 'Ollama 等でオフライン利用', badge: 'オフライン' },
  { icon: Target, title: 'モデルを選ぶ', desc: '用途に合わせて切り替え', badge: null },
];

// 'full' モード時のみ最終章に表示する補足
export const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl / Cmd + S', desc: '手動保存' },
  { keys: 'Ctrl / Cmd + N', desc: '新規プロジェクト' },
  { keys: 'Ctrl / Cmd + /', desc: 'ショートカット一覧' },
  { keys: 'Esc', desc: 'モーダルを閉じる' },
];
