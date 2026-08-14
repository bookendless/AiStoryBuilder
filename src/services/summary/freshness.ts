/**
 * 章あらすじ（Chapter.summary）の鮮度判定
 *
 * summary が草案から自動更新される経路は存在しないため、本文を書き進めるほど陳腐化する。
 * 古い summary は buildDraftContext が「直前の章のあらすじ」として強制包含するので、
 * 放置すると次章の生成品質を直接下げる（本文と食い違う前提でAIが書き始める）。
 *
 * ここでは「summary を確定した時点の draft ハッシュ」を突き合わせるだけの決定的な判定を行う。
 * AI呼び出しは不要でコストゼロ。
 */

import { Chapter } from '../../types/project/chapter';
import { fnv1a64 } from '../rag/hash';
import { truncateAtSentence } from '../../utils/textTruncate';

/**
 * 「このあらすじは現在の本文から作られていない」ことが確定しているときの印。
 * 実ハッシュ（16桁の16進数）とは決して一致しないため、
 * 特別扱いを増やさずに「ハッシュ不一致＝古い」の規則へそのまま乗る。
 */
export const SUMMARY_SOURCE_UNVERIFIED = 'unverified';

/** 機械抽出する暫定あらすじの最大文字数 */
export const PROVISIONAL_SUMMARY_LENGTH = 120;

/**
 * あらすじの元になった本文のハッシュを計算する。
 * 前後の空白だけの差では変化させない（自動保存で末尾に改行が付いただけで古い判定にしないため）。
 */
export const computeSummarySourceHash = (draft: string): string => fnv1a64(draft.trim());

/**
 * あらすじが本文より古いか。
 *
 * 判定順序に意味がある:
 * 1. 本文が無ければ比較対象が無いので常に false（章立てだけ作った段階でバッジを出さない）
 * 2. 本文があるのに あらすじ が空なら古い。**ハッシュの有無より先に判定する**
 *    （そうしないと、ハッシュを持たない旧データの空あらすじが「判定不能」で見逃される）
 * 3. ハッシュ未設定は判定不能として false（この機能より前に書かれた章が一斉にバッジ表示されるのを防ぐ）
 * 4. ハッシュ不一致なら古い（SUMMARY_SOURCE_UNVERIFIED もここで拾われる）
 */
export const isSummaryStale = (
    chapter: Pick<Chapter, 'draft' | 'summary' | 'summarySourceHash'>
): boolean => {
    const draft = (chapter.draft ?? '').trim();
    if (!draft) return false;
    if (!(chapter.summary ?? '').trim()) return true;
    if (!chapter.summarySourceHash) return false;
    return chapter.summarySourceHash !== computeSummarySourceHash(draft);
};

/**
 * 本文の冒頭から暫定のあらすじを機械抽出する（AI不要）。
 *
 * 本文分割で作られた章はあらすじが空のまま残り、buildDraftContext の
 * 「直前の章のあらすじ」から丸ごと抜け落ちる。空欄よりは冒頭の要旨があったほうがましなので、
 * 暫定値を置いたうえで SUMMARY_SOURCE_UNVERIFIED を付け、AIによる更新を促す。
 */
export const extractProvisionalSummary = (
    draft: string,
    maxLength: number = PROVISIONAL_SUMMARY_LENGTH
): string => {
    const flattened = draft.trim().replace(/\s+/g, ' ');
    if (!flattened) return '';
    return truncateAtSentence(flattened, maxLength);
};
