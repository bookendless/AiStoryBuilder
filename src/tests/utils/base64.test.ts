import { describe, it, expect } from 'vitest';
import {
    uint8ArrayToBase64,
    base64ToUint8Array,
    base64ToBlob,
    blobToBase64,
} from '../../utils/base64';

function makeBytes(length: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(new ArrayBuffer(length));
    for (let i = 0; i < length; i++) {
        bytes[i] = i % 256;
    }
    return bytes;
}

describe('base64の往復変換', () => {
    // 8192バイトごとに分割して処理しているため、境界前後を確認する
    it.each([0, 1, 8191, 8192, 8193, 100_000])('%iバイトを往復できる', (length) => {
        const bytes = makeBytes(length);
        const restored = base64ToUint8Array(uint8ArrayToBase64(bytes));
        expect(restored.length).toBe(length);
        expect(Array.from(restored)).toEqual(Array.from(bytes));
    });

    it('data URI形式の接頭辞を取り除く', () => {
        const bytes = makeBytes(32);
        const base64 = uint8ArrayToBase64(bytes);
        const restored = base64ToUint8Array(`data:image/webp;base64,${base64}`);
        expect(Array.from(restored)).toEqual(Array.from(bytes));
    });
});

describe('Blobとの相互変換', () => {
    it('BlobをBase64にしてBlobへ戻せる', async () => {
        const bytes = makeBytes(1234);
        const blob = new Blob([bytes], { type: 'image/webp' });

        const base64 = await blobToBase64(blob);
        const restored = base64ToBlob(base64, 'image/webp');

        expect(restored.type).toBe('image/webp');
        expect(restored.size).toBe(blob.size);
        expect(Array.from(new Uint8Array(await restored.arrayBuffer()))).toEqual(Array.from(bytes));
    });
});
