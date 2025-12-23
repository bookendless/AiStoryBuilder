/**
 * ストレージサービス
 * APIキーの安全な保存を提供
 * - Tauri環境: Tauri Storeプラグインを使用
 * - ブラウザ環境: IndexedDB（Dexie）を使用
 * - フォールバック: localStorage
 */

import { SecureApiKeys } from './databaseService';

// Tauri Store の型定義
interface TauriStore {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
  save: () => Promise<void>;
}

// ストレージサービスインターフェース
export interface StorageService {
  saveApiKeys(keys: Record<string, string>): Promise<void>;
  loadApiKeys(): Promise<Record<string, string> | null>;
  deleteApiKeys(): Promise<void>;
  migrateFromLocalStorage(): Promise<boolean>;
  isReady(): Promise<boolean>;
}

// APIキーの保存キー
const API_KEYS_STORAGE_KEY = 'api-keys';
const MIGRATION_FLAG_KEY = 'api-keys-migration-completed';
const TAURI_STORE_PATH = 'secure-settings.json';

/**
 * Tauri環境かどうかを判定
 */
const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

/**
 * Tauri Storeを取得
 */
let tauriStoreCache: TauriStore | null = null;
let tauriStoreInitialized = false;

const getTauriStore = async (): Promise<TauriStore | null> => {
  if (tauriStoreInitialized) {
    return tauriStoreCache;
  }

  if (!isTauriEnvironment()) {
    tauriStoreInitialized = true;
    return null;
  }

  try {
    const storePlugin = await import('@tauri-apps/plugin-store');
    const store = await storePlugin.load(TAURI_STORE_PATH, {
      autoSave: true,
      defaults: {}, // デフォルト値（空オブジェクト）
    });
    tauriStoreCache = store as unknown as TauriStore;
    console.log('✅ Tauri Store loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load Tauri Store:', error);
    tauriStoreCache = null;
  }

  tauriStoreInitialized = true;
  return tauriStoreCache;
};

/**
 * IndexedDB（Dexie）からAPIキーを取得
 */
const getApiKeysFromIndexedDB = async (): Promise<SecureApiKeys | null> => {
  try {
    // 動的インポートで循環依存を回避
    const { db } = await import('./databaseService');
    const result = await db.secureApiKeys.get(API_KEYS_STORAGE_KEY);
    return result || null;
  } catch (error) {
    console.error('IndexedDB read error:', error);
    return null;
  }
};

/**
 * IndexedDB（Dexie）にAPIキーを保存
 */
const saveApiKeysToIndexedDB = async (keys: Record<string, string>): Promise<void> => {
  try {
    const { db } = await import('./databaseService');
    await db.secureApiKeys.put({
      id: API_KEYS_STORAGE_KEY,
      keys,
      updatedAt: new Date(),
      migrationCompleted: true,
    });
  } catch (error) {
    console.error('IndexedDB write error:', error);
    throw error;
  }
};

/**
 * IndexedDB（Dexie）からAPIキーを削除
 */
const deleteApiKeysFromIndexedDB = async (): Promise<void> => {
  try {
    const { db } = await import('./databaseService');
    await db.secureApiKeys.delete(API_KEYS_STORAGE_KEY);
  } catch (error) {
    console.error('IndexedDB delete error:', error);
    throw error;
  }
};

/**
 * localStorageからAPIキーを取得（レガシー/フォールバック用）
 */
const getApiKeysFromLocalStorage = (): Record<string, string> | null => {
  try {
    const saved = localStorage.getItem('ai-settings');
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    // apiKeysがあればそれを返す、なければapiKeyから構築
    if (parsed.apiKeys && Object.keys(parsed.apiKeys).length > 0) {
      return parsed.apiKeys;
    }
    if (parsed.apiKey && parsed.provider) {
      return { [parsed.provider]: parsed.apiKey };
    }
    return null;
  } catch (error) {
    console.error('localStorage read error:', error);
    return null;
  }
};

/**
 * localStorageにAPIキーを保存（フォールバック用）
 */
const saveApiKeysToLocalStorage = (keys: Record<string, string>): void => {
  try {
    const saved = localStorage.getItem('ai-settings');
    const current = saved ? JSON.parse(saved) : {};
    current.apiKeys = keys;
    localStorage.setItem('ai-settings', JSON.stringify(current));
  } catch (error) {
    console.error('localStorage write error:', error);
    throw error;
  }
};

/**
 * localStorageからAPIキー情報を削除
 */
const removeApiKeysFromLocalStorage = (): void => {
  try {
    const saved = localStorage.getItem('ai-settings');
    if (saved) {
      const current = JSON.parse(saved);
      // APIキー関連のフィールドのみ削除
      delete current.apiKeys;
      delete current.apiKey;
      localStorage.setItem('ai-settings', JSON.stringify(current));
    }
  } catch (error) {
    console.error('localStorage remove error:', error);
  }
};

/**
 * 移行完了フラグを確認
 */
const isMigrationCompleted = async (): Promise<boolean> => {
  // まずIndexedDBを確認
  try {
    const stored = await getApiKeysFromIndexedDB();
    if (stored?.migrationCompleted) {
      return true;
    }
  } catch {
    // エラーは無視
  }

  // Tauri Storeを確認
  const tauriStore = await getTauriStore();
  if (tauriStore) {
    try {
      const flag = await tauriStore.get<boolean>(MIGRATION_FLAG_KEY);
      if (flag) return true;
    } catch {
      // エラーは無視
    }
  }

  return false;
};

/**
 * 移行完了フラグを設定
 */
const setMigrationCompleted = async (): Promise<void> => {
  const tauriStore = await getTauriStore();
  if (tauriStore) {
    try {
      await tauriStore.set(MIGRATION_FLAG_KEY, true);
      await tauriStore.save();
    } catch (error) {
      console.error('Failed to set migration flag in Tauri Store:', error);
    }
  }
};

/**
 * ストレージサービスの実装
 */
class StorageServiceImpl implements StorageService {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 初期化
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Tauri Storeの初期化を試みる
      await getTauriStore();
      this.initialized = true;
    })();

    return this.initPromise;
  }

  /**
   * サービスの準備完了を確認
   */
  async isReady(): Promise<boolean> {
    await this.initialize();
    return this.initialized;
  }

  /**
   * APIキーを保存
   */
  async saveApiKeys(keys: Record<string, string>): Promise<void> {
    await this.initialize();

    // Tauri環境ではTauri Storeを優先
    const tauriStore = await getTauriStore();
    if (tauriStore) {
      try {
        await tauriStore.set(API_KEYS_STORAGE_KEY, keys);
        await tauriStore.save();
        console.log('API keys saved to Tauri Store');
        return;
      } catch (error) {
        console.error('Failed to save to Tauri Store, falling back to IndexedDB:', error);
      }
    }

    // IndexedDBに保存
    try {
      await saveApiKeysToIndexedDB(keys);
      console.log('API keys saved to IndexedDB');
      return;
    } catch (error) {
      console.error('Failed to save to IndexedDB, falling back to localStorage:', error);
    }

    // 最終フォールバック: localStorage
    saveApiKeysToLocalStorage(keys);
    console.log('API keys saved to localStorage (fallback)');
  }

  /**
   * APIキーを読み込み
   */
  async loadApiKeys(): Promise<Record<string, string> | null> {
    await this.initialize();

    // Tauri環境ではTauri Storeを優先
    const tauriStore = await getTauriStore();
    if (tauriStore) {
      try {
        const keys = await tauriStore.get<Record<string, string>>(API_KEYS_STORAGE_KEY);
        if (keys) {
          console.log('API keys loaded from Tauri Store');
          return keys;
        }
      } catch (error) {
        console.error('Failed to load from Tauri Store:', error);
      }
    }

    // IndexedDBから読み込み
    try {
      const stored = await getApiKeysFromIndexedDB();
      if (stored?.keys) {
        console.log('API keys loaded from IndexedDB');
        return stored.keys;
      }
    } catch (error) {
      console.error('Failed to load from IndexedDB:', error);
    }

    // フォールバック: localStorage
    const keys = getApiKeysFromLocalStorage();
    if (keys) {
      console.log('API keys loaded from localStorage (fallback)');
    }
    return keys;
  }

  /**
   * APIキーを削除
   */
  async deleteApiKeys(): Promise<void> {
    await this.initialize();

    // Tauri Store
    const tauriStore = await getTauriStore();
    if (tauriStore) {
      try {
        await tauriStore.delete(API_KEYS_STORAGE_KEY);
        await tauriStore.save();
      } catch (error) {
        console.error('Failed to delete from Tauri Store:', error);
      }
    }

    // IndexedDB
    try {
      await deleteApiKeysFromIndexedDB();
    } catch (error) {
      console.error('Failed to delete from IndexedDB:', error);
    }

    // localStorage
    removeApiKeysFromLocalStorage();

    console.log('API keys deleted from all storages');
  }

  /**
   * localStorageからの移行を実行
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    await this.initialize();

    // 移行済みの場合はスキップ
    if (await isMigrationCompleted()) {
      console.log('Migration already completed, skipping');
      return true;
    }

    // localStorageからAPIキーを取得
    const legacyKeys = getApiKeysFromLocalStorage();
    if (!legacyKeys || Object.keys(legacyKeys).length === 0) {
      console.log('No API keys found in localStorage, marking migration as completed');
      await setMigrationCompleted();
      return true;
    }

    console.log('Migrating API keys from localStorage...');

    try {
      // 新しいストレージに保存
      await this.saveApiKeys(legacyKeys);

      // 移行成功後、localStorageからAPIキーを削除
      removeApiKeysFromLocalStorage();

      // 移行完了フラグを設定
      await setMigrationCompleted();

      console.log('✅ Migration completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      // 失敗時はlocalStorageを維持
      return false;
    }
  }
}

// シングルトンインスタンス
export const storageService: StorageService = new StorageServiceImpl();

// デフォルトエクスポート
export default storageService;

