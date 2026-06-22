/**
 * 創造ポイント（Phase C）の選択 → 再生成用の指示文を組み立てる。
 *
 * 確認モーダルで作者が複数カードにまたがって選んだ別案（CreativePointSelection[]）を、
 * 1本の指示文にまとめる。生成側パネルの handleAIGenerate(branchInstruction) に渡すと、
 * プロンプト末尾の「【別案の指定】」配下に展開され、1回の再生成で全選択を反映できる。
 */

import { CreativePointSelection } from '../../types/creativePoint';

/**
 * 選択済みの創造ポイントから別案指定文を生成する。
 * 選択が0件なら空文字（＝別案指定なし）を返す。
 */
export function buildBranchInstruction(selections: CreativePointSelection[]): string {
    if (selections.length === 0) return '';

    const lines = selections.map(({ point, alternative }) => {
        const consequence = alternative.consequence
            ? `（帰結: ${alternative.consequence}）`
            : '';
        return `・「${point.label}」: 別案「${alternative.summary}」${consequence}`;
    });

    return `以下の各ポイントについて、指定の別案の方向で生成してください。\n${lines.join('\n')}`;
}
