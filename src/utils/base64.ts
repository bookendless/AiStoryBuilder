/**
 * Base64変換ユーティリティ
 *
 * 画像BlobをJSONへ載せるために使う。巨大な配列をそのまま
 * String.fromCharCode(...bytes) に渡すとスタックオーバーフローになるため、
 * 既存の圧縮処理と同じくチャンクに分割して処理する。
 */

const CHUNK_SIZE = 8192;

/** Uint8ArrayをBase64文字列に変換する */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Base64文字列（data URI形式も可）をUint8Arrayに変換する */
export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const commaIndex = base64.indexOf(',');
  const body = base64.startsWith('data:') && commaIndex >= 0
    ? base64.slice(commaIndex + 1)
    : base64;
  const binary = atob(body.trim());
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** BlobをBase64文字列に変換する（data URIの接頭辞は含まない） */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === 'function') {
    return uint8ArrayToBase64(new Uint8Array(await blob.arrayBuffer()));
  }

  // arrayBufferが使えない環境向けのフォールバック
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Blobの読み込みに失敗しました'));
    reader.readAsDataURL(blob);
  });
}

/** Base64文字列をBlobに戻す */
export function base64ToBlob(base64: string, type: string): Blob {
  const bytes = base64ToUint8Array(base64);
  return new Blob([bytes], { type });
}
