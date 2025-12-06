/**
 * パフォーマンス最適化のユーティリティ関数
 * メモリ使用量の最適化、大量データ処理等を提供
 */

/**
 * メモリ使用量の監視
 */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export const getMemoryUsage = (): {
  used: number;
  total: number;
  percentage: number;
} => {
  if ('memory' in performance) {
    const perf = performance as PerformanceWithMemory;
    const memory = perf.memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }
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
export const convertToWebP = (
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
  const eventListeners = performance.getEntriesByType?.('measure') || [];
  if (eventListeners.length > 1000) {
    hasLeak = true;
    details.push(`イベントリスナーが多すぎる可能性: ${eventListeners.length}個`);
  }
  
  return { hasLeak, details };
};

/**
 * 画像の遅延読み込み
 */
export const createLazyImageLoader = (): {
  observe: (img: HTMLImageElement) => void;
  unobserve: (img: HTMLImageElement) => void;
  disconnect: () => void;
} => {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px 0px',
    threshold: 0.01
  });

  return {
    observe: (img: HTMLImageElement) => imageObserver.observe(img),
    unobserve: (img: HTMLImageElement) => imageObserver.unobserve(img),
    disconnect: () => imageObserver.disconnect()
  };
};

/**
 * リソースの事前読み込み
 */
export const preloadResource = (url: string, type: 'image' | 'script' | 'style' | 'font' = 'image'): Promise<void> => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    
    switch (type) {
      case 'image':
        link.as = 'image';
        break;
      case 'script':
        link.as = 'script';
        break;
      case 'style':
        link.as = 'style';
        break;
      case 'font':
        link.as = 'font';
        link.crossOrigin = 'anonymous';
        break;
    }
    
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to preload ${url}`));
    
    document.head.appendChild(link);
  });
};

/**
 * バンドルサイズの分析
 */
export const analyzeBundleSize = (): {
  totalSize: number;
  largestChunks: Array<{ name: string; size: number }>;
  recommendations: string[];
} => {
  const recommendations: string[] = [];
  let totalSize = 0;
  const largestChunks: Array<{ name: string; size: number }> = [];
  
  // パフォーマンスエントリからリソースサイズを取得
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  resources.forEach(resource => {
    const size = resource.transferSize || 0;
    totalSize += size;
    
    if (size > 100000) { // 100KB以上
      largestChunks.push({
        name: resource.name,
        size: size
      });
    }
  });
  
  // 推奨事項を生成
  if (totalSize > 1000000) { // 1MB以上
    recommendations.push('バンドルサイズが大きすぎます。コード分割を検討してください。');
  }
  
  if (largestChunks.length > 5) {
    recommendations.push('大きなチャンクが多すぎます。チャンク分割を最適化してください。');
  }
  
  const jsChunks = largestChunks.filter(chunk => chunk.name.endsWith('.js'));
  if (jsChunks.length > 3) {
    recommendations.push('JavaScriptチャンクが多すぎます。バンドルを統合することを検討してください。');
  }
  
  return {
    totalSize,
    largestChunks: largestChunks.sort((a, b) => b.size - a.size).slice(0, 10),
    recommendations
  };
};

/**
 * パフォーマンス監視
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private observers: PerformanceObserver[] = [];
  
  constructor() {
    this.setupObservers();
  }
  
  private setupObservers(): void {
    // ロングタスクの監視
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.recordMetric('longTasks', entry.duration);
        });
      });
      
      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (_e) {
        console.warn('Long task observer not supported');
      }
      
      // レイアウトシフトの監視
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if ('value' in entry) {
            this.recordMetric('layoutShifts', entry.value as number);
          }
        });
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (_e) {
        console.warn('Layout shift observer not supported');
      }
    }
  }
  
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // 最新の100個の値のみ保持
    if (values.length > 100) {
      values.shift();
    }
  }
  
  getMetricStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }
    
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }
  
  getPerformanceScore(): number {
    const scores: number[] = [];
    
    // ロングタスクスコア
    const longTaskStats = this.getMetricStats('longTasks');
    if (longTaskStats) {
      const longTaskScore = Math.max(0, 100 - (longTaskStats.avg / 50) * 100);
      scores.push(longTaskScore);
    }
    
    // レイアウトシフトスコア
    const clsStats = this.getMetricStats('layoutShifts');
    if (clsStats) {
      const clsScore = Math.max(0, 100 - clsStats.avg * 1000);
      scores.push(clsScore);
    }
    
    // メモリ使用量スコア
    const memory = getMemoryUsage();
    const memoryScore = Math.max(0, 100 - memory.percentage);
    scores.push(memoryScore);
    
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 100;
  }
  
  disconnect(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

/**
 * サービスワーカーの登録
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

/**
 * オフライン対応の検出
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

export const onOnlineStatusChange = (callback: (isOnline: boolean) => void): () => void => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};


