import { describe, it, expect } from 'vitest';
import { formatBytes, utf8ByteLength, jsonByteSize, backupByteSize } from '../../utils/formatBytes';

describe('formatBytes', () => {
    it('0バイトと不正値は 0 B を返す', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(-1)).toBe('0 B');
        expect(formatBytes(Number.NaN)).toBe('0 B');
    });

    it('単位を切り替えて表示する', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
        expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3 GB');
    });
});

describe('utf8ByteLength', () => {
    it('ASCIIは1文字1バイト', () => {
        expect(utf8ByteLength('abc')).toBe(3);
        expect(utf8ByteLength('')).toBe(0);
    });

    it('日本語は1文字3バイト', () => {
        expect(utf8ByteLength('物語')).toBe(6);
        expect(utf8ByteLength('あいうえお')).toBe(15);
    });

    it('絵文字（サロゲートペア）は4バイト', () => {
        expect(utf8ByteLength('😺')).toBe(4);
        expect(utf8ByteLength('猫😺')).toBe(7);
    });

    it('TextEncoderと同じ結果になる', () => {
        const samples = ['abc', '物語のタイトル', '吾輩は猫である😺', 'Ω≈ç√∫˜µ'];
        for (const sample of samples) {
            expect(utf8ByteLength(sample)).toBe(new TextEncoder().encode(sample).length);
        }
    });
});

describe('jsonByteSize', () => {
    it('JSON化した結果のバイト数を返す', () => {
        expect(jsonByteSize({ a: 1 })).toBe(utf8ByteLength('{"a":1}'));
    });

    it('循環参照では0を返す', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(jsonByteSize(circular)).toBe(0);
    });
});

describe('backupByteSize', () => {
    it('圧縮済み（Base64文字列）は文字数をバイト数とみなす', () => {
        expect(backupByteSize({ data: 'AAAA', compressed: true })).toBe(4);
    });

    it('非圧縮の文字列はUTF-8バイト数で数える', () => {
        expect(backupByteSize({ data: '物語', compressed: false })).toBe(6);
    });

    it('オブジェクトはJSON化して数える', () => {
        expect(backupByteSize({ data: { a: 1 } })).toBe(utf8ByteLength('{"a":1}'));
    });
});
