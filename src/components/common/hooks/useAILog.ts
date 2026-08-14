import { useState, useCallback, useEffect } from 'react';
import { AILogEntry } from '../types';
import { databaseService } from '../../../services/databaseService';
import { StoredAILogEntry } from '../../../services/databaseService';
import { exportFile } from '../../../utils/mobileExportUtils';
import { maskSecretsInText } from '../../../utils/securityUtils';
import { getAILogTypeLabel } from '../../../constants/aiLogTypes';

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
    // ログはIndexedDBに永続化され、ファイル書き出しやデータエクスポートにも含まれるため、
    // 保存前にAPIキー等をマスクする。
    const maskedPrompt = maskSecretsInText(logEntry.prompt as string);
    const maskedResponse = maskSecretsInText(logEntry.response as string);
    const maskedError = logEntry.error ? maskSecretsInText(logEntry.error as string) : undefined;

    const newLog: AILogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type: logEntry.type as string,
      ...logEntry,
      prompt: maskedPrompt,
      response: maskedResponse,
      error: maskedError,
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
          prompt: maskedPrompt,
          response: maskedResponse,
          error: maskedError,
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
    const typeLabel = getAILogTypeLabel(log.type);

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
    const logsText = aiLogs.map(log => {
      const typeLabel = getAILogTypeLabel(log.type);
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

