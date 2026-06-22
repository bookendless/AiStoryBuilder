/**
 * 列挙フェーズ: 本文全体から登場人物を抽出する（map → merge → 仕上げ統合）
 *
 * キャラクターは「網羅性」が重要なため、要約からではなく本文全体を走査して抽出する。
 * 同一人物が愛称・呼称違い（山田太郎 / 太郎 / タロちゃん）で重複登録されるのを防ぐため、
 * 3段構えで名寄せする:
 *   1. AIに別名（aliases）も抽出させ、名前＋別名のキーで名寄せ統合する
 *   2. 既知の登場人物リストを後続チャンクのプロンプトに注入し、呼称を揃えさせる
 *   3. 最後に1回だけAIに同一人物グループの判定をさせる（失敗しても未統合のまま続行）
 */

import { Character } from '../../types/project';
import { AIRunner, SequelProgress } from '../../types/sequel';
import { AISettings } from '../../types/ai';
import { getInputCharBudget } from '../summarization/tokenBudget';
import { parseJsonLoose } from '../summarization/parseJson';
import { chunkProse } from './chunkProse';
import { buildCharacterExtractPrompt, buildCharacterConsolidatePrompt } from '../prompts/import';
import {
    IMPORT_PROMPT_HARD_CAP,
    IMPORT_KNOWN_CHARS_MAX_CHARS,
    IMPORT_KNOWN_CHAR_ALIAS_LIMIT,
} from './constants';

/** AIが1チャンクから返すキャラ候補（未確定の生データ） */
export interface RawCharacter {
    name?: string;
    /** 本文中で同一人物に使われている他の呼称（あだ名・名字のみ・敬称付き など） */
    aliases?: string[];
    role?: string;
    appearance?: string;
    personality?: string;
    background?: string;
    speechStyle?: string;
}

interface ExtractCharactersOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
    onProgress?: (p: SequelProgress) => void;
}

/** 名寄せ用にゆらぎ（空白・括弧・大小）を吸収した正規化キーを作る */
export function normalizeName(name: string): string {
    // JS の \s は全角スペース(U+3000)も含むため、空白類はこれだけで除去できる
    return (name || '')
        .replace(/\s/g, '')
        .replace(/[「」『』（）()【】[\]]/g, '')
        .toLowerCase();
}

/** 2つの記述を重複なく結合する（片方が空、または包含関係ならまとめる） */
function mergeDescription(a: string, b: string): string {
    const t1 = (a || '').trim();
    const t2 = (b || '').trim();
    if (!t1) return t2;
    if (!t2) return t1;
    if (t1.includes(t2)) return t1;
    if (t2.includes(t1)) return t2;
    return `${t1}\n${t2}`;
}

/** 名寄せ中の人物1人分の作業データ */
interface MergeEntry {
    /** 初出順（橋渡し統合時の生存者選択と、出力順の基準） */
    order: number;
    /** 現時点の代表名（本文表記のまま） */
    name: string;
    /** 正規化キー → 初出の表記。代表名以外の呼称を保持する */
    aliases: Map<string, string>;
    role: string;
    appearance: string;
    personality: string;
    background: string;
    speechStyle: string;
}

/**
 * キーの由来。alias 同士の一致だけでは統合しない
 * （複数人が「先生」のような汎用呼称を別名に持つ場合の誤統合を防ぐ）
 */
type KeyOrigin = 'name' | 'alias';

/** チャンクを逐次取り込みながら名寄せするための状態 */
export interface MergeState {
    /** 正規化キー → 帰属する人物と、そのキーの由来 */
    registry: Map<string, { entry: MergeEntry; origin: KeyOrigin }>;
    /** 吸収されていない（生きている）人物の集合 */
    live: Set<MergeEntry>;
    nextOrder: number;
}

export function createMergeState(): MergeState {
    return { registry: new Map(), live: new Set(), nextOrder: 0 };
}

/**
 * 候補名が現在の代表名を正規化形で真に包含する場合のみ代表名を昇格する（太郎 → 山田太郎）。
 * 包含関係はあくまで「既に同一人物と確定した名前同士」の表示名選びにのみ使い、
 * 包含だけを根拠に別エントリを統合することはしない（山田父と山田太郎の誤統合を防ぐ）。
 */
function adoptCanonicalName(entry: MergeEntry, candidate: string): void {
    const curKey = normalizeName(entry.name);
    const candKey = normalizeName(candidate);
    if (!candKey || candKey === curKey) return;
    if (candKey.includes(curKey) && candKey.length > curKey.length) {
        // 旧代表名は別名へ降格して表記を残す
        if (!entry.aliases.has(curKey)) entry.aliases.set(curKey, entry.name);
        entry.name = candidate;
        entry.aliases.delete(candKey);
    }
}

/** absorbed を survivor に吸収し、レジストリのキーを生存者へ付け替える（橋渡し統合） */
function foldEntry(state: MergeState, survivor: MergeEntry, absorbed: MergeEntry): void {
    survivor.role = survivor.role || absorbed.role;
    survivor.appearance = mergeDescription(survivor.appearance, absorbed.appearance);
    survivor.personality = mergeDescription(survivor.personality, absorbed.personality);
    survivor.background = mergeDescription(survivor.background, absorbed.background);
    if (!survivor.speechStyle && absorbed.speechStyle) survivor.speechStyle = absorbed.speechStyle;

    adoptCanonicalName(survivor, absorbed.name);
    const survivorKey = normalizeName(survivor.name);
    const absorbedNameKey = normalizeName(absorbed.name);
    if (absorbedNameKey !== survivorKey && !survivor.aliases.has(absorbedNameKey)) {
        survivor.aliases.set(absorbedNameKey, absorbed.name);
    }
    for (const [key, surface] of absorbed.aliases) {
        if (key !== survivorKey && !survivor.aliases.has(key)) survivor.aliases.set(key, surface);
    }

    for (const reg of state.registry.values()) {
        if (reg.entry === absorbed) reg.entry = survivor;
    }
    state.live.delete(absorbed);
}

/** 1人分の生データを名寄せ状態に取り込む */
function addRawCharacter(state: MergeState, rc: RawCharacter): void {
    const name = (rc?.name || '').trim();
    if (!name) return;
    const nameKey = normalizeName(name);
    if (!nameKey) return;

    // 別名キーを正規化（空・代表名と同一・1文字の汎用語・重複は捨てる）
    const aliasPairs: Array<{ key: string; surface: string }> = [];
    const seenAliasKeys = new Set<string>();
    for (const a of (Array.isArray(rc.aliases) ? rc.aliases : [])) {
        const surface = (a || '').trim();
        const key = normalizeName(surface);
        if (!key || key === nameKey || key.length <= 1 || seenAliasKeys.has(key)) continue;
        seenAliasKeys.add(key);
        aliasPairs.push({ key, surface });
    }

    // 一致候補の収集: name キーは由来を問わず一致、alias キーは相手側が name 由来の場合のみ一致
    //（少なくとも片側が「本文で名前として使われた」キーでなければ統合しない）
    const matched: MergeEntry[] = [];
    const pushMatch = (e: MergeEntry | undefined) => {
        if (e && !matched.includes(e)) matched.push(e);
    };
    pushMatch(state.registry.get(nameKey)?.entry);
    for (const { key } of aliasPairs) {
        const reg = state.registry.get(key);
        if (reg && reg.origin === 'name') pushMatch(reg.entry);
    }

    let target: MergeEntry;
    if (matched.length === 0) {
        target = {
            order: state.nextOrder++,
            name,
            aliases: new Map(),
            role: (rc.role || '').trim(),
            appearance: (rc.appearance || '').trim(),
            personality: (rc.personality || '').trim(),
            background: (rc.background || '').trim(),
            speechStyle: (rc.speechStyle || '').trim(),
        };
        state.live.add(target);
        state.registry.set(nameKey, { entry: target, origin: 'name' });
    } else {
        // 生存者 = 最初に登場した人物。残りはそこへ吸収する
        // （この生データが複数エントリに同時一致した場合 = 別名が橋渡しした同一人物）
        matched.sort((a, b) => a.order - b.order);
        target = matched[0];
        for (const absorbed of matched.slice(1)) {
            foldEntry(state, target, absorbed);
        }

        target.role = target.role || (rc.role || '').trim();
        target.appearance = mergeDescription(target.appearance, rc.appearance || '');
        target.personality = mergeDescription(target.personality, rc.personality || '');
        target.background = mergeDescription(target.background, rc.background || '');
        if (!target.speechStyle && rc.speechStyle?.trim()) {
            target.speechStyle = rc.speechStyle.trim();
        }

        adoptCanonicalName(target, name);

        // name キーを登録（別名由来で登録済みだった場合は name 由来へ昇格）
        const nameReg = state.registry.get(nameKey);
        if (!nameReg) {
            state.registry.set(nameKey, { entry: target, origin: 'name' });
        } else if (nameReg.entry === target && nameReg.origin === 'alias') {
            nameReg.origin = 'name';
        }
    }

    // 別名を登録する。既に他の人物が使っているキーは奪わない（先着優先）
    const targetNameKey = normalizeName(target.name);
    for (const { key, surface } of aliasPairs) {
        if (!state.registry.has(key)) {
            state.registry.set(key, { entry: target, origin: 'alias' });
        }
        if (key !== targetNameKey && !target.aliases.has(key)) {
            target.aliases.set(key, surface);
        }
    }
    // 代表名にならなかった生データの name も呼称として保持する
    if (nameKey !== targetNameKey && !target.aliases.has(nameKey)) {
        target.aliases.set(nameKey, name);
    }
}

/** 1チャンク分のキャラ候補リストを名寄せ状態に取り込む */
export function addChunkToMerge(state: MergeState, list: RawCharacter[]): void {
    if (!Array.isArray(list)) return;
    for (const rc of list) {
        addRawCharacter(state, rc);
    }
}

/** 名寄せ状態を確定し、Character 配列へ変換する（別名は破棄し、従来と同じ形にする） */
export function finalizeMerge(state: MergeState, idPrefix: string = 'import-char'): Character[] {
    let counter = 0;
    return Array.from(state.live)
        .sort((a, b) => a.order - b.order)
        .map(e => ({
            id: `${idPrefix}-${Date.now()}-${counter++}`,
            name: e.name,
            role: e.role,
            appearance: e.appearance,
            personality: e.personality,
            background: e.background,
            ...(e.speechStyle ? { speechStyle: e.speechStyle } : {}),
        }));
}

/** プロンプト注入用に、現時点の既知人物（代表名＋別名）を初出順で取り出す */
export function getKnownCharacterEntries(state: MergeState): Array<{ name: string; aliases: string[] }> {
    return Array.from(state.live)
        .sort((a, b) => a.order - b.order)
        .map(e => ({ name: e.name, aliases: Array.from(e.aliases.values()) }));
}

/**
 * 既知人物リストを「名前（別名: a、b）」形式の1行に整形する。
 * 上限文字数を超える分は末尾の人物ごと落とす（初出の人物を優先して残す）。
 */
export function formatKnownCharacters(
    entries: Array<{ name: string; aliases: string[] }>,
    maxChars: number = IMPORT_KNOWN_CHARS_MAX_CHARS,
    aliasLimit: number = IMPORT_KNOWN_CHAR_ALIAS_LIMIT
): string {
    const parts: string[] = [];
    let length = 0;
    for (const e of entries) {
        const aliases = e.aliases.slice(0, aliasLimit);
        const text = aliases.length ? `${e.name}（別名: ${aliases.join('、')}）` : e.name;
        const added = text.length + (parts.length > 0 ? 1 : 0); // 区切りの「、」分
        if (length + added > maxChars) break;
        parts.push(text);
        length += added;
    }
    return parts.join('、');
}

/**
 * チャンクごとのキャラ候補リスト群を、名前＋別名で名寄せして1つの Character 配列に統合する。
 * AIに依存しない純粋関数なのでユニットテスト可能。
 *
 * @param chunkResults チャンクごとの RawCharacter[]（抽出順）
 * @param idPrefix     生成する Character.id の接頭辞（既定 'import-char'）
 */
export function mergeCharacters(chunkResults: RawCharacter[][], idPrefix: string = 'import-char'): Character[] {
    const state = createMergeState();
    for (const list of chunkResults) {
        addChunkToMerge(state, list);
    }
    return finalizeMerge(state, idPrefix);
}

/**
 * AIが返した同一人物グループ（1始まりの番号の配列の配列）を Character 配列に適用する。
 * 番号を共有するグループ同士は1つにまとめ、無効な番号・1人だけのグループは無視する。
 * 各グループの生存者は最も若い番号の人物（id と name を保持）。配列の順序は維持する。
 */
export function applyConsolidationGroups(characters: Character[], groups: number[][]): Character[] {
    if (!Array.isArray(groups) || groups.length === 0) return characters;
    const n = characters.length;

    // Union-Find で「番号を共有するグループ」を1つの集合にまとめる
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a: number, b: number) => { parent[find(b)] = find(a); };

    for (const group of groups) {
        if (!Array.isArray(group)) continue;
        const indices = group
            .filter(i => Number.isInteger(i) && i >= 1 && i <= n)
            .map(i => i - 1);
        for (let k = 1; k < indices.length; k++) union(indices[0], indices[k]);
    }

    // 各集合で最初に現れた人物を生存者とし、後続を吸収する（元の順序を維持）
    const survivorByRoot = new Map<number, Character>();
    const result: Array<Character | null> = characters.map(() => null);
    characters.forEach((c, i) => {
        const root = find(i);
        const survivor = survivorByRoot.get(root);
        if (!survivor) {
            const copy = { ...c };
            survivorByRoot.set(root, copy);
            result[i] = copy;
        } else {
            survivor.role = survivor.role || c.role;
            survivor.appearance = mergeDescription(survivor.appearance, c.appearance);
            survivor.personality = mergeDescription(survivor.personality, c.personality);
            survivor.background = mergeDescription(survivor.background, c.background);
            if (!survivor.speechStyle && c.speechStyle) survivor.speechStyle = c.speechStyle;
        }
    });
    return result.filter((c): c is Character => c !== null);
}

/** 仕上げ統合プロンプト用に、人物リストを番号付き（1始まり）の短い一覧へ整形する */
function buildConsolidationDigest(characters: Character[], aliasLists: string[][]): string {
    const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);
    return characters
        .map((c, i) => {
            const aliases = (aliasLists[i] || []).slice(0, IMPORT_KNOWN_CHAR_ALIAS_LIMIT);
            const parts = [
                `${i + 1}. ${c.name}${aliases.length ? `（別名: ${aliases.join('、')}）` : ''}`,
                c.role ? `役割: ${clip(c.role, 20)}` : '',
                c.personality ? `性格: ${clip(c.personality, 60)}` : '',
                c.background ? `背景: ${clip(c.background, 60)}` : '',
            ].filter(Boolean);
            return parts.join('｜');
        })
        .join('\n');
}

/**
 * 本文全体から登場人物を抽出する。
 * 各チャンクで抽出（既知人物リストを注入）→ 名前＋別名で名寄せ統合 →
 * 最後にAIで同一人物グループを1回だけ判定して仕上げる。
 * チャンク単位の失敗・仕上げ統合の失敗はスキップして続行する。
 */
export async function extractCharacters(prose: string, options: ExtractCharactersOptions): Promise<Character[]> {
    const { settings, run, signal, onProgress } = options;
    // 既知人物リストの注入分を本文予算から先取りし、サニタイズによる末尾欠落を防ぐ
    const budget = Math.max(800, getInputCharBudget(settings, IMPORT_PROMPT_HARD_CAP) - IMPORT_KNOWN_CHARS_MAX_CHARS);
    const chunks = chunkProse(prose, budget);

    const state = createMergeState();

    for (let i = 0; i < chunks.length; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        onProgress?.({ phase: '登場人物の抽出', current: i + 1, total: chunks.length });

        const known = formatKnownCharacters(getKnownCharacterEntries(state));

        let raw: string;
        try {
            raw = await run(
                buildCharacterExtractPrompt(chunks[i].text, i + 1, chunks.length, known),
                { signal, temperature: 0.2, maxPromptLength: IMPORT_PROMPT_HARD_CAP }
            );
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') throw err;
            continue; // このチャンクは諦めて次へ
        }

        const parsed = parseJsonLoose<{ characters: RawCharacter[] }>(raw);
        if (parsed?.characters && Array.isArray(parsed.characters)) {
            addChunkToMerge(state, parsed.characters);
        }
    }

    let characters = finalizeMerge(state);

    // 仕上げの同一人物判定（AI呼び出しは1回だけ）。任意工程なので失敗しても未統合のまま返す
    if (characters.length >= 2) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        onProgress?.({ phase: '登場人物の統合', current: 1, total: 1 });

        const aliasLists = getKnownCharacterEntries(state).map(e => e.aliases);
        const digest = buildConsolidationDigest(characters, aliasLists);
        // 一覧が予算を超えるほど大所帯なら、部分リストで誤判定させるより統合パス自体を省略する
        if (digest.length <= getInputCharBudget(settings, IMPORT_PROMPT_HARD_CAP)) {
            try {
                const raw = await run(
                    buildCharacterConsolidatePrompt(digest),
                    { signal, temperature: 0.2, maxPromptLength: IMPORT_PROMPT_HARD_CAP }
                );
                const parsed = parseJsonLoose<{ groups: number[][] }>(raw);
                if (parsed?.groups) {
                    characters = applyConsolidationGroups(characters, parsed.groups);
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') throw err;
                // 統合パスは省略可能: レビュー画面でユーザーが手動修正できる
            }
        }
    }

    return characters;
}
