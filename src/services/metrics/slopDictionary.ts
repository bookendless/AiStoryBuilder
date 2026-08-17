/**
 * 定型表現（常套句）の辞書
 *
 * LLMが過剰に生産しやすい言い回しと、Web小説で摩耗した定型表現を集めたもの。
 *
 * **重要: ここに載っている表現は「間違い」ではない**。どれも日本語として正当で、
 * 意図して使えば効果を持つ。この辞書の用途は良し悪しの判定ではなく、
 * 「同じ手癖がどれくらいの密度で出ているか」を数えて書き手に見せることにある。
 * したがって指標は絶対値ではなく、章どうし・修正前後の**比較**で読む。
 *
 * SYSTEM_PROMPT（prompts/common.ts）の禁止例はこの辞書から組み立てる。
 * プロンプト側に例を直書きすると、辞書を増やしても計測とプロンプトがずれるため。
 */

export interface SlopPattern {
    /** 表示用の短いラベル */
    label: string;
    /** 検出パターン。`〜` に相当する箇所は文をまたがないよう文字数を制限する */
    pattern: RegExp;
    /**
     * SYSTEM_PROMPT の例示に使う表記。指定した項目だけが、この配列の順で
     * プロンプトの括弧内に並ぶ（prompts/common.ts の文言を変えないための固定順）。
     */
    promptExample?: string;
}

/** 文をまたがずに `〜` を埋めるためのワイルドカード（読点は許す） */
const GAP = '[^。！？\\n]{0,30}';

export const SLOP_PATTERNS: SlopPattern[] = [
    // --- 翻訳調・説明癖 ---
    {
        // 「かのよう」に限定すると、実際に多い「まるで夢のようだった」を取り落とす。
        // 「か」はワイルドカード側に吸収させて両方拾う
        label: 'まるで〜のよう',
        pattern: new RegExp(`まるで${GAP}のよう`, 'g'),
        promptExample: 'まるで〜かのようだった',
    },
    {
        label: '〜と言っても過言ではない',
        pattern: /と言っても過言では?ない/g,
        promptExample: '〜と言っても過言ではない',
    },
    {
        label: 'それは〜の始まりだった',
        pattern: new RegExp(`それ(は|が)${GAP}の始まりだった`, 'g'),
        promptExample: 'それは…の始まりだった',
    },
    { label: '〜に他ならない', pattern: /に(他|ほか)ならな(い|かった)/g },
    { label: '言うまでもなく', pattern: /言うまでもな(く|い)/g },
    { label: '〜と言えるだろう', pattern: /と(言|い)えるだろう/g },
    { label: '〜のである', pattern: /のであ(る|った)。/g },
    { label: '知る由もない', pattern: /知る由もな(い|かった)/g },
    { label: '〜に過ぎなかった', pattern: /に(過|す)ぎな(い|かった)/g },

    // --- 感情の総括（描写を省いて名前で片付ける言い回し） ---
    { label: '息を呑む', pattern: /息を(呑|の)(む|んだ|み)/g },
    { label: '言葉を失う', pattern: /言葉を失(う|った|い)/g },
    { label: '胸が締め付けられる', pattern: /胸が(締|し)め付けられ/g },
    { label: '背筋が凍る', pattern: /背筋が(凍|こお)(る|った|り)/g },
    { label: '鳥肌が立つ', pattern: /鳥肌が立(つ|った|ち)/g },
    { label: '心臓が跳ねる', pattern: /心臓が(跳|は)ね(る|た)/g },
    { label: '言葉にできない', pattern: /言葉に(でき|出来)な(い|かった)/g },
    { label: '何とも言えない', pattern: /(何|なん)とも(言|い)えな(い|かった)/g },
    { label: '〜せずにはいられない', pattern: /せずには(い|居)られな(い|かった)/g },

    // --- 場面の定型 ---
    { label: '時が止まったよう', pattern: /時(が|は)止ま(った|る)/g },
    { label: '一瞬の静寂', pattern: /(一瞬の静寂|静寂が(訪|おとず)れ|静寂が支配)/g },
    { label: '空気が張り詰める', pattern: /空気が(張り詰|凍り付|こおりつ)/g },
    { label: 'その瞬間', pattern: /その瞬間(、|。)/g },
    { label: '運命が動き出す', pattern: /運命(の歯車|が動き出|は動き出)/g },
    { label: '〜と言わんばかり', pattern: /と(言|い)わんばかり/g },
    { label: '目を細める', pattern: /目を(細|ほそ)め(る|た)/g },
    { label: '首を横に振る', pattern: /首を(横に|縦に)振(る|った|り)/g },
];

/**
 * SYSTEM_PROMPT の括弧内に並べる例示文字列を組み立てる。
 * 例: 「まるで〜かのようだった」「〜と言っても過言ではない」「それは…の始まりだった」
 */
export const buildSlopPromptExamples = (): string =>
    SLOP_PATTERNS.filter(p => p.promptExample)
        .map(p => `「${p.promptExample}」`)
        .join('');
