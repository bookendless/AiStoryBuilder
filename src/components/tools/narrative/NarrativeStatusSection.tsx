import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useProject } from '../../../contexts/useProject';
import { useGeneration } from '../../../contexts/useGeneration';
import { narrativeExtractKey, summarizeNarrativeStatus, type ChapterNarrativeStatus, type NarrativeStatusSummary } from '../../../services/narrative/state';

interface NarrativeStatusSectionProps {
  /** 草案サイドバーで選択中の章 */
  chapterId: string;
  expanded: boolean;
  onToggle: () => void;
  /** 物語状態モーダルを指定の章で開く */
  onOpen: (chapterId: string) => void;
}

const BADGES: Record<NarrativeStatusSummary['kind'], { label: string; className: string }> = {
  off: { label: '未使用', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  running: { label: '解析中', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  blocked: { label: '要確認', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  ready: { label: '引き継ぎ中', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
};

const CHAPTER_STATUS: Record<ChapterNarrativeStatus, string> = {
  confirmed: 'この章の状態は確定済みです。次の章の生成に引き継がれます。',
  pending: 'この章には確認待ちの抽出提案があります。採用・確定すると次の章に引き継がれます。',
  stale: 'この章の本文や設定が変わったため、再解析が必要です。',
  unanalyzed: 'この章は未解析です。書き終えたら解析・確認すると次の章に引き継がれます。',
};

// 状態の算出は全章の本文ハッシュと承認差分の再生を伴うため、打鍵ごとではなく入力が止まってから行う
const SUMMARY_DELAY_MS = 400;

export const NarrativeStatusSection: React.FC<NarrativeStatusSectionProps> = ({ chapterId, expanded, onToggle, onOpen }) => {
  const { currentProject } = useProject();
  const { isKeyActive } = useGeneration();
  const [snapshot, setSnapshot] = useState(currentProject);
  useEffect(() => {
    const timer = setTimeout(() => setSnapshot(currentProject), SUMMARY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentProject]);
  const project = snapshot && snapshot.id === currentProject?.id ? snapshot : currentProject;
  const running = isKeyActive(narrativeExtractKey(project?.id));
  const summary = useMemo(() => (project ? summarizeNarrativeStatus(project, chapterId, running) : null), [project, chapterId, running]);
  if (!project || !summary) return null;

  const titleOf = (id: string) => project.chapters.find(c => c.id === id)?.title ?? '章';
  const badge = BADGES[summary.kind];
  const action = (() => {
    switch (summary.kind) {
      case 'off':
        return { target: chapterId, title: '物語状態を設定', description: '有効にすると、確定した状態が次の章の生成に使われます' };
      case 'running':
        return { target: summary.chapterId, title: '解析の進行状況を見る', description: summary.total ? `「${titleOf(summary.chapterId)}」を解析中 ${summary.finished} / ${summary.total} 区間` : '解析を準備中' };
      case 'blocked':
        return { target: summary.chapterId, title: `「${titleOf(summary.chapterId)}」を確認`, description: summary.hasDraft ? '前の章から順に状態を確定します' : '本文を書いてから解析します' };
      case 'ready':
        return { target: chapterId, title: 'この章を解析・確認', description: summary.chapter === 'pending' ? '確認待ちの提案を採用・確定する' : '人物・出来事・約束を抽出して確認する' };
    }
  })();

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between mb-3"
      >
        <span className="min-w-0 text-left">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
            <Layers className="h-4 w-4 mr-2 text-indigo-500 shrink-0" />
            物語状態
          </h3>
          <span className="block pl-6 text-[11px] text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">次章への引き継ぎ</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap font-['Noto_Sans_JP'] ${badge.className}`}>{badge.label}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 font-['Noto_Sans_JP']">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            書き終えた章から、人物の現在地・関係・所持品、出来事、未回収の約束を抽出します。採用した内容だけを次の章の生成に引き継ぎ、長編で起きやすい名前・年齢・既出の出来事の食い違いを防ぎます。
          </p>

          {summary.kind === 'blocked' && (
            <p role="status" className="text-xs text-amber-600 dark:text-amber-400">
              {summary.hasDraft
                ? `この章の生成に必要な「${titleOf(summary.chapterId)}」の状態が未確定です。確定するまで、物語状態を使った生成は実行できません。`
                : `「${titleOf(summary.chapterId)}」の本文がまだありません。物語状態は前の章から順に確定するため、先にその章を書き進めてください。`}
            </p>
          )}
          {summary.kind === 'ready' && (
            <div role="status" className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
              <p>
                この章の生成に引き継ぐ状態: 人物 {summary.characters}・未解決 {summary.openRequirements}・出来事 {summary.events}件
              </p>
              {summary.events > 0 && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">出来事は入力上限に収まる分を、この章に関連が深い順に使います。</p>
              )}
              <p className={summary.chapter === 'stale' ? 'text-amber-600 dark:text-amber-400' : ''}>{CHAPTER_STATUS[summary.chapter]}</p>
            </div>
          )}
          {summary.kind === 'off' && (
            <p role="status" className="text-xs text-gray-500 dark:text-gray-400">現在は生成に使われていません。</p>
          )}

          <button
            type="button"
            onClick={() => onOpen(action.target)}
            className="w-full p-3 text-left bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-xs">{action.title}</div>
                <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{action.description}</div>
              </div>
              <Layers className={`h-3 w-3 ${summary.kind === 'running' ? 'text-indigo-500 animate-pulse' : 'text-indigo-500/70'}`} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
