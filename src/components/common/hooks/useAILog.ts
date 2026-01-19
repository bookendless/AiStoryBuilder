import { useState, useCallback, useEffect } from 'react';
import { AILogEntry } from '../types';
import { databaseService } from '../../../services/databaseService';
import { StoredAILogEntry } from '../../../services/databaseService';
import { exportFile } from '../../../utils/mobileExportUtils';

const MAX_LOGS = 10;

interface UseAILogOptions {
  projectId?: string;
  chapterId?: string;
  maxLogs?: number;
  autoLoad?: boolean;
}

export const useAILog = (options: UseAILogOptions = {}) => {
  const { projectId, chapterId, maxLogs = MAX_LOGS, autoLoad = false } = options;
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ログの読み込み
  const loadLogs = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const storedLogs = await databaseService.getAILogEntries(projectId, chapterId);
      // StoredAILogEntryをAILogEntryに変換
      const logs: AILogEntry[] = storedLogs.slice(0, maxLogs).map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        type: log.type,
        prompt: log.prompt,
        response: log.response,
        error: log.error,
        chapterId: log.chapterId,
        suggestionType: log.suggestionType,
      }));
      setAiLogs(logs);
    } catch (error) {
      console.error('AIログの読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, chapterId, maxLogs]);

  // 自動読み込み
  useEffect(() => {
    if (autoLoad && projectId) {
      loadLogs();
    }
  }, [autoLoad, projectId, chapterId, loadLogs]);

  const addLog = useCallback(async (logEntry: Omit<AILogEntry, 'id' | 'timestamp'>) => {
    const newLog: AILogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type: logEntry.type as string,
      prompt: logEntry.prompt as string,
      response: logEntry.response as string,
      error: logEntry.error as string | undefined,
      ...logEntry,
    };

    // メモリ内の状態を更新
    setAiLogs(prev => [newLog, ...prev.slice(0, maxLogs - 1)]);

    // IndexedDBに保存
    if (projectId) {
      try {
        const storedEntry: Omit<StoredAILogEntry, 'id' | 'timestamp'> = {
          projectId,
          chapterId,
          type: logEntry.type as string,
          prompt: logEntry.prompt as string,
          response: logEntry.response as string,
          error: logEntry.error as string | undefined,
          suggestionType: logEntry.suggestionType as string | undefined,
        };
        await databaseService.saveAILogEntry(projectId, storedEntry);
      } catch (error) {
        console.error('AIログの保存エラー:', error);
      }
    }

    return newLog;
  }, [maxLogs, projectId, chapterId]);

  const copyLog = useCallback((log: AILogEntry): string => {
    const typeLabels: Record<string, string> = {
      'generate': 'あらすじ生成',
      'readable': '読みやすく調整',
      'summary': '要点抽出',
      'engaging': '魅力的に演出',
      'basic': '基本生成',
      'structure': '構造生成',
      'enhance': '強化',
      'generateSingle': '単一生成',
      'continue': '続き生成',
      'suggestions': '提案',
      'generateFull': '全章一括生成',
    };

    const typeLabel = typeLabels[log.type] || log.type;

    const logText = `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}`;

    return logText;
  }, []);

  const downloadLogs = useCallback(async (filename?: string): Promise<{ success: boolean; content: string }> => {
    const typeLabels: Record<string, string> = {
      'generate': 'あらすじ生成',
      'readable': '読みやすく調整',
      'summary': '要点抽出',
      'engaging': '魅力的に演出',
      'basic': '基本生成',
      'structure': '構造生成',
      'enhance': '強化',
      'generateSingle': '単一生成',
      'continue': '続き生成',
      'suggestions': '提案',
      'generateFull': '全章一括生成',
    };

    const logsText = aiLogs.map(log => {
      const typeLabel = typeLabels[log.type] || log.type;
      return `【AIログ - ${typeLabel}】
時刻: ${log.timestamp.toLocaleString('ja-JP')}

【プロンプト】
${log.prompt}

【AI応答】
${log.response}

${log.error ? `【エラー】
${log.error}` : ''}

${'='.repeat(80)}`;
    }).join('\n\n');

    const targetFilename = filename || `ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
    const result = await exportFile({
      filename: targetFilename,
      content: logsText,
      mimeType: 'text/plain',
      title: 'AIログ',
    });

    return { success: result.success, content: logsText };
  }, [aiLogs]);

  const clearLogs = useCallback(async () => {
    setAiLogs([]);

    // IndexedDBからも削除
    if (projectId) {
      try {
        if (chapterId) {
          await databaseService.deleteChapterAILogs(projectId, chapterId);
        } else {
          await databaseService.deleteProjectAILogs(projectId);
        }
      } catch (error) {
        console.error('AIログの削除エラー:', error);
      }
    }
  }, [projectId, chapterId]);

  return {
    aiLogs,
    isLoading,
    addLog,
    clearLogs,
    loadLogs,
    copyLog,
    downloadLogs,
  };
};

