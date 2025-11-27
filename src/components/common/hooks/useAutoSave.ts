import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  delay?: number; // 自動保存の遅延時間（ミリ秒）
  immediate?: boolean; // 即座に保存するか
}

interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
}

export const useAutoSave = <T>(
  value: T,
  saveFn: (value: T, immediate?: boolean) => Promise<void>,
  options: UseAutoSaveOptions = {}
) => {
  const { delay = 2000, immediate = false } = options;
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus['status']>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastValueRef = useRef<T>(value);
  const isInitialMount = useRef(true);

  // 初期マウント時は保存しない
  useEffect(() => {
    if (isInitialMount.current) {
      lastValueRef.current = value;
      isInitialMount.current = false;
      return;
    }
  }, []);

  // 値の比較関数（オブジェクトの深い比較に対応）
  const isValueEqual = useCallback((a: T, b: T): boolean => {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }
    // オブジェクトの場合はJSON文字列化して比較
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }, []);

  // 保存処理
  const performSave = useCallback(async (immediateSave: boolean = false) => {
    if (isValueEqual(value, lastValueRef.current)) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await saveFn(value, immediateSave);
      lastValueRef.current = value;
      setLastSaved(new Date());
      setSaveStatus('saved');

      // 3秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');

      // 5秒後にステータスをリセット
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  }, [value, saveFn, isValueEqual]);

  // 手動保存
  const handleSave = useCallback(async () => {
    await performSave(true);
  }, [performSave]);

  // 自動保存機能
  useEffect(() => {
    if (isInitialMount.current) return;
    if (isValueEqual(value, lastValueRef.current)) return;

    // 既存のタイムアウトをクリア
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 遅延後に自動保存を実行
    saveTimeoutRef.current = setTimeout(async () => {
      await performSave(immediate);
    }, delay) as unknown as number;

    // クリーンアップ
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [value, delay, immediate, performSave, isValueEqual]);

  return {
    isSaving,
    saveStatus,
    lastSaved,
    handleSave,
  };
};

