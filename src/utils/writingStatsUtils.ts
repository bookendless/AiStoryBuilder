/**
 * 執筆統計の計算ユーティリティ（純粋関数）
 *
 * 日次の総文字数サンプルから、日ごとの執筆量・連続執筆日数などを算出する。
 * 永続化は writingStatsService が担当し、ここは計算のみを行う（テスト容易性のため）。
 */

/** 日次の総文字数サンプル（その日の最終時点での作品全体の文字数） */
export interface DailySample {
  /** 'YYYY-MM-DD'（ローカル日付） */
  date: string;
  /** その日の作品全体の総文字数 */
  totalChars: number;
}

/** 日ごとの執筆量（前サンプルからの増減） */
export interface DailyDelta {
  date: string;
  totalChars: number;
  /** その日の純増減文字数（前回サンプルとの差） */
  delta: number;
}

/** Date をローカルの 'YYYY-MM-DD' に変換 */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** dateKey に days 日を加算した dateKey を返す */
function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/**
 * サンプル列から直近 days 日分の日次執筆量を算出する。
 * サンプルのない日は前日の総文字数を引き継ぎ、その日の delta は 0 とする。
 *
 * @param samples 日付昇順である必要はない（内部でソートする）
 * @param days 遡る日数（今日を含む）
 * @param today 基準日（省略時は現在日時）
 */
export function computeDailyDeltas(
  samples: DailySample[],
  days: number,
  today: Date = new Date()
): DailyDelta[] {
  const sampleMap = new Map(samples.map(s => [s.date, s.totalChars]));
  const todayKey = toDateKey(today);

  // 期間開始日より前の最新サンプルを「基準（前日総文字数）」として求める
  const startKey = addDays(todayKey, -(days - 1));
  const priorSamples = samples
    .filter(s => s.date < startKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  let prevTotal = priorSamples.length > 0 ? priorSamples[priorSamples.length - 1].totalChars : 0;

  // 期間開始前にサンプルが全くない場合、期間内の最初のサンプルを基準にして
  // 初回計上を過大にしない（最初の記録日は delta 0 スタート）
  const hasPriorSample = priorSamples.length > 0;
  let baselineApplied = hasPriorSample;

  const result: DailyDelta[] = [];
  for (let i = 0; i < days; i++) {
    const dateKey = addDays(startKey, i);
    const sampled = sampleMap.get(dateKey);

    if (sampled === undefined) {
      // サンプルなし: 総文字数は据え置き、delta 0
      result.push({ date: dateKey, totalChars: prevTotal, delta: 0 });
      continue;
    }

    if (!baselineApplied) {
      // 期間内の最初のサンプル: 基準として扱い delta 0
      baselineApplied = true;
      prevTotal = sampled;
      result.push({ date: dateKey, totalChars: sampled, delta: 0 });
      continue;
    }

    const delta = sampled - prevTotal;
    prevTotal = sampled;
    result.push({ date: dateKey, totalChars: sampled, delta });
  }

  return result;
}

/**
 * 連続執筆日数（ストリーク）を算出する。
 * 今日または昨日から遡って、純増（delta > 0）が続いた日数を数える。
 * （今日まだ書いていなくても、昨日書いていればストリークは途切れない）
 */
export function computeStreak(deltas: DailyDelta[]): number {
  if (deltas.length === 0) return 0;
  const sorted = [...deltas].sort((a, b) => a.date.localeCompare(b.date));

  let streak = 0;
  let index = sorted.length - 1;

  // 末尾（今日）が未執筆なら1日分だけ猶予する（昨日から数える）
  if (sorted[index].delta <= 0) {
    index--;
  }

  for (; index >= 0; index--) {
    if (sorted[index].delta > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 指定期間の合計執筆量（純増分の合計。マイナス日＝削除超過の日は0として扱い、合計を減らさない）
 */
export function sumWritten(deltas: DailyDelta[]): number {
  return deltas.reduce((sum, d) => sum + Math.max(0, d.delta), 0);
}

/**
 * プロジェクトの草案の総文字数を求める。
 * 章ごとの草案 + プロジェクト全体草案の合計。
 */
export function computeTotalDraftChars(
  chapters: Array<{ draft?: string }>,
  projectDraft?: string
): number {
  const chapterChars = chapters.reduce((sum, c) => sum + (c.draft?.length ?? 0), 0);
  return chapterChars + (projectDraft?.length ?? 0);
}
