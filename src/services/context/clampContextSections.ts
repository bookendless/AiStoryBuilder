/**
 * 非RAG経路のコンテキスト予算ガード
 *
 * 関連情報検索（RAG）が無効なとき、キャラクター・相関図・世界観・用語集・タイムラインは
 * **全量がそのままプロンプトに連結される**。作品が育つほどここが膨らみ、最終的には
 * プロンプト全体のCAPに当たって中抜きされる。中抜きは中間を削るので、どの設定が
 * AIに渡らなかったかは誰にも分からない。
 *
 * ここで先に予算内へ収めておけば、削る順序と削った事実が決定的になる。
 * 優先順位は「人物 → 関係 → 用語 → 世界観 → 時系列」。人物と関係は当該場面の描写に
 * 直接効くのに対し、時系列は全体把握用で1章の執筆には効きにくいため後ろに置く。
 */

export interface ContextSection {
    /** 【】付きの見出し（例: 【重要用語集】） */
    heading: string;
    /** 見出し配下の本文。行区切りのリストを想定する */
    body: string;
}

/** セクションの途中を切ったことを示す注記 */
export const OMISSION_NOTE = '…（文字数の都合で以下を省略）';

/** セクションごと落としたことを示す注記の前置き */
const OMITTED_SECTIONS_PREFIX = '（文字数の都合で次の情報を省略: ';

/** セクションを最低これだけ入らないなら、そのセクションごと落とす */
const MIN_USEFUL_SECTION = 80;

const buildOmittedNote = (headings: string[]): string =>
    headings.length === 0 ? '' : `\n\n${OMITTED_SECTIONS_PREFIX}${headings.join('・')}）`;

/** 行境界で maxLength 以内に切り詰める。切り詰めたら注記を付ける */
const clipLines = (body: string, maxLength: number): string | null => {
    if (body.length <= maxLength) return body;

    const lines = body.split('\n');
    const kept: string[] = [];
    let used = 0;
    for (const line of lines) {
        // 注記のぶんを残しておく
        if (used + line.length + 1 > maxLength - OMISSION_NOTE.length) break;
        kept.push(line);
        used += line.length + 1;
    }
    if (kept.length === 0) return null;
    return `${kept.join('\n')}\n${OMISSION_NOTE}`;
};

/**
 * キャラクター本文と付随セクションを予算内に収めて連結する。
 *
 * @param characters 先頭に置くキャラクター整形済みテキスト（最優先で残す）
 * @param sections 見出し付きセクション。**渡された順が優先順位**
 * @param budget 全体の文字数予算
 */
export function clampContextSections(
    characters: string,
    sections: ContextSection[],
    budget: number
): string {
    const parts: string[] = [];
    const usable = sections.filter(s => s.body);

    // セクションを丸ごと落とした場合の注記ぶんを先に確保する。
    // これが無いと、予算ちょうどで打ち切られたときに「設定がまるごと消えたのに
    // プロンプト上は何も起きていないように見える」状態になる
    const worstCaseNote = buildOmittedNote(usable.map(s => s.heading));
    let remaining = Math.max(0, budget) - worstCaseNote.length;

    // キャラクターは最優先。ただし単体で予算を食い潰す場合は切り詰める
    const clippedCharacters = characters.length <= remaining
        ? characters
        : clipLines(characters, remaining);
    if (clippedCharacters) {
        parts.push(clippedCharacters);
        remaining -= clippedCharacters.length;
    }

    const omitted: string[] = [];
    for (let i = 0; i < usable.length; i++) {
        const { heading, body } = usable[i];
        const overhead = `\n\n${heading}\n`.length;
        const available = remaining - overhead;

        const clipped = available < MIN_USEFUL_SECTION
            ? null
            : body.length <= available ? body : clipLines(body, available);

        if (!clipped) {
            // 以降は優先順位がさらに低いので、まとめて省略として記録する
            omitted.push(...usable.slice(i).map(s => s.heading));
            break;
        }

        parts.push(`\n\n${heading}\n${clipped}`);
        remaining -= overhead + clipped.length;
    }

    return parts.join('') + buildOmittedNote(omitted);
}
