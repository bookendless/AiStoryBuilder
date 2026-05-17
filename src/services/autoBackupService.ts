import { Project } from '../contexts/ProjectContext';
import Dexie from 'dexie';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const INTERVAL_MS = 600_000;
const MAX_GENERATIONS = 5;

export interface BackupEntry {
  projectId: string;
  filename: string;
  timestamp: number;
  size: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastBackupTime: Date | null = null;
let lastBackupError: string | null = null;

// IndexedDB (Dexie) for browser environment
class BackupDatabase extends Dexie {
  backups!: Dexie.Table<{ id?: number; projectId: string; filename: string; timestamp: number; size: number; data: string }, number>;

  constructor() {
    super('AutoBackupDB');
    this.version(1).stores({
      backups: '++id, projectId, timestamp',
    });
  }
}

let db: BackupDatabase | null = null;

function getDb(): BackupDatabase {
  if (!db) {
    db = new BackupDatabase();
  }
  return db;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

// projectId 自体に `_` が含まれうるため、末尾固定長 (YYYYMMDD_HHMMSS) で解釈する
function parseTimestampFromFilename(filename: string): number {
  const stamp = filename.replace(/\.json$/, '').slice(-15);
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(stamp);
  if (!match) return 0;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
}

async function saveToTauri(project: Project): Promise<BackupEntry> {
  const { writeTextFile, readDir, remove, BaseDirectory, mkdir } = await import('@tauri-apps/plugin-fs');

  await mkdir('backups', { baseDir: BaseDirectory.AppLocalData, recursive: true });

  const now = new Date();
  const filename = `${project.id}_${formatTimestamp(now)}.json`;
  const data = JSON.stringify(project);

  await writeTextFile(`backups/${filename}`, data, { baseDir: BaseDirectory.AppLocalData });

  // 世代管理: 古いバックアップを削除
  const entries = await readDir('backups', { baseDir: BaseDirectory.AppLocalData });
  const projectEntries = entries
    .filter(e => e.name && e.name.startsWith(`${project.id}_`) && e.name.endsWith('.json'))
    .map(e => e.name!)
    .sort();

  if (projectEntries.length > MAX_GENERATIONS) {
    const toDelete = projectEntries.slice(0, projectEntries.length - MAX_GENERATIONS);
    for (const name of toDelete) {
      await remove(`backups/${name}`, { baseDir: BaseDirectory.AppLocalData });
    }
  }

  return {
    projectId: project.id,
    filename,
    timestamp: now.getTime(),
    size: new TextEncoder().encode(data).length,
  };
}

async function saveToBrowser(project: Project): Promise<BackupEntry> {
  const database = getDb();
  const now = new Date();
  const filename = `${project.id}_${formatTimestamp(now)}.json`;
  const data = JSON.stringify(project);
  const size = new TextEncoder().encode(data).length;

  await database.backups.add({
    projectId: project.id,
    filename,
    timestamp: now.getTime(),
    size,
    data,
  });

  // 世代管理
  const all = await database.backups
    .where('projectId')
    .equals(project.id)
    .sortBy('timestamp');

  if (all.length > MAX_GENERATIONS) {
    const toDelete = all.slice(0, all.length - MAX_GENERATIONS);
    await database.backups.bulkDelete(toDelete.map(e => e.id!));
  }

  return {
    projectId: project.id,
    filename,
    timestamp: now.getTime(),
    size,
  };
}

export async function triggerBackupNow(project: Project): Promise<void> {
  try {
    const entry = isTauri ? await saveToTauri(project) : await saveToBrowser(project);
    lastBackupTime = new Date(entry.timestamp);
    lastBackupError = null;
    window.dispatchEvent(new CustomEvent('autobackup:success', { detail: entry }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastBackupError = message;
    console.error('自動バックアップ失敗:', err);
    window.dispatchEvent(new CustomEvent('autobackup:error', { detail: { message } }));
  }
}

export function startAutoBackup(getProject: () => Project | null): void {
  stopAutoBackup();

  intervalId = setInterval(async () => {
    const project = getProject();
    if (!project) return;
    await triggerBackupNow(project);
  }, INTERVAL_MS);
}

export function stopAutoBackup(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export async function listBackups(projectId: string): Promise<BackupEntry[]> {
  if (isTauri) {
    try {
      const { readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir('backups', { baseDir: BaseDirectory.AppLocalData });
      return entries
        .filter(e => e.name && e.name.startsWith(`${projectId}_`) && e.name.endsWith('.json'))
        .map(e => {
          const name = e.name!;
          return {
            projectId,
            filename: name,
            timestamp: parseTimestampFromFilename(name),
            size: 0,
          };
        });
    } catch {
      return [];
    }
  } else {
    try {
      const database = getDb();
      const all = await database.backups
        .where('projectId')
        .equals(projectId)
        .sortBy('timestamp');
      return all.map(({ projectId, filename, timestamp, size }) => ({
        projectId,
        filename,
        timestamp,
        size,
      }));
    } catch {
      return [];
    }
  }
}

export function getLastBackupTime(): Date | null {
  return lastBackupTime;
}

export function getLastBackupError(): string | null {
  return lastBackupError;
}
