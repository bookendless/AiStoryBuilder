import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNarrativeContext, generateNarrativeProse, generationSignature } from '../../services/narrative/context';
import { narrativeBudget } from '../../services/narrative/runner';
import { aiService } from '../../services/aiService';
import { generatePreemptiveDraft } from '../../services/preemptive/generatePreemptiveDraft';
import { ensureIndexFresh } from '../../services/rag';
import type { AISettings } from '../../types/ai';
import type { AIRunner } from '../../types/sequel';
import { accept, location, narrativeProject, proposal, source } from './narrativeFixtures';
vi.mock('../../services/rag', () => ({ ensureIndexFresh: vi.fn() }));
const settings: AISettings = { provider: 'local', model: 'local', temperature: 0.7, maxTokens: 1000, localContextLength: 12000 };
const basePrompt = '【執筆指示】3000-6000文字\n【文体と改行のルール】会話は「」で囲む\n章の本文のみを出力してください。';

function analyzedProject() {
  let p = narrativeProject();
  const delta = location(p, 'c1', '港');
  const src = source(p);
  delta.characterChanges.push({ id: 'knowledge-change', source: src, warnings: [], characterId: 'a', field: 'knowledge', operation: 'set', values: [
    { id: 'unknown-value', text: '鍵の持ち主', knowledge: 'explicitlyUnknown', relatedCharacterId: 'a', source: src },
    { id: 'belief-value', text: '鍵は船のもの', knowledge: 'believed', source: src },
    { id: 'known-value', text: '鍵を持っている', knowledge: 'known', source: src },
  ] });
  delta.addEvents.push({ id: 'event-internal-id', description: '港で鍵を受け取った', characterIds: ['a'], source: src, storyTime: '朝', warnings: [] });
  delta.addRequirements.push({ id: 'requirement-internal-id', description: '鍵の持ち主を探す', kind: 'question', status: 'open', characterIds: ['a'], plannedChapterId: 'c3', source: src, warnings: [] });
  p = accept(p, 'c1', delta);
  return p;
}

describe('narrative generation context', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.spyOn(aiService, 'generateContent').mockResolvedValue({ content: '新しい本文', finishReason: 'stop' }); });
  it('preserves the base verbatim and appends only approved analysis with readable names', async () => {
    const p = analyzedProject();
    const pending = proposal(p, 'c2', location(p, 'c2', '未承認の場所'));
    p.narrativeMemory!.proposals.push(pending);
    const built = buildNarrativeContext(p, 'c2', basePrompt, 28000);
    expect(built.prompt.startsWith(basePrompt + '\n\n')).toBe(true);
    for (const text of ['アキ／現在地: 港', '[知らない・未解明] 鍵の持ち主', '[そう信じている（事実とは限らない）]', '[知っている]', '相手: アキ', '関係人物: アキ', '回収予定: 「第三章」・未実現', '「第一章」／朝: 港で鍵を受け取った']) expect(built.prompt).toContain(text);
    for (const excluded of ['未承認の場所', '後続章だけの秘密', '未来の計画', '鍵を渡した', 'event-internal-id', 'requirement-internal-id', 'unknown-value', 'draftHash', 'chapterId', 'characterIds', 'foreshadowingRefs', 'lf1:']) expect(built.prompt).not.toContain(excluded);
    await generateNarrativeProse(p, 'c2', basePrompt, settings);
    expect(ensureIndexFresh).not.toHaveBeenCalled();
    expect(vi.mocked(aiService.generateContent).mock.calls[0][0]).toMatchObject({ prompt: built.prompt, retryLimit: 0, purpose: 'prose' });
  });
  it('fails before API calls on stale/missing state and mandatory budget overflow', async () => {
    const p = narrativeProject();
    await expect(generateNarrativeProse(p, 'c2', basePrompt, settings)).rejects.toThrow('確認');
    await expect(generateNarrativeProse(p, 'c1', basePrompt + '文体見本'.repeat(3000), settings)).rejects.toThrow('入力上限');
    expect(() => buildNarrativeContext(p, 'c1', '', 28000)).toThrow('執筆プロンプト');
    expect(aiService.generateContent).not.toHaveBeenCalled();
  });
  it('packs optional past events as whole items without cutting the writing prompt or state', async () => {
    const p = analyzedProject();
    const full = buildNarrativeContext(p, 'c2', basePrompt, 28000);
    const built = buildNarrativeContext(p, 'c2', basePrompt, full.prompt.length - 1);
    expect(built.omittedIds).toEqual(['event-internal-id']);
    expect(built.prompt).not.toContain('港で鍵を受け取った');
    expect(built.prompt.startsWith(basePrompt)).toBe(true);
    expect(built.prompt).toContain('鍵の持ち主を探す');
    expect(narrativeBudget(settings)).toBeLessThan(settings.localContextLength!);
    vi.mocked(aiService.generateContent).mockResolvedValue({ content: '途中', finishReason: 'length' });
    await expect(generateNarrativeProse(p, 'c2', basePrompt, settings)).rejects.toThrow('完了');
  });
  it('does not inject resolved requirements or analysis of the current/future chapter', () => {
    let p = analyzedProject();
    const delta = location(p, 'c2', '森');
    delta.transitionRequirements.push({ id: 'resolved-id', requirementId: 'requirement-internal-id', status: 'resolved', source: source(p, 'c2'), warnings: [] });
    p = accept(p, 'c2', delta);
    expect(buildNarrativeContext(p, 'c2', basePrompt, 28000).prompt).toContain('アキ／現在地: 港');
    const prompt = buildNarrativeContext(p, 'c3', basePrompt, 28000).prompt;
    expect(prompt).toContain('アキ／現在地: 森');
    expect(prompt).not.toContain('鍵の持ち主を探す');
  });
  it('retains the complete legacy preemptive prompt, including characters first appearing in this chapter', async () => {
    let p = narrativeProject();
    p.mainGenre = '日常ミステリー'; p.subGenre = '恋愛小説'; p.targetReader = '全年齢';
    p.characters.push({ id: 'new-character-id', name: 'クレフ', role: '情報屋', appearance: '濃紫の髪', personality: '軽妙', background: '新登場人物の背景', speechStyle: '独特の口調' });
    p.chapters[1] = { ...p.chapters[1], draft: '', characters: ['クレフ', 'アキ'] };
    p.relationships = [{ id: 'relation-id', from: 'a', to: 'new-character-id', type: 'friend', strength: 3, description: '大切な友人', fromCallsTo: 'クレフさん', toCallsFrom: 'アキちゃん' }];
    p.writingStyle = { style: '現代小説風', perspective: '三人称', rhythm: '緩やか', tone: '静かな温もり' };
    p.styleSample = '作者の文体見本';
    p.plot = { ...p.plot, structure: 'beat-sheet', bs1: '選択中の導入', bs7: '選択中の結末', act1: '非選択構造の不要情報', hj1: '別構造の不要情報' };
    p = accept(p, 'c1', location(p, 'c1', '港'));
    const run = vi.fn<AIRunner>(async () => '従来の本文');
    await generatePreemptiveDraft({ ...p, narrativeMemory: { ...p.narrativeMemory!, enabled: false } }, { run });
    const original = run.mock.calls[0][0];
    await generatePreemptiveDraft(p, { run, settings });
    const sent = vi.mocked(aiService.generateContent).mock.calls[0][0].prompt;
    expect(sent.startsWith(original + '\n\n')).toBe(true);
    for (const text of ['状態テスト', '日常ミステリー', '恋愛小説', '全年齢', '新登場人物の背景', '独特の口調', '大切な友人', 'クレフさん', 'アキちゃん', '作者の文体見本', '三人称', '緩やか', '静かな温もり', '3000-6000', '会話重視', '臨場感', '文体と改行のルール', '前章までのあらすじ', '直前の章の末尾', '選択中の導入', 'アキ／現在地: 港']) expect(sent).toContain(text);
    for (const text of ['{styleInstruction}', 'new-character-id', 'relation-id', '非選択構造の不要情報', '別構造の不要情報', '後続章だけの秘密']) expect(sent).not.toContain(text);
    expect(run).toHaveBeenCalledOnce();
  });
  it('changes the generation signature when draft or project instructions change', () => {
    const p = accept(narrativeProject()); const before = generationSignature(p, 'c2');
    expect(generationSignature({ ...p, title: '改題' }, 'c2')).not.toBe(before);
    expect(generationSignature({ ...p, targetReader: '子供向け' }, 'c2')).not.toBe(before);
    p.chapters[1].draft = '編集中'; expect(generationSignature(p, 'c2')).not.toBe(before);
  });
});
