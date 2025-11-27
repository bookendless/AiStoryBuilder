import React, { useState, useEffect, useCallback } from 'react';
import { Database, Download, Upload, Trash2, Copy, RotateCcw, HardDrive, Save, Clock } from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { useProject, Project } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorHandler';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';
import { Modal } from './common/Modal';

interface DataManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DatabaseStats {
  projectCount: number;
  backupCount: number;
  totalSize: string;
}

interface BackupItem {
  id: string;
  projectId: string;
  type: 'manual' | 'auto';
  description: string;
  createdAt: Date;
  data: Project;
}

export const DataManager: React.FC<DataManagerProps> = ({ isOpen, onClose }) => {
  const { currentProject, loadAllProjects, createManualBackup, setCurrentProject } = useProject();
  const { showError, showSuccess } = useToast();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [manualBackups, setManualBackups] = useState<BackupItem[]>([]);
  const [autoBackups, setAutoBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'backups' | 'import-export'>('overview');
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  const loadStats = async () => {
    try {
      const dbStats = await databaseService.getStats();
      setStats(dbStats);
    } catch (error) {
      console.error('統計読み込みエラー:', error);
    }
  };

  const loadBackups = useCallback(async () => {
    if (!currentProject) return;

    try {
      const [manual, auto] = await Promise.all([
        databaseService.getBackups(currentProject.id, 'manual'),
        databaseService.getBackups(currentProject.id, 'auto')
      ]);
      setManualBackups(manual);
      setAutoBackups(auto);
    } catch (error) {
      console.error('バックアップ読み込みエラー:', error);
    }
  }, [currentProject]);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      if (currentProject) {
        loadBackups();
      }
    }
  }, [isOpen, currentProject, loadBackups]);

  const handleCreateManualBackup = async () => {
    if (!currentProject) return;

    const description = prompt('手動バックアップの説明を入力してください:', '手動バックアップ');
    if (!description) return;

    setIsLoading(true);
    try {
      await createManualBackup(description);
      await loadBackups();
      await loadStats();
      showSuccess('手動バックアップを作成しました', 3000);
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: errorInfo.title,
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('このバックアップから復元しますか？現在の変更は失われます。')) {
      return;
    }

    setIsLoading(true);
    try {
      const restoredProject = await databaseService.restoreFromBackup(backupId);
      await loadAllProjects();

      if (restoredProject) {
        // 復元されたプロジェクトを現在のプロジェクトに設定
        setCurrentProject(restoredProject);
      }

      showSuccess('バックアップから復元しました。ホーム画面に戻ります。', 5000);
      onClose();
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: errorInfo.title,
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    setIsLoading(true);
    try {
      const exportData = await databaseService.exportData();
      const fileName = `story-builder-backup-${new Date().toISOString().split('T')[0]}.json`;

      // Tauri環境の場合、プラグインを動的にインポート
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        // Tauriのダイアログを使用してファイル保存場所を選択
        const filePath = await save({
          title: 'バックアップファイルを保存',
          defaultPath: fileName,
          filters: [
            {
              name: 'JSON Files',
              extensions: ['json']
            }
          ]
        });

        if (filePath) {
          // TauriのファイルシステムAPIを使用してファイルを保存
          await writeTextFile(filePath, exportData);
          showSuccess('データをエクスポートしました', 3000);
        }
      } catch (pluginError) {
        console.error('Tauri plugin error:', pluginError);
        // プラグインが利用できない場合、ブラウザのダウンロード機能にフォールバック
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('データをエクスポートしました（ブラウザダウンロード）', 3000);
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: 'エクスポートエラー',
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('データをインポートしますか？既存のデータと重複する場合は上書きされます。')) {
      return;
    }

    setIsLoading(true);
    try {
      const text = await file.text();
      await databaseService.importData(text);
      await loadAllProjects();
      await loadStats();
      showSuccess('データをインポートしました', 3000);
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: 'インポートエラー',
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleClearAllData = async () => {
    const confirmation = prompt(
      'すべてのデータを削除します。この操作は取り消せません。\n確認のため「DELETE」と入力してください:'
    );

    if (confirmation !== 'DELETE') {
      return;
    }

    setIsLoading(true);
    try {
      await databaseService.clearAllData();
      await loadAllProjects();
      await loadStats();
      showSuccess('すべてのデータを削除しました', 3000);
      onClose();
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 7000, {
        title: 'データ削除エラー',
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
            <Database className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            データ管理
          </h2>
        </div>
      }
      size="xl"
      ref={modalRef}
    >
      {/* Tabs */}
      <div className="flex space-x-1 mb-4">
        {[
          { id: 'overview', label: '概要', icon: HardDrive },
          { id: 'backups', label: 'バックアップ', icon: Copy },
          { id: 'import-export', label: 'インポート・エクスポート', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'backups' | 'import-export')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-['Noto_Sans_JP'] ${activeTab === tab.id
                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                データベース統計
              </h3>

              {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.projectCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      プロジェクト数
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats.backupCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      バックアップ数
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {stats.totalSize}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      使用容量
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-gray-200 dark:bg-gray-700 h-20 rounded-lg"></div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-bold text-red-800 dark:text-red-400 mb-2 font-['Noto_Sans_JP']">
                危険な操作
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4 font-['Noto_Sans_JP']">
                すべてのプロジェクトとバックアップを削除します。この操作は取り消せません。
              </p>
              <button
                onClick={handleClearAllData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
              >
                <Trash2 className="h-4 w-4" />
                <span>すべてのデータを削除</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                {currentProject ? `${currentProject.title} のバックアップ` : 'バックアップ管理'}
              </h3>
              {currentProject && (
                <button
                  onClick={handleCreateManualBackup}
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
                >
                  <Save className="h-4 w-4" />
                  <span>手動バックアップ作成</span>
                </button>
              )}
            </div>

            {!currentProject ? (
              <div className="text-center py-8">
                <Database className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  プロジェクトを選択してバックアップを管理してください
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 手動バックアップ */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Save className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      手動バックアップ (最大5個)
                    </h4>
                  </div>
                  {manualBackups.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Save className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        手動バックアップがありません
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {manualBackups.map((backup) => (
                        <div key={backup.id} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                {backup.description}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                {new Date(backup.createdAt).toLocaleString('ja-JP')}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRestoreBackup(backup.id)}
                              disabled={isLoading}
                              className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>復元</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 自動バックアップ */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      自動バックアップ (最大10個)
                    </h4>
                  </div>
                  {autoBackups.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Clock className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        自動バックアップがありません
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {autoBackups.map((backup) => (
                        <div key={backup.id} className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                {backup.description}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                {new Date(backup.createdAt).toLocaleString('ja-JP')}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRestoreBackup(backup.id)}
                              disabled={isLoading}
                              className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>復元</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'import-export' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                データのエクスポート
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                すべてのプロジェクトとバックアップをJSONファイルとしてエクスポートします。
              </p>
              <button
                onClick={handleExportData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
              >
                <Download className="h-4 w-4" />
                <span>データをエクスポート</span>
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                データのインポート
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                以前にエクスポートしたJSONファイルからデータを復元します。
              </p>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  disabled={isLoading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-['Noto_Sans_JP']"
                >
                  <Upload className="h-4 w-4" />
                  <span>ファイルを選択してインポート</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                <span className="text-gray-900 dark:text-white font-['Noto_Sans_JP']">処理中...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};