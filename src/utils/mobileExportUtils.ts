/**
 * モバイル対応エクスポートユーティリティ
 * 
 * デスクトップTauri: Tauriダイアログ → ブラウザダウンロード（Share APIは使わない）
 * モバイルTauri: Tauriダイアログ → Share API → ブラウザダウンロード
 * ブラウザ: Share API（モバイルブラウザのみ） → ブラウザダウンロード
 */

import { isTauriEnvironment, isAndroidEnvironment, isIOSEnvironment } from './platformUtils';

/**
 * エクスポート結果の型
 */
export interface ExportResult {
    success: boolean;
    method: 'tauri' | 'share' | 'download' | 'cancelled' | 'error';
    error?: string;
}

/**
 * エクスポートオプションの型
 */
export interface ExportFileOptions {
    filename: string;
    content: string | Blob;
    mimeType?: string;
    title?: string;
    dialogTitle?: string;
}

/**
 * MIMEタイプを推測
 */
function guessMimeType(filename: string, fallback = 'application/octet-stream'): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
        'txt': 'text/plain',
        'md': 'text/markdown',
        'json': 'application/json',
        'html': 'text/html',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
    };
    return mimeTypes[ext || ''] || fallback;
}

/**
 * ファイルをエクスポートする共通関数
 * 
 * デスクトップTauri: Tauriダイアログ → ブラウザダウンロード
 * モバイルTauri: Tauriダイアログ → Share API → ブラウザダウンロード
 * ブラウザ: Share API（モバイルのみ） → ブラウザダウンロード
 */
export async function exportFile(options: ExportFileOptions): Promise<ExportResult> {
    const { filename, content, title, dialogTitle } = options;
    const mimeType = options.mimeType || guessMimeType(filename);

    // コンテンツをBlobに変換
    const blob = content instanceof Blob
        ? content
        : new Blob([content], { type: mimeType });

    const isTauri = isTauriEnvironment();

    // モバイル環境かどうかを判定（Tauri環境内でもチェック）
    let isMobile = false;
    if (isTauri) {
        try {
            const [isAndroid, isIOS] = await Promise.all([
                isAndroidEnvironment(),
                isIOSEnvironment()
            ]);
            isMobile = isAndroid || isIOS;
        } catch {
            isMobile = false;
        }
    }

    // 1. Tauri環境（デスクトップ/モバイル両方でダイアログを試行）
    if (isTauri) {
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeTextFile, writeFile } = await import('@tauri-apps/plugin-fs');

            const filePath = await save({
                title: dialogTitle || 'ファイルを保存',
                defaultPath: filename,
                filters: [{
                    name: 'Files',
                    extensions: [filename.split('.').pop() || '*']
                }]
            });

            if (filePath) {
                if (typeof content === 'string') {
                    await writeTextFile(filePath, content);
                } else {
                    // Blobの場合はArrayBufferに変換
                    const arrayBuffer = await blob.arrayBuffer();
                    await writeFile(filePath, new Uint8Array(arrayBuffer));
                }
                return { success: true, method: 'tauri' };
            }

            // ユーザーがキャンセルした場合
            return { success: false, method: 'cancelled' };
        } catch (error) {
            console.warn('Tauriエクスポートに失敗:', error);
            // デスクトップの場合はブラウザダウンロードにフォールバック
            // モバイルの場合はShare APIを試行
            if (!isMobile) {
                // デスクトップ: ブラウザダウンロードに直接フォールバック
                return browserDownload(blob, filename);
            }
            // モバイル: 次のフォールバック（Share API）を試行
        }
    }

    // 2. Share API（モバイル環境のみ使用）
    // isTauriかつisMobile、またはブラウザでモバイル環境の場合のみShare APIを試行
    const isMobileBrowser = !isTauri && (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );

    if ((isMobile || isMobileBrowser) && typeof navigator !== 'undefined' && navigator.share) {
        try {
            const file = new File([blob], filename, { type: mimeType });

            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    title: title || filename,
                    files: [file]
                });
                return { success: true, method: 'share' };
            } else if (typeof content === 'string') {
                // ファイル共有が不可の場合、テキストとして共有を試行
                await navigator.share({
                    title: title || filename,
                    text: content
                });
                return { success: true, method: 'share' };
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return { success: false, method: 'cancelled' };
            }
            console.warn('Share APIに失敗、ブラウザダウンロードにフォールバック:', error);
        }
    }

    // 3. ブラウザダウンロード（フォールバック）
    return browserDownload(blob, filename);
}

/**
 * ブラウザダウンロード（フォールバック用）
 */
function browserDownload(blob: Blob, filename: string): ExportResult {
    try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // URLは少し遅延してから解放（ダウンロード開始を待つ）
        setTimeout(() => URL.revokeObjectURL(url), 100);

        return { success: true, method: 'download' };
    } catch (error) {
        console.error('ブラウザダウンロードに失敗:', error);
        return {
            success: false,
            method: 'error',
            error: error instanceof Error ? error.message : 'ダウンロードに失敗しました'
        };
    }
}

/**
 * 画像をエクスポートする（Blob URL対応）
 */
export async function exportImage(options: {
    imageUrl: string;
    filename: string;
    title?: string;
}): Promise<ExportResult> {
    const { imageUrl, filename, title } = options;

    try {
        // Blob URLから画像データをフェッチ
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        return exportFile({
            filename,
            content: blob,
            mimeType: blob.type || guessMimeType(filename, 'image/png'),
            title
        });
    } catch (error) {
        console.error('画像エクスポートに失敗:', error);
        return {
            success: false,
            method: 'error',
            error: error instanceof Error ? error.message : '画像のエクスポートに失敗しました'
        };
    }
}
