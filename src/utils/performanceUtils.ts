/**
 * 画像の圧縮・WebP変換、キャッシュ等の性能向上用ユーティリティ
 */

/**
 * 画像の圧縮
 */
export const compressImage = (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let objectUrl: string | null = null;
    
    img.onload = () => {
      // アスペクト比を維持しながらリサイズ
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 画像を描画
      ctx?.drawImage(img, 0, 0, width, height);
      
      // 圧縮してBlobに変換
      canvas.toBlob(
        (blob) => {
          // オブジェクトURLを解放
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
          
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('画像の圧縮に失敗しました'));
          }
        },
        file.type,
        quality
      );
    };
    
    img.onerror = () => {
      // エラー時もオブジェクトURLを解放
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      reject(new Error('画像の読み込みに失敗しました'));
    };
    
    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
};

/**
 * 画像をWebP形式に変換
 */
const convertToWebP = (
  file: File | Blob,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let objectUrl: string | null = null;
    
    img.onload = () => {
      // アスペクト比を維持しながらリサイズ
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 画像を描画
      ctx?.drawImage(img, 0, 0, width, height);
      
      // WebP形式でBlobに変換
      canvas.toBlob(
        (blob) => {
          // オブジェクトURLを解放
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
          
          if (blob) {
            resolve(blob);
          } else {
            // WebPがサポートされていない場合は元の形式で返す
            reject(new Error('WebP変換に失敗しました'));
          }
        },
        'image/webp',
        quality
      );
    };
    
    img.onerror = () => {
      // エラー時もオブジェクトURLを解放
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      reject(new Error('画像の読み込みに失敗しました'));
    };
    
    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
};

/**
 * 画像を圧縮してWebP形式に変換（最適化版）
 */
export const optimizeImageToWebP = async (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<Blob> => {
  try {
    // まずWebP変換を試みる
    return await convertToWebP(file, maxWidth, maxHeight, quality);
  } catch (error) {
    // WebP変換に失敗した場合は通常の圧縮を使用
    console.warn('WebP変換に失敗、通常の圧縮を使用します:', error);
    return await compressImage(file, maxWidth, maxHeight, quality);
  }
};

/**
 * Base64画像の最適化
 */
export const optimizeBase64Image = async (
  base64: string,
  maxSize: number = 500000 // 500KB
): Promise<string> => {
  try {
    // Base64データURIからBlobを作成（fetchを使わずに）
    const base64Data = base64.split(',')[1] || base64;
    const mimeMatch = base64.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    
    // Base64文字列をバイナリにデコード
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    
    // サイズが閾値以下の場合はそのまま返す
    if (blob.size <= maxSize) {
      return base64;
    }
    
    // 画像をCanvasに読み込んで圧縮
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas contextを取得できませんでした'));
          return;
        }
        
        // アスペクト比を維持しながらリサイズ
        let { width, height } = img;
        const maxWidth = 1920;
        const maxHeight = 1080;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 画像を描画
        ctx.drawImage(img, 0, 0, width, height);
        
        // 圧縮率を計算
        const compressionRatio = maxSize / blob.size;
        const quality = Math.max(0.1, Math.min(0.9, compressionRatio));
        
        // 圧縮してBase64に変換
        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('画像の圧縮に失敗しました'));
              reader.readAsDataURL(compressedBlob);
            } else {
              reject(new Error('画像の圧縮に失敗しました'));
            }
          },
          mimeType,
          quality
        );
      };
      
      img.onerror = () => {
        console.error('Base64画像の読み込みエラー');
        resolve(base64); // エラーの場合は元の画像を返す
      };
      
      img.src = base64;
    });
  } catch (error) {
    console.error('Base64画像の最適化エラー:', error);
    return base64; // エラーの場合は元の画像を返す
  }
};

export class DataCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttl });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /** 全件破棄する（インポート直後など、内容が総入れ替えになるとき用） */
  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}


