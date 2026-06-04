// Onboarding.tsx — 案B「ガイドマップ」実装
// 既存の Onboarding を置き換えるドロップイン。props / 完了フラグ / フックは踏襲。
// レイアウトは Tailwind、data 駆動の色のみ inline style。レスポンシブは md: で分岐。

import React, { useState } from 'react';
import {
  ChevronRight, ChevronLeft, ArrowRight, X, Check, Compass, HelpCircle,
} from 'lucide-react';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';
import { useOverlayBackHandler } from '../contexts/BackButtonContext';
import { createPortal } from 'react-dom';
import {
  GUIDE_PALETTE as P, GUIDE_GRADIENT as GRAD,
  CHAPTERS, CORE_VALUES, PHASES, TOOL_GROUPS, SCHEMATIC_TOOLS, AI_SETUP, SHORTCUTS,
} from './onboardingData';

interface OnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  mode?: 'full' | 'quick';
}

// ── 小物 ───────────────────────────────────────────────────────
const Badge: React.FC<{ kind: 'クラウド' | 'オフライン' }> = ({ kind }) => {
  const offline = kind === 'オフライン';
  return (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: offline ? P.waka700 : P.ai600, background: offline ? P.waka100 : P.ai50 }}
    >
      {kind}
    </span>
  );
};

// ── ようこそ ───────────────────────────────────────────────────
const WelcomeBody: React.FC = () => (
  <div>
    <h2 className="text-2xl md:text-[28px] font-extrabold text-sumi-900 dark:text-white leading-snug mb-2.5 font-['Noto_Sans_JP']">
      ようこそ。<br />AIと共創する小説づくりへ。
    </h2>
    <p className="text-[15px] leading-7 text-sumi-500 dark:text-gray-300 mb-6 max-w-xl font-['Noto_Sans_JP']">
      面倒な作業の<b style={{ color: P.ai600 }}>80%</b>はAIに、あなたは<b style={{ color: P.murasaki }}>20%</b>の創造性に集中。このガイドで、できることと進め方を3分で掴みましょう。
    </p>
    <div className="flex flex-col gap-2.5 mb-5">
      {CORE_VALUES.map((v, i) => {
        const Ico = v.icon;
        return (
          <div
            key={v.title}
            className="flex items-center gap-3.5 px-4 py-3 bg-white dark:bg-white/5 rounded-xl"
            style={{ border: `1px solid ${P.line}`, borderLeft: `4px solid ${v.tint}` }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: v.bg }}>
              <Ico className="w-5 h-5" style={{ color: v.tint }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] font-bold text-sumi-900 dark:text-white font-['Noto_Sans_JP']">{v.title}</div>
              <div className="text-[12.5px] text-sumi-400 dark:text-gray-400 leading-snug font-['Noto_Sans_JP']">{v.desc}</div>
            </div>
            <span className="text-xs font-bold text-sumi-300">0{i + 1}</span>
          </div>
        );
      })}
    </div>
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] text-sumi-500 dark:text-gray-300 font-['Noto_Sans_JP']" style={{ background: P.uno100 }}>
      <Compass className="w-[17px] h-[17px] shrink-0" style={{ color: P.ai500 }} />
      <span>左の<b className="text-sumi-700 dark:text-white">4つの章</b>に沿って、制作の流れ・ツール・AI設定を順に見ていきます。</span>
    </div>
  </div>
);

// ── 制作の流れ：横断ジャーニー ─────────────────────────────────
const WorkflowBody: React.FC = () => (
  <div>
    <h2 className="text-xl md:text-2xl font-extrabold text-sumi-900 dark:text-white mb-1.5 font-['Noto_Sans_JP']">制作の流れ — 3フェーズ・8ステップ</h2>
    <p className="text-[13.5px] text-sumi-500 dark:text-gray-400 mb-5 font-['Noto_Sans_JP']">左から右へ。1本道で完成まで導きます。</p>
    <div className="flex flex-col md:flex-row gap-3.5 md:gap-0 items-stretch">
      {PHASES.map((p, pi) => (
        <div key={p.id} className="flex-1 relative" style={{ paddingRight: pi < PHASES.length - 1 ? 14 : 0 }}>
          <div className="text-[12.5px] font-extrabold mb-2.5 flex items-center gap-2 font-['Noto_Sans_JP']" style={{ color: p.color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
            <span className="text-sumi-300 font-semibold">· {p.sub}</span>
          </div>
          <div className="rounded-xl p-3" style={{ background: p.bg }}>
            <div className="flex flex-col md:flex-row gap-2.5 md:gap-1.5 relative">
              {/* コネクタ線 */}
              <div className="absolute hidden md:block" style={{ left: 26, right: 26, top: 18, height: 2, background: p.color, opacity: 0.25 }} />
              <div className="absolute md:hidden" style={{ top: 18, bottom: 18, left: 17, width: 2, background: p.color, opacity: 0.25 }} />
              {p.steps.map((s) => (
                <div key={s.n} className="flex-1 flex flex-row md:flex-col items-center gap-3 md:gap-1.5 relative z-[1]">
                  <div className="w-9 h-9 rounded-full text-white flex items-center justify-center font-extrabold text-[15px] shrink-0" style={{ background: p.color, boxShadow: `0 0 0 3px ${p.bg}` }}>{s.n}</div>
                  <div className="text-left md:text-center">
                    <div className="text-[13px] font-bold text-sumi-900 dark:text-white leading-tight font-['Noto_Sans_JP']">{s.label}</div>
                    <div className="text-[11px] text-sumi-400 dark:text-gray-400 leading-tight mt-0.5 font-['Noto_Sans_JP']">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── 創作ツール：アプリの見取り図 ───────────────────────────────
const WireCol: React.FC<{ label: string; color: string; active?: boolean; className?: string; children: React.ReactNode }> = ({ label, color, active, className = '', children }) => (
  <div
    className={`rounded-lg p-2 relative ${className}`}
    style={{ border: `1.5px ${active ? 'solid' : 'dashed'} ${active ? color : '#CFEDF9'}`, background: active ? `${color}14` : P.uno50 }}
  >
    <div className="text-[10.5px] font-bold mb-1.5" style={{ color: active ? color : P.sumi400 }}>{label}</div>
    {children}
  </div>
);

const ToolsBody: React.FC = () => (
  <div>
    <h2 className="text-xl md:text-2xl font-extrabold text-sumi-900 dark:text-white mb-1.5 font-['Noto_Sans_JP']">創作ツールは「どこ」にある？</h2>
    <p className="text-[13.5px] text-sumi-500 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">画面右のサイドバーに、10種のツールがまとまっています。</p>
    <div className="flex flex-col md:flex-row gap-4">
      {/* 見取り図 */}
      <div className="md:w-[300px] md:shrink-0">
        <div className="bg-white dark:bg-white/5 rounded-2xl p-3 shadow-sm" style={{ border: `1px solid ${P.line}` }}>
          <div className="h-4 rounded mb-2 flex items-center pl-2 gap-1" style={{ background: '#DFF3FB' }}>
            {[0, 1, 2].map((i) => <span key={i} className="w-[5px] h-[5px] rounded-full" style={{ background: '#CFEDF9' }} />)}
          </div>
          <div className="flex gap-2 h-[150px]">
            <WireCol label="① 制作ステップ" color={P.ai500} className="w-16 shrink-0">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-[7px] rounded mb-[5px]" style={{ background: '#CFEDF9' }} />)}
            </WireCol>
            <WireCol label="エディタ" color={P.sumi400} className="flex-1">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-1.5 rounded mb-1.5" style={{ background: '#DFF3FB', width: i === 5 ? '60%' : '100%' }} />)}
            </WireCol>
            <WireCol label="ツール" color={P.murasaki} active className="w-[52px] shrink-0">
              <div className="flex flex-col gap-1.5 items-center">
                {SCHEMATIC_TOOLS.map((Ico, i) => (
                  <div key={i} className="w-[26px] h-[26px] rounded-lg bg-white flex items-center justify-center" style={{ border: `1px solid ${P.murasaki}40` }}>
                    <Ico className="w-[15px] h-[15px]" style={{ color: P.murasaki }} />
                  </div>
                ))}
              </div>
            </WireCol>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 text-xs font-semibold font-['Noto_Sans_JP']" style={{ color: '#684E86' }}>
          <ArrowRight className="w-[15px] h-[15px]" style={{ color: P.murasaki }} /> いつでもワンタップで開閉できます
        </div>
      </div>
      {/* 凡例 */}
      <div className="flex-1 flex flex-col gap-3">
        {TOOL_GROUPS.map((g) => (
          <div key={g.name}>
            <div className="text-xs font-bold mb-1.5 font-['Noto_Sans_JP']" style={{ color: g.color }}>{g.name}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {g.tools.map((t) => {
                const Ico = t.icon;
                return (
                  <div key={t.label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: g.bg }}>
                    <Ico className="w-4 h-4 shrink-0" style={{ color: g.color }} />
                    <span className="text-[12.5px] font-semibold text-sumi-700 dark:text-white truncate font-['Noto_Sans_JP']">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── AI設定 ─────────────────────────────────────────────────────
const SettingsBody: React.FC<{ mode: 'full' | 'quick'; onStart: () => void }> = ({ mode, onStart }) => (
  <div>
    <h2 className="text-xl md:text-2xl font-extrabold text-sumi-900 dark:text-white mb-1.5 font-['Noto_Sans_JP']">最後に、AI設定</h2>
    <p className="text-[13.5px] leading-relaxed text-sumi-500 dark:text-gray-400 mb-5 max-w-xl font-['Noto_Sans_JP']">使うAIを選びましょう。クラウドでもオフラインでも動きます。設定はいつでも変更できます。</p>
    <div className="flex flex-col gap-2.5 mb-5">
      {AI_SETUP.map((s, i) => {
        const Ico = s.icon;
        return (
          <div key={s.title} className="flex items-center gap-3.5 px-4 py-3.5 bg-white dark:bg-white/5 rounded-xl" style={{ border: `1px solid ${P.line}` }}>
            <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-extrabold shrink-0" style={{ border: `2px solid #BAC9E1`, color: P.ai500 }}>{i + 1}</div>
            <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0" style={{ background: P.uno100 }}>
              <Ico className="w-[22px] h-[22px]" style={{ color: P.ai600 }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[14.5px] font-bold text-sumi-900 dark:text-white font-['Noto_Sans_JP']">{s.title}</span>
                {s.badge && <Badge kind={s.badge} />}
              </div>
              <div className="text-[12.5px] text-sumi-400 dark:text-gray-400 font-['Noto_Sans_JP']">{s.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
    {mode === 'full' && (
      <div className="mb-5 px-4 py-3 rounded-xl" style={{ background: P.uno100 }}>
        <div className="text-xs font-bold text-sumi-500 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">便利なショートカット</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {SHORTCUTS.map((sc) => (
            <div key={sc.keys} className="flex items-center gap-2 text-[12px] font-['Noto_Sans_JP']">
              <kbd className="px-1.5 py-0.5 rounded bg-white text-sumi-600 font-mono text-[11px]" style={{ border: `1px solid ${P.line}` }}>{sc.keys}</kbd>
              <span className="text-sumi-400 dark:text-gray-400">{sc.desc}</span>
            </div>
          ))}
        </div>
      </div>
    )}
    <div className="flex flex-col md:flex-row gap-2.5">
      <button
        onClick={onStart}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl text-[15px] font-bold font-['Noto_Sans_JP'] transition-transform hover:scale-[1.02]"
        style={{ background: GRAD, boxShadow: `0 8px 22px ${P.ai500}38` }}
      >
        AI設定を開く <ArrowRight className="w-[18px] h-[18px]" />
      </button>
      <button
        onClick={onStart}
        className="px-5 py-3 bg-transparent text-sumi-500 dark:text-gray-300 rounded-xl text-[14px] font-semibold font-['Noto_Sans_JP'] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        style={{ border: `1px solid ${P.line}` }}
      >
        あとで設定する
      </button>
    </div>
  </div>
);

// ── 章レール ───────────────────────────────────────────────────
const RailItem: React.FC<{ index: number; step: number; chapter: typeof CHAPTERS[number]; compact?: boolean; onClick: () => void }> = ({ index, step, chapter, compact, onClick }) => {
  const active = index === step;
  const done = index < step;
  const Ico = chapter.icon;
  const dot = (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: compact ? 24 : 26, height: compact ? 24 : 26,
        background: active ? '#fff' : done ? P.waka500 : 'rgba(255,255,255,0.16)',
      }}
    >
      {done
        ? <Check className="text-white" style={{ width: 14, height: 14 }} strokeWidth={3} />
        : <Ico style={{ width: compact ? 13 : 14, height: compact ? 13 : 14, color: active ? P.ai700 : 'rgba(255,255,255,0.82)' }} />}
    </div>
  );

  if (compact) {
    return (
      <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg font-['Noto_Sans_JP']" style={{ background: active ? 'rgba(255,255,255,0.16)' : 'transparent' }}>
        {dot}
        <span className="text-[10.5px] whitespace-nowrap" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.7)' }}>{chapter.short}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left transition-colors font-['Noto_Sans_JP']" style={{ background: active ? 'rgba(255,255,255,0.14)' : 'transparent' }}>
      {dot}
      <div>
        <div className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>STEP {index + 1}</div>
        <div className="text-[13.5px]" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.78)' }}>{chapter.short}</div>
      </div>
    </button>
  );
};

// ── 本体 ───────────────────────────────────────────────────────
export const Onboarding: React.FC<OnboardingProps> = ({ isOpen, onClose, onComplete, mode = 'quick' }) => {
  const [step, setStep] = useState(0);
  const isFirstTime = !localStorage.getItem('onboarding-completed');

  const handleComplete = () => {
    if (isFirstTime) localStorage.setItem('onboarding-completed', 'true');
    onComplete();
    onClose();
  };

  const { modalRef } = useModalNavigation({ isOpen, onClose: handleComplete });
  useOverlayBackHandler(isOpen, onClose, 'onboarding-modal', 80);

  if (!isOpen) return null;

  const last = CHAPTERS.length - 1;
  const next = () => (step < last ? setStep(step + 1) : handleComplete());
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const bodies = [
    <WelcomeBody key="w" />,
    <WorkflowBody key="f" />,
    <ToolsBody key="t" />,
    <SettingsBody key="s" mode={mode} onStart={handleComplete} />,
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6" role="dialog" aria-modal="true" aria-label="ガイド">
      <div className="absolute inset-0 glass-overlay" onClick={handleComplete} aria-hidden="true" />
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-5xl flex flex-col md:flex-row overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-300 focus:outline-none h-[93vh] sm:h-[86vh] md:h-[628px]"
      >
        {/* モバイル：上部タブ */}
        <div className="md:hidden shrink-0 px-3.5 pt-3.5 pb-3" style={{ background: P.ai800 }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: GRAD }}>
              <HelpCircle className="w-[17px] h-[17px] text-white" />
            </div>
            <div className="text-white text-[14.5px] font-extrabold flex-1 font-['Noto_Sans_JP']">ガイド</div>
            <button onClick={handleComplete} aria-label="閉じる" className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-white" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <X className="w-[17px] h-[17px]" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {CHAPTERS.map((c, i) => <RailItem key={c.id} index={i} step={step} chapter={c} compact onClick={() => setStep(i)} />)}
          </div>
        </div>

        {/* デスクトップ：縦レール */}
        <div className="hidden md:flex md:flex-col md:w-[196px] shrink-0 px-4 py-5" style={{ background: P.ai800 }}>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: GRAD }}>
              <HelpCircle className="w-[19px] h-[19px] text-white" />
            </div>
            <div className="text-white text-[15px] font-extrabold font-['Noto_Sans_JP']">ガイド</div>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            {CHAPTERS.map((c, i) => <RailItem key={c.id} index={i} step={step} chapter={c} onClick={() => setStep(i)} />)}
          </div>
          <div className="text-[11.5px] mt-3.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{step + 1} / {CHAPTERS.length} 章</div>
        </div>

        {/* コンテンツ列 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-sumi-800" style={{ backgroundImage: 'linear-gradient(180deg, #F7FCFE, transparent 30%)' }}>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-[18px] py-5 md:px-9 md:py-8 dark:bg-sumi-800">
            <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {bodies[step]}
            </div>
          </div>
          {/* フッター */}
          <div className="shrink-0 px-[18px] py-3 md:px-9 md:py-4 flex items-center justify-between bg-white dark:bg-sumi-800" style={{ borderTop: `1px solid ${P.line}` }}>
            <button
              onClick={prev}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] font-semibold text-[14px] font-['Noto_Sans_JP'] disabled:cursor-default"
              style={{ color: step === 0 ? P.sumi400 : undefined }}
            >
              <ChevronLeft className="w-[18px] h-[18px]" /> 前へ
            </button>
            {step !== last && (
              <button onClick={handleComplete} className="text-[13px] text-sumi-400 dark:text-gray-500 hover:text-sumi-600 dark:hover:text-gray-300 font-['Noto_Sans_JP']">スキップ</button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl font-bold text-[14.5px] font-['Noto_Sans_JP'] transition-transform hover:scale-[1.03]"
              style={{ background: GRAD, boxShadow: `0 6px 18px ${P.ai500}33` }}
            >
              {step === last ? '始める' : '次へ'}
              {step === last ? <ArrowRight className="w-[17px] h-[17px]" /> : <ChevronRight className="w-[17px] h-[17px]" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
