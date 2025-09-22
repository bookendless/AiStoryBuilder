import React, { useState, useEffect, useCallback } from 'react';
import { X, Database, Download, Upload, Trash2, Copy, RotateCcw, HardDrive, Save, Clock } from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { useProject, Project } from '../contexts/ProjectContext';

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
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [manualBackups, setManualBackups] = useState<BackupItem[]>([]);
  const [autoBackups, setAutoBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'backups' | 'import-export'>('overview');

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
    } catch (_error) {
      alert('手動バックアップの作成に失敗しました');
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
      
      alert('バックアップから復元しました。ホーム画面に戻ります。');
      onClose();
    } catch (_error) {
      alert('復元に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    setIsLoading(true);
    try {
      const exportData = await databaseService.exportData();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `story-builder-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert('データをエクスポートしました');
    } catch (_error) {
      alert('エクスポートに失敗しました');
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
      alert('データをインポートしました');
    } catch (error) {
      alert('インポートに失敗しました: ' + (error as Error).message);
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
      alert('すべてのデータを削除しました');
      onClose();
    } catch (_error) {
      alert('データ削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                データ管理
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mt-4">
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
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-['Noto_Sans_JP'] ${
                    activeTab === tab.id
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
      </div>
    </div>
  );
};