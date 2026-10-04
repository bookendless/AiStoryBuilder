import React, { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useProject } from '../../contexts/useProject';
import { useAI } from '../../contexts/useAI';
import { useGeneration } from '../../contexts/useGeneration';
import { useToast } from '../useToast';
import type { NarrativeItem, NarrativeProposal, NarrativeSource } from '../../types/narrative';
import { applyNarrativeProposal, deriveNarrativeState, emptyMemory, FIELD_LABELS, itemsOf, KNOWLEDGE_LABELS, narrativeExtractKey, proposalIsCurrent, selectedDelta, STATUS_LABELS, validateDelta, verifySource } from '../../services/narrative/state';
import { extractAndSaveNarrative } from '../../services/narrative/workflow';
import { NarrativeItemEditor } from './narrative/NarrativeItemEditor';
import { narrativeButton, narrativeCard, narrativeInput, narrativeLinkButton, narrativeMuted, narrativePrimaryButton, narrativeWarning } from './narrative/styles';

interface NarrativeStatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** 開いたときに表示する章（草案サイドバーから渡される） */
  initialChapterId?: string;
}

export const NarrativeStatePanel: React.FC<NarrativeStatePanelProps> = ({ isOpen, onClose, initialChapterId }) => {
  const { currentProject: project, commitProjectUpdate, getCurrentProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { startTask, completeTask, cancelByKey, isKeyActive } = useGeneration();
  const { showError, showSuccess } = useToast();
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState<'review' | 'state' | 'history'>('review');
  const [source, setSource] = useState<NarrativeSource | null>(null);
  const [fullSource, setFullSource] = useState(false);
  const sourceMark = useRef<HTMLElement | null>(null);
  const sourcePanel = useRef<HTMLElement | null>(null);
  const [retryApprovalId, setRetryApprovalId] = useState<string | null>(null);
  const [point, setPoint] = useState<'before' | 'after'>('after');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const extractingRef = useRef(false);
  const key = narrativeExtractKey(project?.id);
  const lastKey = useRef(key);
  const running = isKeyActive(key);
  const chapter = project?.chapters.find(c => c.id === selected) ?? project?.chapters[0];
  const memory = project?.narrativeMemory ?? emptyMemory();
  const proposals = memory.proposals.filter(p => p.chapterId === chapter?.id && (p.id === retryApprovalId || !memory.records.some(r => r.proposalId === p.id)));
  const proposal = proposals[proposals.length - 1];
  const current = isOpen && !!project && !!proposal && proposalIsCurrent(project, proposal);
  const before = isOpen && project && chapter ? deriveNarrativeState(project, chapter.id) : null;
  const through = isOpen && tab === 'state' && project && chapter ? deriveNarrativeState(project, point === 'before' ? chapter.id : project.chapters[project.chapters.indexOf(chapter) + 1]?.id) : null;
  const errors = current && project && proposal && before ? validateDelta(selectedDelta(proposal), project, before.state, chapter!.id) : [];
  const job = memory.jobs.find(j => j.chapterId === chapter?.id);
  // 解析はモーダルやサイドバーを閉じても続ける（画面移動での中断を避ける）。作品を切り替えたときだけ旧作品の解析を止める。
  useEffect(() => {
    if (lastKey.current !== key) { cancelByKey(lastKey.current); lastKey.current = key; }
  }, [key, cancelByKey]);
  useEffect(() => { setSelected(''); setSource(null); setRetryApprovalId(null); }, [project?.id]);
  useEffect(() => {
    if (isOpen && initialChapterId) { setSelected(initialChapterId); setSource(null); setTab('review'); }
  }, [isOpen, initialChapterId]);
  useEffect(() => { setFullSource(false); }, [source]);
  useEffect(() => { if (source) { sourcePanel.current?.focus({ preventScroll: true }); sourceMark.current?.scrollIntoView?.({ block: 'center' }); } }, [source, fullSource]);

  const save = async (action: () => Promise<unknown>, message?: string) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try { await action(); if (message) showSuccess(message); }
    catch (e) { showError(e instanceof Error ? e.message : String(e)); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const updateProposal = (change: (p: NarrativeProposal) => NarrativeProposal) => {
    if (!project || !proposal) return;
    void save(() => commitProjectUpdate(p => {
      const m = p.narrativeMemory!;
      const target = m.proposals.find(x => x.id === proposal.id);
      if (!target || !proposalIsCurrent(p, target) || m.records.some(r => r.proposalId === target.id)) throw new Error('前提が変わりました。再解析してください');
      return { narrativeMemory: { ...m, proposals: m.proposals.map(x => x.id === target.id ? change(x) : x) } };
    }, project.id));
  };
  const replaceItem = (item: NarrativeItem) => updateProposal(p => ({ ...p, decisions: { ...p.decisions, [item.id]: 'pending' }, delta: {
    characterChanges: p.delta.characterChanges.map(x => x.id === item.id ? item as typeof x : x),
    addEvents: p.delta.addEvents.map(x => x.id === item.id ? item as typeof x : x),
    addRequirements: p.delta.addRequirements.map(x => x.id === item.id ? item as typeof x : x),
    transitionRequirements: p.delta.transitionRequirements.map(x => x.id === item.id ? item as typeof x : x),
  } }));
  const extract = async () => {
    if (!project || !chapter || running || savingRef.current || extractingRef.current) return;
    extractingRef.current = true;
    const task = startTask({ key, label: '物語状態を解析中', step: 'draft' });
    try {
      await extractAndSaveNarrative(project.id, chapter.id, settings, commitProjectUpdate, getCurrentProject, task.signal);
      showSuccess('章全体の解析が完了しました。項目を確認してください');
    } catch (e) { if (!task.signal.aborted) showError(e instanceof Error ? e.message : String(e)); }
    finally { extractingRef.current = false; completeTask(task.id); }
  };
  const sourceChapter = project?.chapters.find(c => c.id === source?.chapterId);
  const sourceBody = sourceChapter?.draft ?? '';
  const sourceCurrent = source && project && verifySource(source, project);
  const title = <span className="flex items-center gap-2"><Layers className="h-5 w-5 text-indigo-500" />物語状態（次章への引き継ぎ）</span>;
  return <Modal isOpen={isOpen} onClose={onClose} title={title} size="full">
    {!isOpen ? null : !project ? <p className="font-['Noto_Sans_JP']">プロジェクトを開いてください。</p> : <div className="min-w-0 space-y-5 break-words font-['Noto_Sans_JP'] text-gray-900 dark:text-gray-100">
      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-300">章を解析し、作者が採用した状態だけを次章の生成に使います。解析にはAI利用が発生します。人物設定は自動で書き換えません。</p>
        <ol className="flex flex-wrap gap-2 text-xs text-indigo-700 dark:text-indigo-300" aria-label="使い方">
          {['① 章全体を解析', '② 項目を採用・修正', '③ 章の状態を確定', '→ 次章の生成に引き継ぎ'].map(s => <li key={s} className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40">{s}</li>)}
        </ol>
      </div>
      {project.narrativeMemoryQuarantine && <p role="alert" className={narrativeWarning}>状態データを読み込めなかったため退避しました。本文と元データは保持されています。{project.narrativeMemoryQuarantine.message}</p>}

      <div className={`${narrativeCard} space-y-3`}>
        <label className="flex gap-2 items-center text-sm font-medium cursor-pointer"><input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" checked={memory.enabled} disabled={saving || running} onChange={e => {
          const enabled = e.target.checked;
          void save(() => commitProjectUpdate(p => ({ narrativeMemory: { ...(p.narrativeMemory ?? emptyMemory()), enabled } }), project.id));
        }} />確定状態を生成に使用する</label>
        <div className="flex flex-wrap gap-2 items-center">
          <select aria-label="状態を確認する章" className={`${narrativeInput} w-auto max-w-full`} value={chapter?.id ?? ''} onChange={e => { setSelected(e.target.value); setSource(null); }}>
            {project.chapters.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.title}</option>)}
          </select>
          <button className={narrativePrimaryButton} disabled={!memory.enabled || !isConfigured || !chapter?.draft?.trim() || running || saving || !!before?.reason} onClick={() => void extract()}>{job && job.status !== 'completed' ? '解析を再開' : '章全体を解析'}</button>
          {running && <button className={narrativeButton} onClick={() => cancelByKey(key)}>解析を中断</button>}
          {!isConfigured && <span className={narrativeWarning}>解析にはAI設定が必要です。</span>}
        </div>
        {before?.reason && <p role="alert" className={narrativeWarning}>{before.reason}。前の章から順に確定してください。</p>}
        {job && <div aria-live="polite" className="space-y-1">
          <p className={narrativeMuted}>解析済み {job.finished} / {job.chunks.length} 区間 {running ? '（実行中）' : job.status === 'completed' ? '（完了）' : '（中断・再開可能）'} {job.error}</p>
          <div className="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${job.chunks.length ? Math.round(job.finished / job.chunks.length * 100) : 0}%` }} /></div>
        </div>}
      </div>

      <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit max-w-full" role="tablist" aria-label="物語状態の表示">
        {(['review', 'state', 'history'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${tab === t ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`} onClick={() => setTab(t)}>{({ review: '抽出提案', state: '章末の状態', history: '採用履歴' })[t]}</button>)}
      </div>

      {tab === 'review' && <section className="space-y-3" aria-label="抽出提案">
        {!proposal ? <p className="text-sm text-gray-500 dark:text-gray-400">この章の未採用の提案はありません。本文を保存してから章全体を解析します。</p> : <>
          {!current && <p role="alert" className={narrativeWarning}>本文・設定・前章の確定状態が変わっています。再解析が必要です。</p>}
          {proposal.warnings?.map(w => <p key={w} role="alert" className={narrativeWarning}>{w}</p>)}
          {!itemsOf(proposal.delta).length && <p className="text-sm text-gray-600 dark:text-gray-300">状態の変化は抽出されませんでした。章全体を確認したうえで「章の状態を確定」できます。</p>}
          <button className={narrativeButton} disabled={!current || saving} onClick={() => updateProposal(p => ({ ...p, decisions: { ...p.decisions, ...Object.fromEntries(itemsOf(p.delta).filter(i => !i.warnings.length).map(i => [i.id, 'accept'])) } }))}>注意事項のない項目を採用にする</button>
          {itemsOf(proposal.delta).map(item => <article key={item.id} className={`${narrativeCard} space-y-3`}>
            <NarrativeItemEditor key={`${item.id}:${JSON.stringify(item)}`} item={item} project={project} previous={before!.state} disabled={!current || saving} onSave={replaceItem} onSource={setSource} onRegister={name => void save(() => commitProjectUpdate(p => {
              if (p.characters.some(c => c.name === name)) throw new Error('同名の人物がいます。既存の人物を選んでください');
              return { characters: [...p.characters, { id: crypto.randomUUID(), name, role: '', appearance: '', personality: '', background: '' }] };
            }, project.id), '人物を登録しました。先頭章から状態を再確認してください')} />
            <fieldset disabled={!current || saving} className="flex gap-4 text-sm pt-2 border-t border-gray-200 dark:border-gray-700"><legend className="sr-only">この項目の判断</legend>{(['pending', 'accept', 'reject'] as const).map(d => <label key={d} className="flex gap-1 items-center cursor-pointer"><input type="radio" className="text-indigo-600 focus:ring-indigo-500" name={item.id} checked={proposal.decisions[item.id] === d} onChange={() => updateProposal(p => ({ ...p, decisions: { ...p.decisions, [item.id]: d } }))} />{({ pending: '未判断', accept: '採用', reject: '不採用' })[d]}</label>)}</fieldset>
          </article>)}
          {!!errors.length && <p role="alert" className={narrativeWarning}>採用項目の確認事項: {errors.join('。')}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p aria-live="polite" className={narrativeMuted}>未判断 {itemsOf(proposal.delta).filter(i => proposal.decisions[i.id] === 'pending').length} 件{saving ? ' ・ 保存中' : ''}</p>
            <button className={narrativePrimaryButton} disabled={!current || saving || running || !memory.enabled || errors.length > 0 || itemsOf(proposal.delta).some(i => proposal.decisions[i.id] === 'pending')} onClick={() => void save(async () => {
              setRetryApprovalId(proposal.id);
              await commitProjectUpdate(p => applyNarrativeProposal(p, proposal.id), project.id);
              const latest = getCurrentProject();
              if (!latest || !proposalIsCurrent(latest, proposal)) throw new Error('保存中に前提が変わりました。状態を確認してください');
              setRetryApprovalId(null);
            }, '章の状態を保存・確定しました')}>{retryApprovalId === proposal.id ? '確定内容の保存を再試行' : '章の状態を確定'}</button>
          </div>
        </>}
      </section>}

      {tab === 'state' && <section className="space-y-3" aria-label="章末の状態">
        <label className="flex items-center gap-2 text-sm">表示時点 <select className={`${narrativeInput} w-auto`} value={point} onChange={e => setPoint(e.target.value as 'before' | 'after')}><option value="before">章の開始時点</option><option value="after">章の終了時点</option></select></label>
        {through?.reason && <p role="alert" className={narrativeWarning}>{through.reason}。以下はそこまでに確定した状態です。</p>}
        {Object.entries(through?.state.characters ?? {}).map(([id, fields]) => <article key={id} className={`${narrativeCard} space-y-2`}>
          <h3 className="text-sm font-semibold">{project.characters.find(c => c.id === id)?.name ?? id}</h3>
          {Object.entries(fields).map(([field, values]) => <div key={field} className="text-sm"><span className="text-xs font-medium text-gray-500 dark:text-gray-400">{FIELD_LABELS[field as keyof typeof FIELD_LABELS]}</span>{values.map(v => <p key={v.id}>{v.text} {v.knowledge && `（${KNOWLEDGE_LABELS[v.knowledge]}）`} <button className={narrativeLinkButton} onClick={() => setSource(v.source)}>出典</button></p>)}</div>)}
        </article>)}
        <div className={`${narrativeCard} space-y-1 text-sm`}><h3 className="text-sm font-semibold mb-1">出来事</h3>{through?.state.events.map(e => <p key={e.id}>{e.description} <button className={narrativeLinkButton} onClick={() => setSource(e.source)}>出典</button></p>)}</div>
        <div className={`${narrativeCard} space-y-1 text-sm`}><h3 className="text-sm font-semibold mb-1">約束・未解決事項</h3>{through?.state.requirements.map(r => <p key={r.id}>{r.description}（{STATUS_LABELS[r.status]}） <button className={narrativeLinkButton} onClick={() => setSource(r.resolution ?? r.source)}>出典</button></p>)}</div>
      </section>}

      {tab === 'history' && <section aria-label="採用履歴" className="space-y-3">{memory.records.filter(r => r.chapterId === chapter?.id).map(r => <details key={r.revision} className={narrativeCard}><summary className="cursor-pointer text-sm">版 {r.revision} ・ {new Date(r.acceptedAt).toLocaleString()} ・ {itemsOf(r.delta).length} 件</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(r.delta, null, 2)}</pre></details>)}</section>}

      {source && <section ref={sourcePanel} tabIndex={-1} className={`${narrativeCard} space-y-2 border-indigo-200 dark:border-indigo-800`} aria-label="引用元の本文">
        <h3 className="text-sm font-semibold">出典: {sourceChapter?.title}</h3>
        {source.kind === 'author' && <p className="text-sm">作者による修正: {source.reason}</p>}
        <div className="flex flex-wrap gap-2"><button className={narrativeButton} onClick={() => setSource(null)}>出典を閉じる</button>{sourceCurrent && <button className={narrativeButton} onClick={() => setFullSource(!fullSource)}>{fullSource ? '引用の前後だけを表示' : 'この章の全文を表示'}</button>}</div>
        {sourceCurrent ? <><div className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm custom-scrollbar">{sourceBody.slice(fullSource ? 0 : Math.max(0, source.start - 500), source.start)}<mark ref={sourceMark}>{sourceBody.slice(source.start, source.end)}</mark>{sourceBody.slice(source.end, fullSource ? undefined : source.end + 500)}</div><p className={narrativeMuted}>本文位置 {source.start}–{source.end}。{fullSource ? '章の全文を表示しています。' : '表示は引用の前後500文字です。'}</p></> : <><p role="alert" className={narrativeWarning}>引用位置が未確定、または本文が変更されています。保存時の引用を表示しています。</p><blockquote className="text-sm border-l-2 border-indigo-400 pl-3 whitespace-pre-wrap">{source.quote}</blockquote></>}
      </section>}
    </div>}
  </Modal>;
};
