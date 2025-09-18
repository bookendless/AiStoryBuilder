import Dexie, { Table } from 'dexie';
import { Project } from '../contexts/ProjectContext';
import { DataCache } from '../utils/performanceUtils';

export interface StoredProject extends Project {
  version: number;
  lastSaved: Date;
}

export interface ProjectBackup {
  id: string;
  projectId: string;
  data: Project;
  createdAt: Date;
  description: string;
  type: 'manual' | 'auto';
}

export interface AppSettings {
  id: string;
  autoSaveInterval: number;
  maxAutoBackups: number;
  maxManualBackups: number;
  theme: 'light' | 'dark';
  lastOpenedProject?: string;
}

class StoryBuilderDatabase extends Dexie {
  projects!: Table<StoredProject>;
  backups!: Table<ProjectBackup>;
  settings!: Table<AppSettings>;

  constructor() {
    super('StoryBuilderDB');
    
    try {
      this.version(2).stores({
        projects: 'id, title, createdAt, updatedAt, lastSaved, version',
        backups: 'id, projectId, createdAt, description, type',
        settings: 'id'
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
  private autoSaveInterval = 60000; // 1分
  
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

  // プロジェクト保存
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
      
      console.log(`プロジェクト "${project.title}" を保存しました`);
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

  // プロジェクト読み込み
  async loadProject(id: string): Promise<Project | null> {
    try {
      // キャッシュから取得を試行
      const cachedProject = this.projectCache.get(id);
      if (cachedProject) {
        const { version, lastSaved, ...project } = cachedProject;
        return project;
      }

      // データベースから取得
      const storedProject = await db.projects.get(id);
      if (!storedProject) return null;

      // キャッシュに保存
      this.projectCache.set(id, storedProject);

      // StoredProject から Project に変換
      const { version, lastSaved, ...project } = storedProject;
      return project;
    } catch (error) {
      console.error('プロジェクト読み込みエラー:', error);
      return null;
    }
  }

  // 全プロジェクト取得
  async getAllProjects(): Promise<Project[]> {
    try {
      const storedProjects = await db.projects.orderBy('updatedAt').reverse().toArray();
      return storedProjects.map(({ version, lastSaved, ...project }) => project);
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

  // バックアップ作成
  async createBackup(project: Project, description: string = '自動バックアップ', type: 'manual' | 'auto' = 'auto'): Promise<void> {
    const backup: ProjectBackup = {
      id: `${project.id}_${Date.now()}`,
      projectId: project.id,
      data: { ...project },
      createdAt: new Date(),
      description,
      type,
    };

    await db.backups.add(backup);

    // バックアップタイプ別に古いバックアップを削除
    await this.cleanupOldBackups(project.id, type);
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

  // 手動バックアップ作成
  async createManualBackup(project: Project, description: string = '手動バックアップ'): Promise<void> {
    await this.createBackup(project, description, 'manual');
  }

  // バックアップから復元
  async restoreFromBackup(backupId: string): Promise<Project | null> {
    const backup = await db.backups.get(backupId);
    if (!backup) return null;

    const restoredProject: Project = {
      ...backup.data,
      updatedAt: new Date(),
    };

    await this.saveProject(restoredProject);
    return restoredProject;
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
      autoSaveInterval: 60000, // 1分
      maxAutoBackups: 10,
      maxManualBackups: 5,
      theme: 'light',
    };
  }

  // 自動保存開始
  async startAutoSave(project: Project, callback: () => void): Promise<void> {
    this.stopAutoSave();
    
    const settings = await this.getSettings();
    this.autoSaveInterval = settings.autoSaveInterval;
    
    this.autoSaveTimer = setInterval(async () => {
      try {
        // プロジェクトの保存のみ実行（バックアップは別途）
        await this.saveProject(project);
        callback();
        console.log('自動保存完了');
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

  // データベース統計
  async getStats(): Promise<{
    projectCount: number;
    backupCount: number;
    totalSize: string;
  }> {
    const projectCount = await db.projects.count();
    const backupCount = await db.backups.count();
    
    // 簡易的なサイズ計算
    const projects = await db.projects.toArray();
    const backups = await db.backups.toArray();
    const totalSize = JSON.stringify([...projects, ...backups]).length;
    
    return {
      projectCount,
      backupCount,
      totalSize: `${(totalSize / 1024).toFixed(1)} KB`,
    };
  }

  // データエクスポート
  async exportData(): Promise<string> {
    const projects = await db.projects.toArray();
    const backups = await db.backups.toArray();
    const settings = await db.settings.toArray();

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      backups,
      settings,
    };

    return JSON.stringify(exportData, null, 2);
  }

  // データインポート
  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.projects) {
        // プロジェクトの日付フィールドを変換
        const processedProjects = data.projects.map((project: any) => ({
          ...project,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
          // imageBoardのaddedAtも変換
          imageBoard: project.imageBoard?.map((img: any) => ({
            ...img,
            addedAt: new Date(img.addedAt)
          })) || [],
          // chaptersの日付も変換（もしあれば）
          chapters: project.chapters?.map((chapter: any) => ({
            ...chapter,
            // 章に日付フィールドがある場合
            ...(chapter.createdAt && { createdAt: new Date(chapter.createdAt) }),
            ...(chapter.updatedAt && { updatedAt: new Date(chapter.updatedAt) })
          })) || [],
        }));
        
        await db.projects.bulkPut(processedProjects);
      }
      
      if (data.backups) {
        // バックアップの日付フィールドを変換
        const processedBackups = data.backups.map((backup: any) => ({
          ...backup,
          createdAt: new Date(backup.createdAt),
          // バックアップ内のプロジェクトデータも変換
          data: {
            ...backup.data,
            createdAt: new Date(backup.data.createdAt),
            updatedAt: new Date(backup.data.updatedAt),
            imageBoard: backup.data.imageBoard?.map((img: any) => ({
              ...img,
              addedAt: new Date(img.addedAt)
            })) || []
          }
        }));
        
        await db.backups.bulkPut(processedBackups);
      }
      
      if (data.settings) {
        await db.settings.bulkPut(data.settings);
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
    console.log('全データを削除しました');
  }
}

export const databaseService = new DatabaseService();