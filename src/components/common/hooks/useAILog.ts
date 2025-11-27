import { useState, useCallback } from 'react';
import { AILogEntry } from '../types';

const MAX_LOGS = 10;

export const useAILog = (maxLogs: number = MAX_LOGS) => {
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);

  const addLog = useCallback((logEntry: Omit<AILogEntry, 'id' | 'timestamp'>) => {
    const newLog: AILogEntry = {
      ...logEntry,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setAiLogs(prev => [newLog, ...prev.slice(0, maxLogs - 1)]);
    return newLog;
  }, [maxLogs]);

  const clearLogs = useCallback(() => {
    setAiLogs([]);
  }, []);

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

  const downloadLogs = useCallback((filename?: string): string => {
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

    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `ai_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return logsText;
  }, [aiLogs]);

  return {
    aiLogs,
    addLog,
    clearLogs,
    copyLog,
    downloadLogs,
  };
};

