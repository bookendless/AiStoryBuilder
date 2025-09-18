/**
 * パフォーマンス最適化のユーティリティ関数
 * メモリ使用量の最適化、大量データ処理等を提供
 */

/**
 * メモリ使用量の監視
 */
export const getMemoryUsage = (): {
  used: number;
  total: number;
  percentage: number;
} => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
  
  return {
    used: 0,
    total: 0,
    percentage: 0
  };
};

/**
 * メモリ使用量が閾値を超えているかチェック
 */
export const isMemoryUsageHigh = (threshold: number = 80): boolean => {
  const memory = getMemoryUsage();
  return memory.percentage > threshold;
};

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
    
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Base64画像の最適化
 */
export const optimizeBase64Image = async (
  base64: string,
  maxSize: number = 500000 // 500KB
): Promise<string> => {
  try {
    // Base64をBlobに変換
    const response = await fetch(base64);
    const blob = await response.blob();
    
    // サイズが閾値以下の場合はそのまま返す
    if (blob.size <= maxSize) {
      return base64;
    }
    
    // 圧縮率を計算
    const compressionRatio = maxSize / blob.size;
    const quality = Math.max(0.1, Math.min(0.9, compressionRatio));
    
    // 画像を圧縮
    const compressedBlob = await compressImage(blob as File, 1920, 1080, quality);
    
    // 圧縮されたBlobをBase64に変換
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('画像の圧縮に失敗しました'));
      reader.readAsDataURL(compressedBlob);
    });
  } catch (error) {
    console.error('Base64画像の最適化エラー:', error);
    return base64; // エラーの場合は元の画像を返す
  }
};

/**
 * 大量データのバッチ処理
 */
export const processBatch = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10,
  delay: number = 0
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // バッチを並列処理
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults);
    
    // メモリ使用量をチェック
    if (isMemoryUsageHigh()) {
      console.warn('メモリ使用量が高いため、処理を一時停止します');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 遅延を追加（UIのブロックを防ぐ）
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
};

/**
 * 仮想スクロール用のアイテム計算
 */
export const calculateVirtualScrollItems = (
  totalItems: number,
  containerHeight: number,
  itemHeight: number,
  scrollTop: number
): {
  startIndex: number;
  endIndex: number;
  visibleItems: number;
  totalHeight: number;
} => {
  const visibleItems = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleItems + 1, totalItems);
  const totalHeight = totalItems * itemHeight;
  
  return {
    startIndex,
    endIndex,
    visibleItems,
    totalHeight
  };
};

/**
 * デバウンス付きの検索
 */
export const createDebouncedSearch = <T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
): (query: string) => Promise<T[]> => {
  let timeoutId: number;
  let lastQuery = '';
  
  return (query: string): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      
      // 同じクエリの場合は前回の結果を返す
      if (query === lastQuery) {
        resolve([]);
        return;
      }
      
      timeoutId = setTimeout(async () => {
        try {
          lastQuery = query;
          const results = await searchFn(query);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
};

/**
 * 無限スクロール用のページネーション
 */
export const createInfiniteScroll = <T>(
  loadMoreFn: (page: number) => Promise<T[]>,
  pageSize: number = 20
): {
  loadMore: () => Promise<T[]>;
  reset: () => void;
  hasMore: boolean;
  isLoading: boolean;
} => {
  let currentPage = 0;
  let hasMore = true;
  let isLoading = false;
  
  const loadMore = async (): Promise<T[]> => {
    if (isLoading || !hasMore) {
      return [];
    }
    
    isLoading = true;
    
    try {
      const results = await loadMoreFn(currentPage);
      
      if (results.length < pageSize) {
        hasMore = false;
      }
      
      currentPage++;
      return results;
    } catch (error) {
      console.error('無限スクロール読み込みエラー:', error);
      return [];
    } finally {
      isLoading = false;
    }
  };
  
  const reset = () => {
    currentPage = 0;
    hasMore = true;
    isLoading = false;
  };
  
  return {
    loadMore,
    reset,
    get hasMore() { return hasMore; },
    get isLoading() { return isLoading; }
  };
};

/**
 * データのキャッシュ管理
 */
export class DataCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; ttl: number }>();
  private maxSize: number;
  private defaultTtl: number;
  
  constructor(maxSize: number = 100, defaultTtl: number = 5 * 60 * 1000) { // 5分
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }
  
  set(key: string, data: T, ttl?: number): void {
    // キャッシュサイズ制限
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl
    });
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // TTLチェック
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
  
  // 期限切れアイテムのクリーンアップ
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * パフォーマンス測定
 */
export const measurePerformance = <T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> => {
  const start = performance.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.then((value) => {
      const end = performance.now();
      console.log(`${name}: ${(end - start).toFixed(2)}ms`);
      return value;
    });
  } else {
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
};

/**
 * メモリリークの検出
 */
export const detectMemoryLeaks = (): {
  hasLeak: boolean;
  details: string[];
} => {
  const details: string[] = [];
  let hasLeak = false;
  
  // メモリ使用量のチェック
  const memory = getMemoryUsage();
  if (memory.percentage > 90) {
    hasLeak = true;
    details.push(`メモリ使用量が高い: ${memory.percentage.toFixed(2)}%`);
  }
  
  // DOM要素の数チェック
  const domElements = document.querySelectorAll('*').length;
  if (domElements > 10000) {
    hasLeak = true;
    details.push(`DOM要素が多すぎる: ${domElements}個`);
  }
  
  // イベントリスナーの数チェック（概算）
  const eventListeners = (performance as any).getEntriesByType?.('measure') || [];
  if (eventListeners.length > 1000) {
    hasLeak = true;
    details.push(`イベントリスナーが多すぎる可能性: ${eventListeners.length}個`);
  }
  
  return { hasLeak, details };
};


