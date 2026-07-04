import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  computeDailyDeltas,
  computeStreak,
  sumWritten,
  computeTotalDraftChars,
  DailySample,
} from '../../utils/writingStatsUtils';

const today = new Date(2026, 6, 10); // 2026-07-10

describe('toDateKey', () => {
  it('ローカル日付をゼロ埋めで返す', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('computeTotalDraftChars', () => {
  it('章草案とプロジェクト草案を合算する', () => {
    expect(computeTotalDraftChars([{ draft: 'あいう' }, { draft: 'かき' }], 'ん')).toBe(6);
  });
  it('未定義は0として扱う', () => {
    expect(computeTotalDraftChars([{}, { draft: undefined }])).toBe(0);
  });
});

describe('computeDailyDeltas', () => {
  it('前サンプルとの差を日次の執筆量として返す', () => {
    const samples: DailySample[] = [
      { date: '2026-07-08', totalChars: 100 },
      { date: '2026-07-09', totalChars: 250 },
      { date: '2026-07-10', totalChars: 400 },
    ];
    const result = computeDailyDeltas(samples, 3, today);
    expect(result.map(r => r.delta)).toEqual([0, 150, 150]);
  });

  it('サンプルのない日は据え置き（delta 0）で埋める', () => {
    const samples: DailySample[] = [
      { date: '2026-07-08', totalChars: 100 },
      { date: '2026-07-10', totalChars: 300 },
    ];
    const result = computeDailyDeltas(samples, 3, today);
    // 07-08基準(0) → 07-09なし(0) → 07-10で+200
    expect(result.map(r => r.delta)).toEqual([0, 0, 200]);
  });

  it('期間より前の基準サンプルがあれば初日にも差分が出る', () => {
    const samples: DailySample[] = [
      { date: '2026-07-07', totalChars: 100 },
      { date: '2026-07-08', totalChars: 180 },
    ];
    const result = computeDailyDeltas(samples, 3, today);
    // 07-08は前日(07-07=100)基準で+80
    expect(result[0]).toEqual({ date: '2026-07-08', totalChars: 180, delta: 80 });
  });

  it('削除で減った日はマイナスの delta になる', () => {
    const samples: DailySample[] = [
      { date: '2026-07-09', totalChars: 500 },
      { date: '2026-07-10', totalChars: 300 },
    ];
    const result = computeDailyDeltas(samples, 2, today);
    expect(result[1].delta).toBe(-200);
  });
});

describe('computeStreak', () => {
  it('連続して純増した日数を数える', () => {
    const deltas = computeDailyDeltas(
      [
        { date: '2026-07-08', totalChars: 100 },
        { date: '2026-07-09', totalChars: 200 },
        { date: '2026-07-10', totalChars: 300 },
      ],
      3,
      today
    );
    // 07-08は基準でdelta0、09,10は+100 → ストリーク2
    expect(computeStreak(deltas)).toBe(2);
  });

  it('今日未執筆でも昨日書いていればストリークは継続', () => {
    const deltas = [
      { date: '2026-07-08', totalChars: 100, delta: 100 },
      { date: '2026-07-09', totalChars: 200, delta: 100 },
      { date: '2026-07-10', totalChars: 200, delta: 0 },
    ];
    expect(computeStreak(deltas)).toBe(2);
  });

  it('2日以上空くとストリークは途切れる', () => {
    const deltas = [
      { date: '2026-07-08', totalChars: 100, delta: 100 },
      { date: '2026-07-09', totalChars: 100, delta: 0 },
      { date: '2026-07-10', totalChars: 100, delta: 0 },
    ];
    expect(computeStreak(deltas)).toBe(0);
  });
});

describe('sumWritten', () => {
  it('純増分のみを合算する（マイナス日は0扱い）', () => {
    const deltas = [
      { date: '2026-07-09', totalChars: 300, delta: 300 },
      { date: '2026-07-10', totalChars: 200, delta: -100 },
    ];
    expect(sumWritten(deltas)).toBe(300);
  });
});
