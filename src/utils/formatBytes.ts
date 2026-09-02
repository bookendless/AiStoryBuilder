/**
 * バイト数の計測・整形ユーティリティ
 *
 * エクスポート／インポートのサイズ表示や推定に使う共通処理をまとめる。
 * Blob を生成せずにバイト数を求めるため、大量レコードの集計でも割り当てが発生しない。
 */

/** バイト数を人間が読める形式に変換する */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 文字列をUTF-8でエンコードしたときのバイト数を返す
 * TextEncoder/Blobと違い、中間バッファを確保しないため大量に呼んでも軽い
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // サロゲートペア（4バイト）。次の下位サロゲートをまとめて処理する
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3; // 単独サロゲートは置換文字（3バイト）になる
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/** 値をJSON化したときのUTF-8バイト数を返す（循環参照時は0） */
export function jsonByteSize(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return json ? utf8ByteLength(json) : 0;
  } catch {
    return 0;
  }
}

/**
 * バックアップレコードのバイト数を求める
 * 圧縮済みデータはBase64文字列なので、文字数がそのままバイト数になる
 */
export function backupByteSize(backup: { data: unknown; compressed?: boolean }): number {
  const { data, compressed } = backup;
  if (typeof data === 'string') {
    return compressed ? data.length : utf8ByteLength(data);
  }
  return jsonByteSize(data);
}
