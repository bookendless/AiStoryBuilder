import React, { useState, useEffect } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { getLastBackupTime, getLastBackupError } from '../../services/autoBackupService';

export function AutoBackupStatus(): JSX.Element | null {
  const [lastTime, setLastTime] = useState<Date | null>(getLastBackupTime());
  const [error, setError] = useState<string | null>(getLastBackupError());

  useEffect(() => {
    const onSuccess = () => {
      setLastTime(getLastBackupTime());
      setError(null);
    };

    const onError = () => {
      setError(getLastBackupError());
    };

    window.addEventListener('autobackup:success', onSuccess);
    window.addEventListener('autobackup:error', onError);

    return () => {
      window.removeEventListener('autobackup:success', onSuccess);
      window.removeEventListener('autobackup:error', onError);
    };
  }, []);

  if (!lastTime && !error) return null;

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/80 px-3 py-1.5 text-xs text-red-700 dark:text-red-300 shadow-md">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>バックアップ失敗</span>
      </div>
    );
  }

  const timeLabel = lastTime!.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 text-xs text-sumi-400 dark:text-usuzumi-500">
      <Save className="h-3 w-3 shrink-0" />
      <span>バックアップ: {timeLabel}</span>
    </div>
  );
}
