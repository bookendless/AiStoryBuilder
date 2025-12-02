import Dexie, { Table } from 'dexie';
import { Project } from '../contexts/ProjectContext';
import { DataCache } from '../utils/performanceUtils';
import { ChapterHistoryEntry } from '../components/steps/draft/types';
import { AILogEntry } from '../components/common/types';

export interface StoredProject extends Project {
  version: number;
  lastSaved: Date;
}

export interface ProjectBackup {
  id: string;
  projectId: string;
  data: Project | string; // 圧縮時は文字列（JSON）
  createdAt: Date;
  description: string;
  type: 'manual' | 'auto';
  compressed: boolean; // 圧縮されているかどうか
}

export interface AppSettings {
  id: string;
  autoSaveInterval: number;
  maxAutoBackups: number;
  maxManualBackups: number;
  theme: 'light' | 'dark';
  lastOpenedProject?: string;
  // 履歴管理設定
  maxHistoryEntries?: number;
  historyRetentionDays?: number;
  autoCleanupHistory?: boolean;
  // AIログ管理設定
  persistAILogs?: boolean;
  maxAILogEntries?: number;
  aiLogRetentionDays?: number;
  autoCleanupAILogs?: boolean;
}

// IndexedDB用の履歴エントリ（ChapterHistoryEntryを拡張）
export interface StoredChapterHistoryEntry extends ChapterHistoryEntry {
  projectId: string;
  chapterId: string;
}

// IndexedDB用のAIログエントリ（AILogEntryを拡張）
export interface StoredAILogEntry extends Omit<AILogEntry, 'timestamp'> {
  id: string;
  projectId: string;
  chapterId?: string;
  timestamp: Date;
  type: string;
  prompt: string;
  response: string;
  error?: string;
  suggestionType?: string;
}

// 画像Blobストレージ用インターフェース
export interface StoredImage {
  id: string;
  blob: Blob; // 画像データ（WebP形式）
  thumbnail?: Blob; // サムネイル（オプション）
  originalFormat: string; // 元の形式（'image/jpeg', 'image/png'など）
  originalSize: number; // 元のサイズ（バイト）
  compressedSize: number; // 圧縮後のサイズ（バイト）
  width: number;
  height: number;
  createdAt: Date;
  lastAccessed: Date;
  referenceCount: number; // 参照数（プロジェクトで使用されている数）
}

class StoryBuilderDatabase extends Dexie {
  projects!: Table<StoredProject>;
  backups!: Table<ProjectBackup>;
  settings!: Table<AppSettings>;
  chapterHistories!: Table<StoredChapterHistoryEntry>;
  aiLogs!: Table<StoredAILogEntry>;
  images!: Table<StoredImage>;

  constructor() {
    super('StoryBuilderDB');
    
    try {
      // バージョン2: 既存のテーブル
      this.version(2).stores({
        projects: 'id, title, createdAt, updatedAt, lastSaved, version',
        backups: 'id, projectId, createdAt, description, type',
        settings: 'id'
      });

      // バージョン3: 履歴とAIログテーブルを追加（複合インデックスなし）
      this.version(3).stores({
        projects: 'id, title, createdAt, updatedAt, lastSaved, version',
        backups: 'id, projectId, createdAt, description, type',
        settings: 'id',
        chapterHistories: 'id, projectId, chapterId, timestamp, type',
        aiLogs: 'id, projectId, chapterId, timestamp, type'
      }).upgrade(async () => {
        console.log('データベースをバージョン3にアップグレードしました');
      });

      // バージョン4: 複合インデックスを追加
      this.version(4).stores({
        projects: 'id, title, createdAt, updatedAt, lastSaved, version',
        backups: 'id, projectId, createdAt, description, type',
        settings: 'id',
        chapterHistories: 'id, projectId, chapterId, [projectId+chapterId], timestamp, type',
        aiLogs: 'id, projectId, chapterId, [projectId+chapterId], timestamp, type'
      }).upgrade(async () => {
        console.log('データベースをバージョン4にアップグレードしました（複合インデックス追加）');
      });

      // バージョン5: 画像Blobストレージテーブルを追加
      this.version(5).stores({
        projects: 'id, title, createdAt, updatedAt, lastSaved, version',
        backups: 'id, projectId, createdAt, description, type',
        settings: 'id',
        chapterHistories: 'id, projectId, chapterId, [projectId+chapterId], timestamp, type',
        aiLogs: 'id, projectId, chapterId, [projectId+chapterId], timestamp, type',
        images: 'id, createdAt, lastAccessed, referenceCount'
      }).upgrade(async () => {
        console.log('データベースをバージョン5にアップグレードしました（画像Blobストレージ追加）');
      });
    } catch (error) {
      console.error('データベース初期化エラー:', error);
      // エラーが発生してもアプリケーションは動作し続ける
    }
  }
}

// データベースインスタンスの作成を安全に行う
let db: StoryBuilderDatabase;
try {
  db = new StoryBuilderDatabase();
} catch (error) {
  console.error('データベース作成エラー:', error);
  // フォールバック用のダミーデータベースを作成
  db = new StoryBuilderDatabase();
}

class DatabaseService {
  private autoSaveTimer: number | null = null;
  private autoSaveInterval = 180000; // 3分
  
  // パフォーマンス最適化のためのキャッシュ
  private projectCache = new DataCache<StoredProject>(50, 5 * 60 * 1000); // 50件、5分
  private settingsCache = new DataCache<AppSettings>(20, 10 * 60 * 1000); // 20件、10分

  constructor() {
    // 定期的なキャッシュクリーンアップ
    setInterval(() => {
      this.projectCache.cleanup();
      this.settingsCache.cleanup();
    }, 5 * 60 * 1000); // 5分ごと
  }

  // プロジェクト保存（強化版）
  async saveProject(project: Project): Promise<void> {
    try {
      const storedProject: StoredProject = {
        ...project,
        version: 1,
        lastSaved: new Date(),
        updatedAt: new Date(),
      };

      // 既存のプロジェクトがあるかチェック
      const existingProject = await db.projects.get(project.id);
      
      if (existingProject) {
        // 既存のプロジェクトを更新
        await db.projects.update(project.id, {
          ...storedProject,
          id: project.id // IDは更新しない
        });
      } else {
        // 新しいプロジェクトを追加
        await db.projects.add(storedProject);
      }
      
      // キャッシュを更新
      this.projectCache.set(project.id, storedProject);
      
      // 保存の確実性を高めるため、即座に読み込み確認
      const savedProject = await db.projects.get(project.id);
      if (!savedProject) {
        throw new Error('保存後の確認でプロジェクトが見つかりません');
      }
      
      console.log(`プロジェクト "${project.title}" を確実に保存しました`);
    } catch (error) {
      console.error('プロジェクト保存エラー:', error);
      // ConstraintErrorの場合は再試行
      if (error instanceof Error && error.name === 'ConstraintError') {
        try {
          await db.projects.update(project.id, {
            ...project,
            version: 1,
            lastSaved: new Date(),
            updatedAt: new Date(),
          });
          console.log(`プロジェクト "${project.title}" を更新しました`);
        } catch (retryError) {
          console.error('プロジェクト更新再試行エラー:', retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }

  // プロジェクト読み込み（画像マイグレーション対応）
  async loadProject(id: string): Promise<Project | null> {
    try {
      // キャッシュから取得を試行
      const cachedProject = this.projectCache.get(id);
      if (cachedProject) {
        const { version: _version, lastSaved: _lastSaved, ...project } = cachedProject;
        // 画像マイグレーションを実行（非同期、エラーは無視）
        this.migrateProjectImages(project).catch(err => 
          console.warn('画像マイグレーションエラー（無視）:', err)
        );
        return project;
      }

      // データベースから取得
      const storedProject = await db.projects.get(id);
      if (!storedProject) return null;

      // キャッシュに保存
      this.projectCache.set(id, storedProject);

      // StoredProject から Project に変換
      const { version: _version, lastSaved: _lastSaved, ...project } = storedProject;
      
      // 画像マイグレーションを実行（非同期、エラーは無視）
      this.migrateProjectImages(project).catch(err => 
        console.warn('画像マイグレーションエラー（無視）:', err)
      );
      
      return project;
    } catch (error) {
      console.error('プロジェクト読み込みエラー:', error);
      return null;
    }
  }

  // プロジェクトのBase64画像をBlobストレージに移行
  private async migrateProjectImages(project: Project): Promise<void> {
    if (!project.imageBoard || project.imageBoard.length === 0) return;

    const imagesToUpdate: Array<{ id: string; imageId: string; url: string }> = [];
    let hasChanges = false;

    for (const image of project.imageBoard) {
      // 既にimageIdがある場合はスキップ
      if (image.imageId) continue;

      // Base64データURIかどうかをチェック
      if (image.url.startsWith('data:image/')) {
        try {
          // Base64画像をBlobストレージに移行
          const imageId = await this.migrateBase64ImageToBlob(image.url);
          if (imageId) {
            imagesToUpdate.push({
              id: image.id,
              imageId,
              url: image.url, // 後方互換性のためURLも保持
            });
            hasChanges = true;
          }
        } catch (error) {
          console.warn(`画像マイグレーションエラー (${image.id}):`, error);
          // エラーが発生しても続行
        }
      }
    }

    // 更新がある場合はプロジェクトを保存
    if (hasChanges) {
      const updatedImages = project.imageBoard.map(img => {
        const update = imagesToUpdate.find(u => u.id === img.id);
        if (update) {
          return {
            ...img,
            imageId: update.imageId,
          };
        }
        return img;
      });

      await this.saveProject({
        ...project,
        imageBoard: updatedImages,
      });

      console.log(`${imagesToUpdate.length}件の画像をBlobストレージに移行しました`);
    }
  }

  // 全プロジェクト取得
  async getAllProjects(): Promise<Project[]> {
    try {
      const storedProjects = await db.projects.orderBy('updatedAt').reverse().toArray();
      return storedProjects.map(({ version: _version, lastSaved: _lastSaved, ...project }) => project);
    } catch (error) {
      console.error('全プロジェクト取得エラー:', error);
      return [];
    }
  }

  // プロジェクト削除
  async deleteProject(id: string): Promise<void> {
    await db.projects.delete(id);
    // 関連するバックアップも削除
    await db.backups.where('projectId').equals(id).delete();
    console.log(`プロジェクト ${id} を削除しました`);
  }

  // プロジェクト複製
  async duplicateProject(id: string): Promise<Project | null> {
    const original = await this.loadProject(id);
    if (!original) return null;

    const duplicate: Project = {
      ...original,
      id: Date.now().toString(),
      title: `${original.title} のコピー`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveProject(duplicate);
    return duplicate;
  }

  // gzip圧縮（簡易版 - pakoライブラリを使用する場合は後で置き換え可能）
  private async compressData(data: string): Promise<string> {
    // ブラウザのCompressionStream APIを使用（対応している場合）
    if ('CompressionStream' in window) {
      try {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(data));
            controller.close();
          }
        });
        
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const chunks: Uint8Array[] = [];
        const reader = compressedStream.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Base64エンコード（大きな配列に対応）
        // String.fromCharCodeは引数が多すぎるとスタックオーバーフローになるため、
        // チャンクに分割して処理する
        const chunkSize = 8192; // 8KBずつ処理
        let binaryString = '';
        for (let i = 0; i < compressed.length; i += chunkSize) {
          const chunk = compressed.slice(i, i + chunkSize);
          binaryString += String.fromCharCode(...chunk);
        }
        
        return btoa(binaryString);
      } catch (error) {
        console.warn('圧縮に失敗、非圧縮で保存します:', error);
        return data;
      }
    }
    
    // CompressionStreamが使えない場合は非圧縮で保存
    return data;
  }

  // gzip展開
  private async decompressData(compressedData: string): Promise<string> {
    // ブラウザのDecompressionStream APIを使用
    if ('DecompressionStream' in window) {
      try {
        const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(compressed);
            controller.close();
          }
        });
        
        const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
        const chunks: Uint8Array[] = [];
        const reader = decompressedStream.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        return new TextDecoder().decode(decompressed);
      } catch (error) {
        console.warn('展開に失敗:', error);
        throw error;
      }
    }
    
    // DecompressionStreamが使えない場合はそのまま返す（非圧縮データ）
    return compressedData;
  }

  // バックアップ作成（圧縮対応）
  async createBackup(project: Project, description: string = '自動バックアップ', type: 'manual' | 'auto' = 'auto'): Promise<void> {
    try {
      // プロジェクトデータをJSON文字列に変換
      const jsonData = JSON.stringify(project);
      
      // 圧縮を試みる（10KB以上のデータのみ圧縮）
      let compressedData: string;
      let isCompressed = false;
      
      if (jsonData.length > 10 * 1024) {
        try {
          compressedData = await this.compressData(jsonData);
          isCompressed = true;
        } catch (error) {
          console.warn('バックアップ圧縮に失敗、非圧縮で保存します:', error);
          compressedData = jsonData;
        }
      } else {
        compressedData = jsonData;
      }

      const backup: ProjectBackup = {
        id: `${project.id}_${Date.now()}`,
        projectId: project.id,
        data: compressedData,
        createdAt: new Date(),
        description,
        type,
        compressed: isCompressed,
      };

      await db.backups.add(backup);

      // バックアップタイプ別に古いバックアップを削除
      await this.cleanupOldBackups(project.id, type);
    } catch (error) {
      console.error('バックアップ作成エラー:', error);
      throw error;
    }
  }

  // 古いバックアップのクリーンアップ
  private async cleanupOldBackups(projectId: string, type: 'manual' | 'auto'): Promise<void> {
    const settings = await this.getSettings();
    const maxBackups = type === 'manual' ? settings.maxManualBackups : settings.maxAutoBackups;

    const allBackups = await db.backups
      .where('projectId')
      .equals(projectId)
      .and(backup => backup.type === type)
      .toArray();

    const backups = allBackups.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (backups.length > maxBackups) {
      const toDelete = backups.slice(0, backups.length - maxBackups);
      await Promise.all(toDelete.map(b => db.backups.delete(b.id)));
    }
  }

  // バックアップ一覧取得
  async getBackups(projectId: string, type?: 'manual' | 'auto'): Promise<ProjectBackup[]> {
    let query = db.backups.where('projectId').equals(projectId);
    
    if (type) {
      query = query.and(backup => backup.type === type);
    }
    
    const backups = await query.toArray();
    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // バックアップ削除
  async deleteBackup(backupId: string): Promise<void> {
    await db.backups.delete(backupId);
    console.log(`バックアップ ${backupId} を削除しました`);
  }

  // 手動バックアップ作成
  async createManualBackup(project: Project, description: string = '手動バックアップ'): Promise<void> {
    await this.createBackup(project, description, 'manual');
  }

  // バックアップから復元（圧縮対応）
  async restoreFromBackup(backupId: string): Promise<Project | null> {
    const backup = await db.backups.get(backupId);
    if (!backup) return null;

    try {
      let projectData: Project;
      
      // 圧縮されている場合は展開
      if (backup.compressed && typeof backup.data === 'string') {
        const decompressed = await this.decompressData(backup.data);
        projectData = JSON.parse(decompressed);
      } else if (typeof backup.data === 'string') {
        // 非圧縮の文字列データ
        projectData = JSON.parse(backup.data);
      } else {
        // 古い形式（オブジェクト）の場合はそのまま使用
        projectData = backup.data as Project;
      }

      const restoredProject: Project = {
        ...projectData,
        updatedAt: new Date(),
      };

      await this.saveProject(restoredProject);
      return restoredProject;
    } catch (error) {
      console.error('バックアップ復元エラー:', error);
      throw error;
    }
  }

  // 設定保存
  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const currentSettings = await this.getSettings();
    const updatedSettings: AppSettings = {
      ...currentSettings,
      ...settings,
    };

    await db.settings.put(updatedSettings);
  }

  // 設定読み込み
  async getSettings(): Promise<AppSettings> {
    const settings = await db.settings.get('main');
    return settings || {
      id: 'main',
      autoSaveInterval: 180000, // 3分
      maxAutoBackups: 10,
      maxManualBackups: 5,
      theme: 'light',
      // 履歴管理設定のデフォルト値
      maxHistoryEntries: 30,
      historyRetentionDays: 90,
      autoCleanupHistory: true,
      // AIログ管理設定のデフォルト値
      persistAILogs: true,
      maxAILogEntries: 100,
      aiLogRetentionDays: 30,
      autoCleanupAILogs: true,
    };
  }

  // 自動保存開始
  async startAutoSave(project: Project, callback: () => void): Promise<void> {
    this.stopAutoSave();
    
    const settings = await this.getSettings();
    this.autoSaveInterval = settings.autoSaveInterval;
    
    this.autoSaveTimer = setInterval(async () => {
      try {
        // プロジェクトの保存
        await this.saveProject(project);
        
        // 自動バックアップも作成
        await this.createBackup(project, '自動バックアップ', 'auto');
        
        callback();
        console.log('自動保存・自動バックアップ完了');
      } catch (error) {
        console.error('自動保存エラー:', error);
        // エラーが発生してもアプリケーションは継続
      }
    }, this.autoSaveInterval);
  }

  // 自動保存停止
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }


  // 型安全な日付変換ヘルパー関数
  private safeDateConversion(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    console.warn('無効な日付値:', value);
    return new Date();
  }

  // 型安全な配列チェック
  private isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  // 型安全なオブジェクトチェック
  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // データインポート
  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      // バージョン1のデータ（履歴・ログなし）とバージョン2のデータ（履歴・ログあり）に対応
      const isVersion2 = data.version === 2;
      
      if (data.projects && this.isArray(data.projects)) {
        // プロジェクトの日付フィールドを変換
        const processedProjects = data.projects.map((project: unknown) => {
          if (!this.isObject(project)) {
            console.warn('無効なプロジェクトデータ:', project);
            return null;
          }

          return {
            ...project,
            createdAt: this.safeDateConversion(project.createdAt),
            updatedAt: this.safeDateConversion(project.updatedAt),
            // imageBoardのaddedAtも変換
            imageBoard: this.isArray(project.imageBoard) 
              ? project.imageBoard.map((img: unknown) => {
                  if (!this.isObject(img)) return img;
                  return {
                    ...img,
                    addedAt: this.safeDateConversion(img.addedAt)
                  };
                })
              : [],
            // chaptersの日付も変換（もしあれば）
            chapters: this.isArray(project.chapters)
              ? project.chapters.map((chapter: unknown) => {
                  if (!this.isObject(chapter)) return chapter;
                  const result: Record<string, unknown> = { ...chapter };
                  
                  if (chapter.createdAt) {
                    result.createdAt = this.safeDateConversion(chapter.createdAt);
                  }
                  if (chapter.updatedAt) {
                    result.updatedAt = this.safeDateConversion(chapter.updatedAt);
                  }
                  
                  return result;
                })
              : [],
          };
        }).filter((project: unknown): project is StoredProject => project !== null);
        
        await db.projects.bulkPut(processedProjects);
      }
      
      if (data.backups && this.isArray(data.backups)) {
        // バックアップの日付フィールドを変換（圧縮対応）
        const processedBackups = data.backups.map((backup: unknown) => {
          if (!this.isObject(backup)) {
            console.warn('無効なバックアップデータ:', backup);
            return null;
          }

          const backupData = backup.data;
          
          // 圧縮されている場合は文字列のまま、そうでない場合はオブジェクトとして処理
          if (typeof backupData === 'string') {
            // 圧縮データまたはJSON文字列
            return {
              ...backup,
              createdAt: this.safeDateConversion(backup.createdAt),
              data: backupData,
              compressed: backup.compressed || false,
            };
          } else if (this.isObject(backupData)) {
            // 古い形式（オブジェクト）の場合はJSON文字列に変換
            const jsonData = JSON.stringify({
              ...backupData,
              createdAt: this.safeDateConversion(backupData.createdAt),
              updatedAt: this.safeDateConversion(backupData.updatedAt),
              imageBoard: this.isArray(backupData.imageBoard)
                ? backupData.imageBoard.map((img: unknown) => {
                    if (!this.isObject(img)) return img;
                    return {
                      ...img,
                      addedAt: this.safeDateConversion(img.addedAt)
                    };
                  })
                : []
            });
            
            return {
              ...backup,
              createdAt: this.safeDateConversion(backup.createdAt),
              data: jsonData,
              compressed: false,
            };
          } else {
            console.warn('無効なバックアップデータのdataフィールド:', backupData);
            return null;
          }
        }).filter((backup: unknown): backup is ProjectBackup => backup !== null);
        
        await db.backups.bulkPut(processedBackups);
      }
      
      if (data.settings && this.isArray(data.settings)) {
        await db.settings.bulkPut(data.settings);
      }

      // バージョン2のデータの場合、履歴とAIログもインポート
      if (isVersion2) {
        if (data.histories && this.isArray(data.histories)) {
          const processedHistories = data.histories.map((history: unknown) => {
            if (!this.isObject(history)) return null;
            return {
              ...history,
              timestamp: typeof history.timestamp === 'number' 
                ? history.timestamp 
                : Date.now(),
            };
          }).filter((h: unknown): h is StoredChapterHistoryEntry => h !== null);
          
          await db.chapterHistories.bulkPut(processedHistories);
        }

        if (data.aiLogs && this.isArray(data.aiLogs)) {
          const processedAILogs = data.aiLogs.map((log: unknown) => {
            if (!this.isObject(log)) return null;
            return {
              ...log,
              timestamp: this.safeDateConversion(log.timestamp),
            };
          }).filter((l: unknown): l is StoredAILogEntry => l !== null);
          
          await db.aiLogs.bulkPut(processedAILogs);
        }
      }

      console.log('データインポート完了');
    } catch (error) {
      console.error('データインポートエラー:', error);
      throw new Error('無効なデータ形式です');
    }
  }

  // データベースクリア
  async clearAllData(): Promise<void> {
    await db.projects.clear();
    await db.backups.clear();
    await db.settings.clear();
    await db.chapterHistories.clear();
    await db.aiLogs.clear();
    await db.images.clear();
    console.log('全データを削除しました');
  }

  // ==================== 履歴管理機能 ====================

  // 履歴エントリの保存
  async saveHistoryEntry(
    projectId: string,
    chapterId: string,
    entry: Omit<ChapterHistoryEntry, 'id' | 'timestamp'>
  ): Promise<string> {
    const settings = await this.getSettings();
    const maxEntries = settings.maxHistoryEntries || 30;

    const newEntry: StoredChapterHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      projectId,
      chapterId,
    };

    await db.chapterHistories.add(newEntry);

    // 最大件数を超えた場合、古いエントリを削除
    await this.cleanupOldHistoryEntries(projectId, chapterId, maxEntries);

    return newEntry.id;
  }

  // 履歴エントリの取得（章別）
  async getHistoryEntries(projectId: string, chapterId: string): Promise<ChapterHistoryEntry[]> {
    try {
      // 複合インデックスを使用してクエリ
      const entries = await db.chapterHistories
        .where('[projectId+chapterId]')
        .equals([projectId, chapterId])
        .sortBy('timestamp');

      // 降順で返す（新しいものから）
      return entries
        .reverse()
        .map(({ projectId: _, chapterId: __, ...entry }) => entry);
    } catch (error) {
      // 複合インデックスが使えない場合は、フィルターで代替
      console.warn('複合インデックスクエリに失敗、フィルターで代替:', error);
      const allEntries = await db.chapterHistories
        .where('projectId')
        .equals(projectId)
        .filter(entry => entry.chapterId === chapterId)
        .sortBy('timestamp');
      
      return allEntries
        .reverse()
        .map(({ projectId: _, chapterId: __, ...entry }) => entry);
    }
  }

  // 履歴エントリの取得（プロジェクト全体）
  async getAllHistoryEntries(projectId: string): Promise<StoredChapterHistoryEntry[]> {
    return await db.chapterHistories
      .where('projectId')
      .equals(projectId)
      .sortBy('timestamp');
  }

  // 履歴エントリの削除
  async deleteHistoryEntry(entryId: string): Promise<void> {
    await db.chapterHistories.delete(entryId);
  }

  // 章の履歴をすべて削除
  async deleteChapterHistory(projectId: string, chapterId: string): Promise<void> {
    try {
      await db.chapterHistories
        .where('[projectId+chapterId]')
        .equals([projectId, chapterId])
        .delete();
    } catch (error) {
      // 複合インデックスが使えない場合は、フィルターで代替
      console.warn('複合インデックス削除に失敗、フィルターで代替:', error);
      const entries = await db.chapterHistories
        .where('projectId')
        .equals(projectId)
        .filter(entry => entry.chapterId === chapterId)
        .toArray();
      await Promise.all(entries.map(e => db.chapterHistories.delete(e.id)));
    }
  }

  // プロジェクトの履歴をすべて削除
  async deleteProjectHistory(projectId: string): Promise<void> {
    await db.chapterHistories.where('projectId').equals(projectId).delete();
  }

  // 古い履歴エントリのクリーンアップ
  private async cleanupOldHistoryEntries(
    projectId: string,
    chapterId: string,
    maxEntries: number
  ): Promise<void> {
    try {
      const entries = await db.chapterHistories
        .where('[projectId+chapterId]')
        .equals([projectId, chapterId])
        .sortBy('timestamp');

      if (entries.length > maxEntries) {
        const toDelete = entries.slice(0, entries.length - maxEntries);
        await Promise.all(toDelete.map(e => db.chapterHistories.delete(e.id)));
      }
    } catch (error) {
      // 複合インデックスが使えない場合は、フィルターで代替
      console.warn('複合インデックスクリーンアップに失敗、フィルターで代替:', error);
      const allEntries = await db.chapterHistories
        .where('projectId')
        .equals(projectId)
        .filter(entry => entry.chapterId === chapterId)
        .sortBy('timestamp');
      
      if (allEntries.length > maxEntries) {
        const toDelete = allEntries.slice(0, allEntries.length - maxEntries);
        await Promise.all(toDelete.map(e => db.chapterHistories.delete(e.id)));
      }
    }
  }

  // 保持期間を超えた履歴の自動削除
  async cleanupExpiredHistoryEntries(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.autoCleanupHistory || !settings.historyRetentionDays) return;

    const cutoffDate = Date.now() - settings.historyRetentionDays * 24 * 60 * 60 * 1000;
    const expiredEntries = await db.chapterHistories
      .where('timestamp')
      .below(cutoffDate)
      .toArray();

    if (expiredEntries.length > 0) {
      await Promise.all(expiredEntries.map(e => db.chapterHistories.delete(e.id)));
      console.log(`${expiredEntries.length}件の古い履歴を削除しました`);
    }
  }

  // 日付指定で履歴を削除
  async deleteHistoryEntriesBeforeDate(cutoffDate: Date, projectId?: string): Promise<number> {
    let query = db.chapterHistories.where('timestamp').below(cutoffDate.getTime());
    
    const entries = await query.toArray();
    
    // プロジェクトIDが指定されている場合はフィルタリング
    const filteredEntries = projectId 
      ? entries.filter(e => e.projectId === projectId)
      : entries;

    if (filteredEntries.length > 0) {
      await Promise.all(filteredEntries.map(e => db.chapterHistories.delete(e.id)));
    }

    return filteredEntries.length;
  }

  // LocalStorageからIndexedDBへの履歴データ移行
  async migrateHistoryFromLocalStorage(): Promise<{ migrated: number; errors: number }> {
    let migrated = 0;
    let errors = 0;

    try {
      // LocalStorageのすべてのキーを取得
      const keys = Object.keys(localStorage);
      const historyKeys = keys.filter(key => key.startsWith('chapterHistory_'));

      for (const key of historyKeys) {
        try {
          const stored = localStorage.getItem(key);
          if (!stored) continue;

          // キーからprojectIdとchapterIdを抽出
          // 形式: chapterHistory_${projectId}_${chapterId}
          const parts = key.replace('chapterHistory_', '').split('_');
          if (parts.length < 2) continue;

          const projectId = parts[0];
          const chapterId = parts.slice(1).join('_'); // chapterIdに_が含まれる場合に対応

          const entries: ChapterHistoryEntry[] = JSON.parse(stored);

          // 各エントリをIndexedDBに保存
          for (const entry of entries) {
            const storedEntry: StoredChapterHistoryEntry = {
              ...entry,
              projectId,
              chapterId,
            };

            // 既に存在する場合はスキップ（重複防止）
            const existing = await db.chapterHistories.get(entry.id);
            if (!existing) {
              await db.chapterHistories.add(storedEntry);
              migrated++;
            }
          }

          // 移行成功後、LocalStorageから削除（オプション）
          // localStorage.removeItem(key);
        } catch (error) {
          console.error(`履歴移行エラー (${key}):`, error);
          errors++;
        }
      }

      console.log(`履歴データ移行完了: ${migrated}件移行, ${errors}件エラー`);
    } catch (error) {
      console.error('履歴データ移行中にエラーが発生しました:', error);
    }

    return { migrated, errors };
  }

  // ==================== AIログ管理機能 ====================

  // AIログエントリの保存
  async saveAILogEntry(
    projectId: string,
    logEntry: Omit<StoredAILogEntry, 'id' | 'timestamp'>
  ): Promise<string> {
    const settings = await this.getSettings();
    
    // 永続化が無効の場合は保存しない
    if (settings.persistAILogs === false) {
      return '';
    }

    const newEntry: StoredAILogEntry = {
      ...logEntry,
      id: logEntry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: logEntry.timestamp || new Date(),
      projectId,
      type: logEntry.type,
      prompt: logEntry.prompt,
      response: logEntry.response,
    };

    await db.aiLogs.add(newEntry);

    // 最大件数を超えた場合、古いエントリを削除
    const maxEntries = settings.maxAILogEntries || 100;
    await this.cleanupOldAILogEntries(projectId, maxEntries);

    return newEntry.id;
  }

  // AIログエントリの取得（プロジェクト別）
  async getAILogEntries(projectId: string, chapterId?: string): Promise<StoredAILogEntry[]> {
    let query = db.aiLogs.where('projectId').equals(projectId);
    
    if (chapterId) {
      query = query.filter(log => log.chapterId === chapterId);
    }

    const entries = await query.sortBy('timestamp');
    return entries.reverse(); // 新しいものから
  }

  // AIログエントリの削除
  async deleteAILogEntry(entryId: string): Promise<void> {
    await db.aiLogs.delete(entryId);
  }

  // プロジェクトのAIログをすべて削除
  async deleteProjectAILogs(projectId: string): Promise<void> {
    await db.aiLogs.where('projectId').equals(projectId).delete();
  }

  // 章のAIログをすべて削除
  async deleteChapterAILogs(projectId: string, chapterId: string): Promise<void> {
    try {
      await db.aiLogs
        .where('[projectId+chapterId]')
        .equals([projectId, chapterId])
        .delete();
    } catch (error) {
      // 複合インデックスが使えない場合は、フィルターで代替
      console.warn('複合インデックス削除に失敗、フィルターで代替:', error);
      const entries = await db.aiLogs
        .where('projectId')
        .equals(projectId)
        .filter(log => log.chapterId === chapterId)
        .toArray();
      await Promise.all(entries.map(e => db.aiLogs.delete(e.id)));
    }
  }

  // 古いAIログエントリのクリーンアップ
  private async cleanupOldAILogEntries(projectId: string, maxEntries: number): Promise<void> {
    const entries = await db.aiLogs
      .where('projectId')
      .equals(projectId)
      .sortBy('timestamp');

    if (entries.length > maxEntries) {
      const toDelete = entries.slice(0, entries.length - maxEntries);
      await Promise.all(toDelete.map(e => db.aiLogs.delete(e.id)));
    }
  }

  // 保持期間を超えたAIログの自動削除
  async cleanupExpiredAILogEntries(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.autoCleanupAILogs || !settings.aiLogRetentionDays) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (settings.aiLogRetentionDays || 30));

    const expiredEntries = await db.aiLogs
      .where('timestamp')
      .below(cutoffDate)
      .toArray();

    if (expiredEntries.length > 0) {
      await Promise.all(expiredEntries.map(e => db.aiLogs.delete(e.id)));
      console.log(`${expiredEntries.length}件の古いAIログを削除しました`);
    }
  }

  // 日付指定でAIログを削除
  async deleteAILogEntriesBeforeDate(cutoffDate: Date, projectId?: string): Promise<number> {
    const entries = await db.aiLogs
      .where('timestamp')
      .below(cutoffDate)
      .toArray();

    // プロジェクトIDが指定されている場合はフィルタリング
    const filteredEntries = projectId 
      ? entries.filter(e => e.projectId === projectId)
      : entries;

    if (filteredEntries.length > 0) {
      await Promise.all(filteredEntries.map(e => db.aiLogs.delete(e.id)));
    }

    return filteredEntries.length;
  }

  // LocalStorageのクリーンアップ
  async cleanupLocalStorage(): Promise<{
    cleaned: number;
    items: string[];
  }> {
    const cleanedItems: string[] = [];
    let cleanedCount = 0;

    try {
      // すべてのLocalStorageキーを取得
      const keys = Object.keys(localStorage);
      
      // プロジェクトIDのリストを取得（存在するプロジェクトのみ）
      const projects = await this.getAllProjects();
      const projectIds = new Set(projects.map(p => p.id));

      for (const key of keys) {
        let shouldDelete = false;

        // 移行済みの履歴データ（chapterHistory_で始まる）
        if (key.startsWith('chapterHistory_')) {
          shouldDelete = true;
        }
        // 移行完了フラグ（既に移行済みなので不要）
        else if (key === 'historyMigrationDone') {
          shouldDelete = true;
        }
        // カスタムプロンプト（存在しないプロジェクトのもの）
        else if (key.startsWith('customPrompt_') || key.startsWith('useCustomPrompt_')) {
          const projectId = key.replace('customPrompt_', '').replace('useCustomPrompt_', '');
          if (!projectIds.has(projectId)) {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          localStorage.removeItem(key);
          cleanedItems.push(key);
          cleanedCount++;
        }
      }

      console.log(`LocalStorageクリーンアップ完了: ${cleanedCount}件削除`);
    } catch (error) {
      console.error('LocalStorageクリーンアップエラー:', error);
    }

    return {
      cleaned: cleanedCount,
      items: cleanedItems,
    };
  }

  // データベース統計の拡張
  async getStats(): Promise<{
    projectCount: number;
    backupCount: number;
    historyCount: number;
    aiLogCount: number;
    imageCount: number;
    totalSize: string;
  }> {
    const projectCount = await db.projects.count();
    const backupCount = await db.backups.count();
    const historyCount = await db.chapterHistories.count();
    const aiLogCount = await db.aiLogs.count();
    const imageCount = await db.images.count();
    
    // 簡易的なサイズ計算
    const projects = await db.projects.toArray();
    const backups = await db.backups.toArray();
    const histories = await db.chapterHistories.toArray();
    const aiLogs = await db.aiLogs.toArray();
    
    // 画像のサイズ計算（Blobのサイズを合計）
    const images = await db.images.toArray();
    const imageSize = images.reduce((sum, img) => sum + img.compressedSize, 0);
    
    const totalSize = JSON.stringify([...projects, ...backups, ...histories, ...aiLogs]).length + imageSize;
    
    // KBまたはMB形式で表示（1MB以上はMB表示）
    const sizeInKB = totalSize / 1024;
    const sizeDisplay = sizeInKB >= 1024 
      ? `${(sizeInKB / 1024).toFixed(2)} MB`
      : `${sizeInKB.toFixed(1)} KB`;
    
    return {
      projectCount,
      backupCount,
      historyCount,
      aiLogCount,
      imageCount,
      totalSize: sizeDisplay,
    };
  }

  // データエクスポートの拡張
  async exportData(): Promise<string> {
    const projects = await db.projects.toArray();
    const backups = await db.backups.toArray();
    const settings = await db.settings.toArray();
    const histories = await db.chapterHistories.toArray();
    const aiLogs = await db.aiLogs.toArray();

    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      projects,
      backups,
      settings,
      histories,
      aiLogs,
    };

    return JSON.stringify(exportData, null, 2);
  }

  // ==================== 画像Blobストレージ管理機能 ====================

  // 画像を保存（WebP形式に変換して保存）
  async saveImage(
    blob: Blob,
    originalFormat: string,
    originalSize: number,
    width: number,
    height: number
  ): Promise<string> {
    try {
      const { optimizeImageToWebP } = await import('../utils/performanceUtils');
      
      // WebP形式に変換
      const webpBlob = await optimizeImageToWebP(
        blob instanceof File ? blob : new File([blob], 'image', { type: originalFormat }),
        1920,
        1080,
        0.8
      );

      const imageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storedImage: StoredImage = {
        id: imageId,
        blob: webpBlob,
        originalFormat,
        originalSize,
        compressedSize: webpBlob.size,
        width,
        height,
        createdAt: new Date(),
        lastAccessed: new Date(),
        referenceCount: 0,
      };

      await db.images.add(storedImage);
      return imageId;
    } catch (error) {
      console.error('画像保存エラー:', error);
      throw error;
    }
  }

  // 画像を取得（BlobからURLを生成）
  async getImageUrl(imageId: string): Promise<string | null> {
    try {
      const storedImage = await db.images.get(imageId);
      if (!storedImage) return null;

      // 最終アクセス日時を更新
      await db.images.update(imageId, {
        lastAccessed: new Date(),
      });

      // Blob URLを生成
      return URL.createObjectURL(storedImage.blob);
    } catch (error) {
      console.error('画像取得エラー:', error);
      return null;
    }
  }

  // 画像のBlobを直接取得
  async getImageBlob(imageId: string): Promise<Blob | null> {
    try {
      const storedImage = await db.images.get(imageId);
      if (!storedImage) return null;

      // 最終アクセス日時を更新
      await db.images.update(imageId, {
        lastAccessed: new Date(),
      });

      return storedImage.blob;
    } catch (error) {
      console.error('画像Blob取得エラー:', error);
      return null;
    }
  }

  // 画像の参照カウントを増やす
  async incrementImageReference(imageId: string): Promise<void> {
    try {
      const storedImage = await db.images.get(imageId);
      if (storedImage) {
        await db.images.update(imageId, {
          referenceCount: storedImage.referenceCount + 1,
        });
      }
    } catch (error) {
      console.error('画像参照カウント更新エラー:', error);
    }
  }

  // 画像の参照カウントを減らす
  async decrementImageReference(imageId: string): Promise<void> {
    try {
      const storedImage = await db.images.get(imageId);
      if (storedImage) {
        const newCount = Math.max(0, storedImage.referenceCount - 1);
        await db.images.update(imageId, {
          referenceCount: newCount,
        });

        // 参照が0になった場合は削除（オプション）
        // if (newCount === 0) {
        //   await db.images.delete(imageId);
        // }
      }
    } catch (error) {
      console.error('画像参照カウント更新エラー:', error);
    }
  }

  // 画像を削除
  async deleteImage(imageId: string): Promise<void> {
    await db.images.delete(imageId);
  }

  // 未使用画像のクリーンアップ（参照カウントが0で、一定期間アクセスされていない）
  async cleanupUnusedImages(daysUnused: number = 180): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysUnused);

    const unusedImages = await db.images
      .where('referenceCount')
      .equals(0)
      .and(img => img.lastAccessed < cutoffDate)
      .toArray();

    if (unusedImages.length > 0) {
      await Promise.all(unusedImages.map(img => db.images.delete(img.id)));
      console.log(`${unusedImages.length}件の未使用画像を削除しました`);
    }

    return unusedImages.length;
  }

  // Base64画像をBlobストレージに移行
  async migrateBase64ImageToBlob(base64Url: string): Promise<string | null> {
    try {
      // Base64データURIからBlobを作成
      const base64Data = base64Url.split(',')[1] || base64Url;
      const mimeMatch = base64Url.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });

      // 画像のサイズを取得
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = base64Url;
      });

      // Blobストレージに保存
      const imageId = await this.saveImage(
        blob,
        mimeType,
        blob.size,
        img.width,
        img.height
      );

      return imageId;
    } catch (error) {
      console.error('Base64画像の移行エラー:', error);
      return null;
    }
  }

  // ==================== データベース最適化（VACUUM相当） ====================

  /**
   * データベースの最適化（VACUUM相当）
   * 
   * IndexedDBには直接的なVACUUMコマンドはありませんが、以下の処理を行います：
   * 1. 未使用データの削除（孤立した画像、古い履歴など）
   * 2. 参照カウントの整合性チェック
   * 3. 断片化の解消（オプション：全データを再構築）
   * 4. Blob URLの解放
   * 
   * @param options 最適化オプション
   * @returns 最適化結果の統計情報
   */
  async optimizeDatabase(options: {
    removeOrphanedImages?: boolean; // 孤立した画像を削除
    removeUnusedImages?: boolean; // 未使用画像を削除（参照カウント0）
    removeOldHistory?: boolean; // 古い履歴を削除
    removeOldAILogs?: boolean; // 古いAIログを削除
    compactDatabase?: boolean; // データベースの再構築（時間がかかる）
    daysUnused?: number; // 未使用とみなす日数（デフォルト: 180日）
  } = {}): Promise<{
    removedImages: number;
    removedHistories: number;
    removedAILogs: number;
    removedOrphanedImages: number;
    freedSpace: string; // 解放された容量（概算）
    compacted: boolean;
  }> {
    const {
      removeOrphanedImages = true,
      removeUnusedImages = true,
      removeOldHistory = true,
      removeOldAILogs = true,
      compactDatabase = false,
      daysUnused = 180,
    } = options;

    let removedImages = 0;
    let removedHistories = 0;
    let removedAILogs = 0;
    let removedOrphanedImages = 0;
    let freedSpaceBytes = 0;

    try {
      // 1. 未使用画像の削除
      if (removeUnusedImages) {
        const unusedCount = await this.cleanupUnusedImages(daysUnused);
        removedImages = unusedCount;
        
        // 削除された画像のサイズを概算（平均サイズを仮定）
        const deletedImages = await db.images
          .where('referenceCount')
          .equals(0)
          .and(img => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysUnused);
            return img.lastAccessed < cutoffDate;
          })
          .toArray();
        
        freedSpaceBytes += deletedImages.reduce((sum, img) => sum + img.compressedSize, 0);
      }

      // 2. 孤立した画像の削除（どのプロジェクトからも参照されていない）
      if (removeOrphanedImages) {
        const allProjects = await this.getAllProjects();
        const usedImageIds = new Set<string>();
        
        // すべてのプロジェクトで使用されている画像IDを収集
        for (const project of allProjects) {
          if (project.imageBoard) {
            for (const image of project.imageBoard) {
              if (image.imageId) {
                usedImageIds.add(image.imageId);
              }
            }
          }
        }

        // 使用されていない画像を検索
        const allImages = await db.images.toArray();
        const orphanedImages = allImages.filter(img => !usedImageIds.has(img.id));
        
        if (orphanedImages.length > 0) {
          await Promise.all(orphanedImages.map(img => db.images.delete(img.id)));
          removedOrphanedImages = orphanedImages.length;
          freedSpaceBytes += orphanedImages.reduce((sum, img) => sum + img.compressedSize, 0);
          console.log(`${orphanedImages.length}件の孤立した画像を削除しました`);
        }
      }

      // 3. 古い履歴の削除
      if (removeOldHistory) {
        const settings = await this.getSettings();
        if (settings.autoCleanupHistory && settings.historyRetentionDays) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - settings.historyRetentionDays);
          removedHistories = await this.deleteHistoryEntriesBeforeDate(cutoffDate);
        }
      }

      // 4. 古いAIログの削除
      if (removeOldAILogs) {
        const settings = await this.getSettings();
        if (settings.autoCleanupAILogs && settings.aiLogRetentionDays) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - (settings.aiLogRetentionDays || 30));
          removedAILogs = await this.deleteAILogEntriesBeforeDate(cutoffDate);
        }
      }

      // 5. データベースの再構築（コンパクト化）
      // 注意: この処理は時間がかかり、大量のメモリを使用する可能性があります
      if (compactDatabase) {
        console.log('データベースの再構築を開始します...');
        
        // すべてのデータをエクスポート
        const exportData = await this.exportData();
        const data = JSON.parse(exportData);
        
        // すべてのテーブルをクリア
        await db.projects.clear();
        await db.backups.clear();
        await db.chapterHistories.clear();
        await db.aiLogs.clear();
        // 画像テーブルは保持（Blobデータのため再構築が困難）
        
        // データを再インポート
        await this.importData(exportData);
        
        console.log('データベースの再構築が完了しました');
      }

      return {
        removedImages,
        removedHistories,
        removedAILogs,
        removedOrphanedImages,
        freedSpace: `${(freedSpaceBytes / 1024).toFixed(1)} KB`,
        compacted: compactDatabase,
      };
    } catch (error) {
      console.error('データベース最適化エラー:', error);
      throw error;
    }
  }

  /**
   * 定期的な自動最適化（軽量版）
   * 重い処理（compactDatabase）は含まれません
   */
  async performAutoOptimization(): Promise<void> {
    try {
      const result = await this.optimizeDatabase({
        removeOrphanedImages: true,
        removeUnusedImages: true,
        removeOldHistory: true,
        removeOldAILogs: true,
        compactDatabase: false, // 自動実行では重い処理は行わない
        daysUnused: 180,
      });

      console.log('自動最適化が完了しました:', result);
    } catch (error) {
      console.error('自動最適化エラー:', error);
      // エラーが発生してもアプリケーションは継続
    }
  }
}

export const databaseService = new DatabaseService();