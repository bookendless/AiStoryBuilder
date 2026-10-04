import React, { useState } from 'react';
import type { Project } from '../../../types/project';
import type { CharacterChange, NarrativeItem, NarrativeRequirement, NarrativeSource, NarrativeState, PastEvent, RequirementTransition } from '../../../types/narrative';
import { FIELDS, FIELD_LABELS, KNOWLEDGE_LABELS, STATUS_LABELS } from '../../../services/narrative/state';
import { narrativeButton, narrativeInput, narrativeMuted, narrativeWarning } from './styles';
import { findQuote } from '../../../services/narrative/source';

type Item = CharacterChange | PastEvent | NarrativeRequirement | RequirementTransition;
export const NarrativeItemEditor: React.FC<{ item: NarrativeItem; project: Project; previous: NarrativeState; disabled: boolean; onSave: (item: NarrativeItem) => void; onSource: (source: NarrativeSource) => void; onRegister: (name: string) => void }> = ({ item: raw, project, previous, disabled, onSave, onSource, onRegister }) => {
  const item = raw as Item;
  const [edited, setEdited] = useState<Item>(structuredClone(item));
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('characterName' in item ? item.characterName ?? '' : '');
  const input = narrativeInput;
  const button = narrativeButton;
  const character = 'characterId' in item ? project.characters.find(c => c.id === item.characterId) : undefined;
  const title = 'field' in item ? `${character?.name ?? item.characterName ?? '未登録の人物'} / ${FIELD_LABELS[item.field]}` : 'requirementId' in item ? '約束の状態変更' : 'kind' in item ? '新しい約束・未解決事項' : '出来事';
  const oldValues = 'field' in item && Object.prototype.hasOwnProperty.call(previous.characters, item.characterId) ? previous.characters[item.characterId][item.field] : [];
  const change = (next: Item) => {
    const source: NarrativeSource = { ...next.source, kind: 'author', reason: next.source.kind === 'author' ? next.source.reason : '' };
    setEdited({ ...next, source, ...('values' in next ? { values: next.values.map(v => ({ ...v, source })) } : {}) });
  };
  return <>
    <h3 className="text-sm font-semibold">{title}</h3>
    {'field' in item ? <><p className={narrativeMuted}>旧値: {oldValues?.map(v => v.text).join(' / ') || '未記載'}</p><p className="text-sm">新値: {item.operation === 'clear' ? 'クリア' : item.values.map(v => `${v.text}${v.knowledge ? `（${KNOWLEDGE_LABELS[v.knowledge]}）` : ''}`).join(' / ')}</p></> : 'description' in item ? <p className="text-sm whitespace-pre-wrap">{item.description}</p> : <p className="text-sm">{previous.requirements.find(r => r.id === item.requirementId)?.description ?? item.requirementId} → {STATUS_LABELS[item.status] ?? item.status}</p>}
    {item.warnings.map((w, i) => <p key={i} className={narrativeWarning}>{w}</p>)}
    <blockquote className="text-sm text-gray-800 dark:text-gray-100 border-l-2 border-indigo-400 pl-3 whitespace-pre-wrap break-words">{item.source.quote}</blockquote>
    {item.source.kind === 'author' && <p className={narrativeMuted}>作者の修正理由: {item.source.reason || '未記入'}</p>}
    <div className="flex flex-wrap gap-2"><button className={button} onClick={() => onSource(item.source)}>出典を表示</button><button className={button} disabled={disabled} onClick={() => setEditing(!editing)}>{editing ? '編集を閉じる' : '修正する'}</button></div>
    {!!item.source.alternatives?.length && <label className="block text-sm space-y-1">引用位置を選択<select className={input} disabled={disabled} value="" onChange={e => {
      const body = project.chapters.find(c => c.id === item.source.chapterId)?.draft ?? '';
      const match = findQuote(body, item.source.quote).find(m => m.start === Number(e.target.value));
      if (!match) return;
      const source = { ...item.source, ...match, alternatives: undefined };
      onSave({ ...item, source, ...('values' in item ? { values: item.values.map(v => ({ ...v, source })) } : {}) });
    }}><option value="">位置を選択してください</option>{item.source.alternatives.map(start => <option key={start} value={start}>{start}文字目: {(project.chapters.find(c => c.id === item.source.chapterId)?.draft ?? '').slice(Math.max(0, start - 30), start + 80)}</option>)}</select></label>}
    {editing && <fieldset disabled={disabled} className="min-w-0 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3 text-sm"><legend className="text-xs font-semibold text-gray-500 dark:text-gray-400">作者による修正</legend>
      {'field' in edited && <>
        <label className="block">人物<select className={input} value={edited.characterId} onChange={e => change({ ...edited, characterId: e.target.value })}><option value="">人物を選択</option>{project.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {!character && <div className="space-y-2"><label>新規人物の名前<input className={input} value={newName} onChange={e => setNewName(e.target.value)} /></label><button className={button} disabled={!newName.trim()} onClick={() => onRegister(newName.trim())}>人物設定に新規登録</button><p className={narrativeMuted}>登録後は先頭章から状態を再確認してください。この提案は自動では採用されません。</p></div>}
        <label className="block">項目<select className={input} value={edited.field} onChange={e => change({ ...edited, field: e.target.value as CharacterChange['field'] })}>{FIELDS.map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}</select></label>
        <label className="block">操作<select className={input} value={edited.operation} onChange={e => change({ ...edited, operation: e.target.value as 'set' | 'clear', values: e.target.value === 'clear' ? [] : edited.values })}><option value="set">値を設定</option><option value="clear">値をクリア</option></select></label>
        {edited.operation === 'set' && <>
          {edited.values.map((v, i) => <div key={v.id} className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2"><label>値<textarea className={input} value={v.text} onChange={e => change({ ...edited, values: edited.values.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} /></label>
            {edited.field === 'knowledge' && <label>認識の種別<select className={input} value={v.knowledge ?? ''} onChange={e => change({ ...edited, values: edited.values.map((x, j) => j === i ? { ...x, knowledge: e.target.value as 'known' } : x) })}><option value="">選択してください</option>{(Object.keys(KNOWLEDGE_LABELS) as Array<keyof typeof KNOWLEDGE_LABELS>).map(k => <option key={k} value={k}>{KNOWLEDGE_LABELS[k]}</option>)}</select></label>}
            <label>関連する人物<select className={input} value={v.relatedCharacterId ?? ''} onChange={e => change({ ...edited, values: edited.values.map((x, j) => j === i ? { ...x, relatedCharacterId: e.target.value || undefined } : x) })}><option value="">なし</option>{project.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <button className={button} onClick={() => change({ ...edited, values: edited.values.filter((_, j) => i !== j) })}>この値を削除</button>
          </div>)}
          <button className={button} onClick={() => change({ ...edited, values: [...edited.values, { id: crypto.randomUUID(), text: '', source: edited.source }] })}>値を追加</button>
        </>}
      </>}
      {'description' in edited && <label className="block">内容<textarea className={input} value={edited.description} onChange={e => change({ ...edited, description: e.target.value })} /></label>}
      {'characterIds' in edited && <fieldset><legend>関連する人物</legend>{project.characters.map(c => <label key={c.id} className="inline-flex gap-1 mr-3"><input type="checkbox" checked={edited.characterIds.includes(c.id)} onChange={e => change({ ...edited, characterIds: e.target.checked ? [...edited.characterIds, c.id] : edited.characterIds.filter(id => id !== c.id) })} />{c.name}</label>)}{edited.characterIds.filter(id => !project.characters.some(c => c.id === id)).map(id => <button key={id} className={button} onClick={() => change({ ...edited, characterIds: edited.characterIds.filter(x => x !== id) })}>不明な人物 {id} を外す</button>)}</fieldset>}
      {'kind' in edited && <label className="block">回収予定の章<select className={input} value={edited.plannedChapterId ?? ''} onChange={e => change({ ...edited, plannedChapterId: e.target.value || undefined })}><option value="">未定</option>{project.chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
      {'requirementId' in edited && <><label className="block">状態<select className={input} value={edited.status} onChange={e => change({ ...edited, status: e.target.value as RequirementTransition['status'] })}><option value="open">未解決に戻す</option><option value="resolved">解決</option><option value="deferred">持ち越し</option><option value="dropped">取り下げ</option></select></label><label className="block">持ち越し・取り下げの理由<input className={input} value={edited.reason ?? ''} onChange={e => change({ ...edited, reason: e.target.value })} /></label></>}
      <label className="block">作者の修正理由（必須）<textarea className={input} value={edited.source.kind === 'author' ? edited.source.reason ?? '' : ''} onChange={e => change({ ...edited, source: { ...edited.source, kind: 'author', reason: e.target.value } })} /></label>
      <button className={button} disabled={!edited.source.reason?.trim()} onClick={() => { onSave(edited); setEditing(false); }}>修正を保存して未判断に戻す</button><p className={narrativeMuted}>修正はこのボタンで保存されます。採用判断には保存済みの内容を使います。</p>
    </fieldset>}
  </>;
};
