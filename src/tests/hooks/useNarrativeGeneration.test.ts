import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIGeneration } from '../../components/steps/draft/hooks/useAIGeneration';
import { generateNarrativeProse, NarrativeGenerationError } from '../../services/narrative/context';
import { narrativeProject } from '../services/narrativeFixtures';
import { aiService } from '../../services/aiService';
import type { ProposeResultInput } from '../../contexts/usePendingResult';
import type { Project } from '../../types/project';
let current: Project;
const onError = vi.fn();
const proposed: ProposeResultInput[] = [];
const proposeResult = vi.fn((input: ProposeResultInput) => { proposed.push(input); return 'pending'; });
const openResult = vi.fn();
const completeTask = vi.fn();
vi.mock('../../contexts/usePendingResult', () => ({ usePendingResult: () => ({ proposeResult, openResult, removeResult: vi.fn() }) }));
const commit = vi.fn(async (change: (p: Project) => Partial<Project>, id: string) => {
  if (current.id !== id) throw new Error('project changed');
  current = { ...current, ...change(current) }; return { generation: 1, project: current };
});
vi.mock('../../contexts/useProject', () => ({ useProject: () => ({ commitProjectUpdate: commit, getCurrentProject: () => current }) }));
vi.mock('../../contexts/useGeneration', () => ({ useGeneration: () => ({ startTask: () => ({ id: 'task', signal: new AbortController().signal }), completeTask, cancelByKey: vi.fn(), isKeyActive: () => false }) }));
vi.mock('../../services/narrative/context', async original => ({ ...await original<typeof import('../../services/narrative/context')>(), generateNarrativeProse: vi.fn() }));
const options = (): Parameters<typeof useAIGeneration>[0] => ({
  currentProject: current, currentChapter: current.chapters[0], draft: current.chapters[0].draft ?? '', selectedChapter: 'c1',
  settings: { provider: 'local', model: 'm', maxTokens: 1000, temperature: 0.5 }, isConfigured: true,
  onDraftUpdate: vi.fn(), onSaveChapterDraft: vi.fn(), onError, onWarning: vi.fn(), onCompletionToast: vi.fn(), addLog: vi.fn(),
  getChapterDetails: () => ({ characters: '', setting: '', mood: '', keyEvents: '', planNotes: '' }), getProjectContextInfo: () => ({ worldSettings: '', glossary: '', relationships: '', plotInfo: '', timeline: '' }),
  buildCustomPrompt: () => '従来の執筆プロンプト', setImprovementLogs: vi.fn(), reviewDraftResult: true,
});
describe('narrative generation apply guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks(); vi.clearAllMocks(); proposed.length = 0; current = narrativeProject();
    vi.mocked(generateNarrativeProse).mockResolvedValue({ response: { content: 'AIの本文', finishReason: 'unknown' }, context: { prompt: '状態付きプロンプト', usedIds: [], omittedIds: [], fingerprint: '' } });
  });
  it('keeps unknown completion in global review even when the target was empty', async () => {
    current.chapters[0].draft = '';
    const { result } = renderHook(() => useAIGeneration(options()));
    await act(async () => result.current.handleAIGenerate());
    expect(proposed[0].draftPreview).toEqual({ oldText: '', newText: 'AIの本文', notice: 'AIの終了理由を取得できませんでした。文章が途中で切れていないか、末尾まで確認してから適用してください。' });
    expect(current.chapters[0].draft).toBe('');
    expect(completeTask).toHaveBeenCalledWith('task');
  });
  it('does not overwrite edits made while the author is reviewing the generated text', async () => {
    const { result } = renderHook(() => useAIGeneration(options()));
    await act(async () => result.current.handleAIGenerate());
    current = { ...current, chapters: current.chapters.map(c => c.id === 'c1' ? { ...c, draft: '作者の最新編集' } : c) };
    await expect(proposed[0].onApply()).rejects.toThrow('編集されています');
    expect(current.chapters[0].draft).toBe('作者の最新編集');
    expect(proposed[0].preview).toBe('AIの本文');
  });
  it('retains a late response after the sidebar unmounts and applies it to its original chapter', async () => {
    let finish!: (value: Awaited<ReturnType<typeof generateNarrativeProse>>) => void;
    vi.mocked(generateNarrativeProse).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const opts = options();
    const { result, unmount } = renderHook(() => useAIGeneration(opts));
    let work!: Promise<void>;
    await act(async () => { work = result.current.handleAIGenerate(); });
    unmount();
    await act(async () => {
      finish({ response: { content: '移動後に届いた本文', finishReason: 'stop' }, context: { prompt: 'prompt', usedIds: [], omittedIds: [], fingerprint: '' } });
      await work;
    });
    expect(proposed).toHaveLength(1);
    expect(openResult).not.toHaveBeenCalled();
    expect(opts.addLog).toHaveBeenCalled();
    await proposed[0].onApply();
    expect(current.chapters[0].draft).toBe('移動後に届いた本文');
    expect(completeTask).toHaveBeenCalledWith('task');
  });
  it('logs and retains completed text even when the project changes while generating', async () => {
    let finish!: (value: Awaited<ReturnType<typeof generateNarrativeProse>>) => void;
    vi.mocked(generateNarrativeProse).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const opts = options(); const original = current;
    const { result } = renderHook(() => useAIGeneration(opts));
    let work!: Promise<void>;
    await act(async () => { work = result.current.handleAIGenerate(); });
    current = { ...current, id: 'another-project' };
    await act(async () => {
      finish({ response: { content: '保留の本文', finishReason: 'stop' }, context: { prompt: 'prompt', usedIds: [], omittedIds: [], fingerprint: '' } });
      await work;
    });
    expect(opts.addLog).toHaveBeenCalled();
    expect(proposed[0].projectId).toBe(original.id);
    await expect(proposed[0].onApply()).rejects.toThrow('project changed');
    current = original;
    await proposed[0].onApply();
    expect(current.chapters[0].draft).toBe('保留の本文');
  });
  it('allows retry after persistence fails following a shared-buffer update', async () => {
    const { result } = renderHook(() => useAIGeneration(options()));
    await act(async () => result.current.handleAIGenerate());
    commit.mockImplementationOnce(async change => { current = { ...current, ...change(current) }; throw new Error('disk failure'); });
    await expect(proposed[0].onApply()).rejects.toThrow('disk failure');
    expect(current.chapters[0].draft).toBe('AIの本文');
    await proposed[0].onApply();
    expect(current.chapters[0].draft).toBe('AIの本文');
  });
  it('passes the existing chapter prompt and all characters through the analysis path', async () => {
    current.characters.push({ id: 'new', name: 'クレフ', role: '情報屋', appearance: '', personality: '', background: '初登場の背景' });
    const opts = options();
    const build = vi.fn(opts.buildCustomPrompt);
    const { result } = renderHook(() => useAIGeneration({ ...opts, buildCustomPrompt: build }));
    await act(async () => result.current.handleAIGenerate());
    expect(build).toHaveBeenCalledOnce();
    expect(build.mock.calls[0][0].projectCharacters).toContain('初登場の背景');
    expect(vi.mocked(generateNarrativeProse).mock.calls[0][2]).toBe('従来の執筆プロンプト');
  });
  it('preserves continue rules, style and relationship context before adding analysis', async () => {
    current.writingStyle = { style: '現代小説風', perspective: '一人称' };
    const opts = options();
    opts.getProjectContextInfo = () => ({ worldSettings: '世界設定', glossary: '用語集', relationships: '呼び方はゼスさん', plotInfo: '', timeline: '' });
    opts.narrativeInstructions = '作者の追加ルール';
    const { result } = renderHook(() => useAIGeneration(opts));
    await act(async () => result.current.handleContinueGeneration());
    const prompt = vi.mocked(generateNarrativeProse).mock.calls[0][2];
    for (const text of [current.chapters[0].draft!, '一人称', '呼び方はゼスさん', '1000〜1500文字', '適度な改行と段落分け', '作者の追加ルール']) expect(prompt).toContain(text);
  });
  it('preserves the existing whole-chapter improvement instructions', async () => {
    const opts = options();
    const { result } = renderHook(() => useAIGeneration(opts));
    await act(async () => result.current.handleChapterImprovement());
    const expected = aiService.buildPrompt('draft', 'improve', { chapterTitle: current.chapters[0].title, chapterSummary: current.chapters[0].summary, currentText: current.chapters[0].draft!, currentLength: current.chapters[0].draft!.length.toString() });
    expect(vi.mocked(generateNarrativeProse).mock.calls[0][2]).toBe(expected);
  });
  it('records a rejected completion and retains partial narrative text for inspection', async () => {
    vi.mocked(generateNarrativeProse).mockRejectedValueOnce(new NarrativeGenerationError('出力上限です', { content: '受信済みの本文', finishReason: 'length' }, { prompt: '送信内容', usedIds: [], omittedIds: [], fingerprint: '' }));
    const opts = options();
    const { result } = renderHook(() => useAIGeneration(opts));
    await act(async () => result.current.handleAIGenerate());
    expect(opts.addLog).toHaveBeenCalledWith(expect.objectContaining({ response: '受信済みの本文', error: '出力上限です' }));
    expect(proposed[0].applyBlockedReason).toBe('出力上限です');
    await expect(proposed[0].onApply()).rejects.toThrow('出力上限');
  });
  it.each(['length', 'blocked'] as const)('retains an ordinary %s draft without applying it, including empty target chapters', async finishReason => {
    current.narrativeMemory!.enabled = false; current.chapters[0].draft = '';
    vi.spyOn(aiService, 'generateContent').mockResolvedValueOnce({ content: '受信済みの未完了本文', finishReason });
    const { result } = renderHook(() => useAIGeneration(options()));
    await act(async () => result.current.handleAIGenerate());
    expect(proposed[0].preview).toBe('受信済みの未完了本文'); expect(typeof proposed[0].applyBlockedReason).toBe('string');
    await expect(proposed[0].onApply()).rejects.toThrow();
    expect(current.chapters[0].draft).toBe(''); expect(onError).toHaveBeenCalled();
  });

  it('shows errors instead of silently finishing an ordinary draft request with empty content', async () => {
    current.narrativeMemory!.enabled = false;
    vi.spyOn(aiService, 'generateContent').mockResolvedValueOnce({ content: '', error: '応答の受信がタイムアウトしました' });
    const { result } = renderHook(() => useAIGeneration(options()));
    await act(async () => result.current.handleAIGenerate());
    expect(onError).toHaveBeenCalledWith('応答の受信がタイムアウトしました', 7000, expect.anything());
    expect(proposed).toHaveLength(0);
  });
  it('keeps an ordinary draft after navigating away while awaiting the API', async () => {
    current.narrativeMemory!.enabled = false;
    let finish!: (value: { content: string }) => void;
    vi.spyOn(aiService, 'generateContent').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useAIGeneration(options()));
    let work!: Promise<void>;
    await act(async () => { work = result.current.handleAIGenerate(); });
    unmount();
    await act(async () => { finish({ content: '通常生成の本文' }); await work; });
    expect(proposed[0].preview).toBe('通常生成の本文');
    await proposed[0].onApply();
    expect(current.chapters[0].draft).toBe('通常生成の本文');
  });
});

describe('narrative context visibility', () => {
  beforeEach(() => { vi.clearAllMocks(); proposed.length = 0; current = narrativeProject(); });
  it('reports past events omitted by the input budget without turning it into a truncation warning', async () => {
    vi.mocked(generateNarrativeProse).mockResolvedValue({ response: { content: 'AIの本文', finishReason: 'stop' }, context: { prompt: 'p', usedIds: ['e1', 'e2'], omittedIds: ['e3'], fingerprint: '' } });
    const { result } = renderHook(() => useAIGeneration(options()));
    await act(async () => result.current.handleAIGenerate());
    expect(proposed[0].draftPreview?.notice).toBeUndefined();
    expect(proposed[0].draftPreview?.info).toBe('確定した過去の出来事 3件のうち 1件は、入力上限のため今回の生成に含めていません（この章との関連が低いものから省略）。');
  });
  it('adds no info when every past event fits', async () => {
    vi.mocked(generateNarrativeProse).mockResolvedValue({ response: { content: 'AIの本文', finishReason: 'stop' }, context: { prompt: 'p', usedIds: ['e1'], omittedIds: [], fingerprint: '' } });
    const { result } = renderHook(() => useAIGeneration(options()));
    await act(async () => result.current.handleAIGenerate());
    expect(proposed[0].draftPreview?.info).toBeUndefined();
  });
});
