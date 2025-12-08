import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Database, Download, Upload, Trash2, Copy, RotateCcw, HardDrive, Save, Clock, FileText, Eraser, Archive } from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { useProject, Project } from '../contexts/ProjectContext';
import { useToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorHandler';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';
import { Modal } from './common/Modal';
import { PieChart, type PieChartData } from './common/PieChart';

interface DataManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DatabaseStats {
  projectCount: number;
  backupCount: number;
  historyCount?: number;
  aiLogCount?: number;
  totalSize: string;
}

interface BackupItem {
  id: string;
  projectId: string;
  type: 'manual' | 'auto';
  description: string;
  createdAt: Date;
  data: Project;
  compressed?: boolean; // 圧縮されているかどうか
}

export const DataManager: React.FC<DataManagerProps> = ({ isOpen, onClose }) => {
  const { currentProject, loadAllProjects, createManualBackup, setCurrentProject, projects } = useProject();
  const { showError, showSuccess } = useToast();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [manualBackups, setManualBackups] = useState<BackupItem[]>([]);
  const [autoBackups, setAutoBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'backups' | 'cleanup' | 'import-export'>('overview');
  const [historyCleanupDate, setHistoryCleanupDate] = useState<string>('');
  const [historyCleanupProjectId, setHistoryCleanupProjectId] = useState<string>('');
  const [aiLogCleanupDate, setAiLogCleanupDate] = useState<string>('');
  const [aiLogCleanupProjectId, setAiLogCleanupProjectId] = useState<string>('');
  const [projectData, setProjectData] = useState<{
    historyCount: number;
    aiLogCount: number;
    backupCount: number;
  } | null>(null);
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
      // BackupItem形式に変換（compressedフィールドを含む）
      // 注意: 圧縮されているデータはパースしない（表示には不要）
      setManualBackups(manual.map(b => {
        let projectData: Project | null = null;
        // 圧縮されていない場合のみパースを試みる
        if (!b.compressed && typeof b.data === 'string') {
          try {
            projectData = JSON.parse(b.data) as Project;
          } catch (e) {
            console.warn('バックアップデータのパースに失敗:', e);
          }
        } else if (!b.compressed && typeof b.data === 'object') {
          projectData = b.data as Project;
        }
        
        return {
          id: b.id,
          projectId: b.projectId,
          type: b.type,
          description: b.description,
          createdAt: b.createdAt,
          data: projectData || {} as Project, // パースできない場合は空のオブジェクト
          compressed: b.compressed || false,
        };
      }));
      setAutoBackups(auto.map(b => {
        let projectData: Project | null = null;
        // 圧縮されていない場合のみパースを試みる
        if (!b.compressed && typeof b.data === 'string') {
          try {
            projectData = JSON.parse(b.data) as Project;
          } catch (e) {
            console.warn('バックアップデータのパースに失敗:', e);
          }
        } else if (!b.compressed && typeof b.data === 'object') {
          projectData = b.data as Project;
        }
        
        return {
          id: b.id,
          projectId: b.projectId,
          type: b.type,
          description: b.description,
          createdAt: b.createdAt,
          data: projectData || {} as Project, // パースできない場合は空のオブジェクト
          compressed: b.compressed || false,
        };
      }));
    } catch (error) {
      console.error('バックアップ読み込みエラー:', error);
      // エラーが発生しても空の配列を設定して表示を維持
      setManualBackups([]);
      setAutoBackups([]);
    }
  }, [currentProject]);

  // プロジェクト別データの読み込み
  const loadProjectData = useCallback(async () => {
    if (!currentProject) {
      setProjectData(null);
      return;
    }

    try {
      const [projectHistories, projectAILogs, projectBackups] = await Promise.all([
        databaseService.getAllHistoryEntries(currentProject.id),
        databaseService.getAILogEntries(currentProject.id),
        databaseService.getBackups(currentProject.id),
      ]);

      setProjectData({
        historyCount: projectHistories.length,
        aiLogCount: projectAILogs.length,
        backupCount: projectBackups.length,
      });
    } catch (error) {
      console.error('プロジェクトデータ取得エラー:', error);
      setProjectData(null);
    }
  }, [currentProject]);

  // 円グラフ用のデータを準備（トップレベルで定義）
  const chartData = useMemo<PieChartData[]>(() => {
    if (!stats) return [];
    const total = (stats.projectCount || 0) + (stats.backupCount || 0) + (stats.historyCount || 0) + (stats.aiLogCount || 0);
    if (total === 0) {
      return [
        { name: 'データなし', value: 1, color: '#9CA3AF' }
      ];
    }
    return [
      {
        name: 'プロジェクト',
        value: stats.projectCount || 0,
        color: '#3B82F6', // blue-500
      },
      {
        name: 'バックアップ',
        value: stats.backupCount || 0,
        color: '#10B981', // green-500
      },
      {
        name: '履歴',
        value: stats.historyCount || 0,
        color: '#F59E0B', // amber-500
      },
      {
        name: 'AIログ',
        value: stats.aiLogCount || 0,
        color: '#6366F1', // indigo-500
      },
    ].filter(item => item.value > 0);
  }, [stats]);

  // プロジェクト別の円グラフ用データ
  const projectChartData = useMemo<PieChartData[]>(() => {
    if (!projectData) return [];
    const { historyCount, aiLogCount, backupCount } = projectData;
    const total = historyCount + aiLogCount + backupCount;
    
    if (total === 0) {
      return [
        { name: 'データなし', value: 1, color: '#9CA3AF' }
      ];
    }

    return [
      {
        name: '履歴',
        value: historyCount,
        color: '#F59E0B',
      },
      {
        name: 'AIログ',
        value: aiLogCount,
        color: '#6366F1',
      },
      {
        name: 'バックアップ',
        value: backupCount,
        color: '#10B981',
      },
    ].filter(item => item.value > 0);
  }, [projectData]);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      if (currentProject) {
        loadBackups();
        loadProjectData();
      } else {
        setProjectData(null);
      }
    }
  }, [isOpen, currentProject, loadBackups, loadProjectData]);

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

  const handleDeleteBackup = async (backupId: string, backupType: 'manual' | 'auto', description: string) => {
    const backupTypeLabel = backupType === 'manual' ? '手動' : '自動';
    if (!confirm(`${backupTypeLabel}バックアップ「${description}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    setIsLoading(true);
    try {
      await databaseService.deleteBackup(backupId);
      await loadBackups();
      await loadStats();
      await loadProjectData();
      showSuccess('バックアップを削除しました', 3000);
    } catch (error) {
      const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
      showError(errorInfo.message, 5000, {
        title: errorInfo.title,
        details: errorInfo.details || errorInfo.solution,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Tauri環境の検出
  const isTauriEnvironment = (): boolean => {
    if (typeof window === 'undefined') return false;
    const typedWindow = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
    return Boolean(typedWindow.__TAURI_INTERNALS__ || typedWindow.__TAURI__);
  };

  const handleExportData = async () => {
    setIsLoading(true);
    try {
      const exportData = await databaseService.exportData();
      const fileName = `story-builder-backup-${new Date().toISOString().split('T')[0]}.json`;

      // Tauri環境の場合、プラグインを動的にインポート
      const isTauri = isTauriEnvironment();
      if (isTauri) {
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
            return;
          }
        } catch (pluginError) {
          console.warn('Tauri plugin error, falling back to browser download:', pluginError);
          // エラーが発生した場合はブラウザダウンロードにフォールバック
        }
      }

      // ブラウザ環境またはTauriプラグインが使えない場合
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('データをエクスポートしました', 3000);
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
      <div className="flex space-x-1 mb-4 flex-wrap">
        {[
          { id: 'overview', label: '概要', icon: HardDrive },
          { id: 'backups', label: 'バックアップ', icon: Copy },
          { id: 'cleanup', label: 'クリーンアップ', icon: Eraser },
          { id: 'import-export', label: 'インポート・エクスポート', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'backups' | 'cleanup' | 'import-export')}
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
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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

                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {stats.historyCount ?? 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        履歴数
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {stats.aiLogCount ?? 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        AIログ数
                      </div>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {(() => {
                          // KBまたはMB形式で表示
                          const sizeMatch = stats.totalSize.match(/([\d.]+)\s*(KB|MB)/);
                          if (sizeMatch) {
                            const value = parseFloat(sizeMatch[1]);
                            const unit = sizeMatch[2];
                            if (unit === 'KB' && value >= 1024) {
                              return `${(value / 1024).toFixed(2)} MB`;
                            }
                            return stats.totalSize;
                          }
                          return stats.totalSize;
                        })()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        使用容量
                      </div>
                    </div>
                  </div>

                  {/* データ内訳の円グラフ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* データタイプ別の内訳 */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                        データタイプ別の内訳
                      </h4>
                      <PieChart
                        data={chartData}
                        size={200}
                        innerRadius={0.6}
                        showLabels={true}
                        showLegend={true}
                      />
                    </div>

                    {/* プロジェクト別のデータ分布（プロジェクトがある場合のみ） */}
                    {currentProject && (
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                          {currentProject.title} のデータ内訳
                        </h4>
                        {projectData ? (
                          <PieChart
                            data={projectChartData}
                            size={200}
                            innerRadius={0.6}
                            showLabels={true}
                            showLegend={true}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
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
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                  {backup.description}
                                </div>
                                {backup.compressed && (
                                  <span className="flex items-center space-x-1 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-['Noto_Sans_JP']">
                                    <Archive className="h-3 w-3" />
                                    <span>圧縮済み</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                {new Date(backup.createdAt).toLocaleString('ja-JP')}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleRestoreBackup(backup.id)}
                                disabled={isLoading}
                                className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>復元</span>
                              </button>
                              <button
                                onClick={() => handleDeleteBackup(backup.id, backup.type, backup.description)}
                                disabled={isLoading}
                                className="flex items-center space-x-2 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                                title="バックアップを削除"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>削除</span>
                              </button>
                            </div>
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
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                  {backup.description}
                                </div>
                                {backup.compressed && (
                                  <span className="flex items-center space-x-1 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-['Noto_Sans_JP']">
                                    <Archive className="h-3 w-3" />
                                    <span>圧縮済み</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                {new Date(backup.createdAt).toLocaleString('ja-JP')}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleRestoreBackup(backup.id)}
                                disabled={isLoading}
                                className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>復元</span>
                              </button>
                              <button
                                onClick={() => handleDeleteBackup(backup.id, backup.type, backup.description)}
                                disabled={isLoading}
                                className="flex items-center space-x-2 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                                title="バックアップを削除"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>削除</span>
                              </button>
                            </div>
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


        {activeTab === 'cleanup' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                データクリーンアップ
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 font-['Noto_Sans_JP']">
                古いデータや不要なデータを削除して、ストレージを最適化します。
              </p>

              {/* 1. LocalStorageのクリーンアップ（最上部、フル幅） */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                  LocalStorageのクリーンアップ
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
                  移行済みの履歴データや、存在しないプロジェクトの設定データを削除します。
                </p>
                <button
                  onClick={async () => {
                    if (!confirm('LocalStorageの不要なデータを削除しますか？')) {
                      return;
                    }
                    setIsLoading(true);
                    try {
                      const result = await databaseService.cleanupLocalStorage();
                      showSuccess(`${result.cleaned}件のデータを削除しました`, 3000);
                    } catch (error) {
                      showError('LocalStorageのクリーンアップに失敗しました', 5000);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                >
                  <Eraser className="h-4 w-4 inline mr-2" />
                  LocalStorageをクリーンアップ
                </button>
              </div>

              {/* 2. 日付指定クリーンアップ（グリッド2列） */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 履歴のクリーンアップ */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                    履歴のクリーンアップ
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        削除する日付を選択（この日付より古い履歴を削除）
                      </label>
                      <input
                        type="date"
                        value={historyCleanupDate}
                        onChange={(e) => setHistoryCleanupDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        プロジェクトを選択（空欄の場合は全プロジェクト）
                      </label>
                      <select
                        value={historyCleanupProjectId}
                        onChange={(e) => setHistoryCleanupProjectId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">全プロジェクト</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        if (!historyCleanupDate) {
                          showError('日付を選択してください', 3000);
                          return;
                        }
                        if (!confirm(`選択した日付より古い履歴を削除しますか？${historyCleanupProjectId ? `\n対象: ${projects.find(p => p.id === historyCleanupProjectId)?.title || ''}` : '\n対象: 全プロジェクト'}`)) {
                          return;
                        }
                        setIsLoading(true);
                        try {
                          const cutoffDate = new Date(historyCleanupDate);
                          const deleted = await databaseService.deleteHistoryEntriesBeforeDate(
                            cutoffDate,
                            historyCleanupProjectId || undefined
                          );
                          await loadStats();
                          showSuccess(`${deleted}件の履歴を削除しました`, 3000);
                          setHistoryCleanupDate('');
                          setHistoryCleanupProjectId('');
                        } catch (error) {
                          showError('履歴の削除に失敗しました', 5000);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading || !historyCleanupDate}
                      className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                    >
                      <Trash2 className="h-4 w-4 inline mr-2" />
                      履歴を削除
                    </button>
                  </div>
                </div>

                {/* AIログのクリーンアップ */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                    AIログのクリーンアップ
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        削除する日付を選択（この日付より古いAIログを削除）
                      </label>
                      <input
                        type="date"
                        value={aiLogCleanupDate}
                        onChange={(e) => setAiLogCleanupDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        プロジェクトを選択（空欄の場合は全プロジェクト）
                      </label>
                      <select
                        value={aiLogCleanupProjectId}
                        onChange={(e) => setAiLogCleanupProjectId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">全プロジェクト</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        if (!aiLogCleanupDate) {
                          showError('日付を選択してください', 3000);
                          return;
                        }
                        if (!confirm(`選択した日付より古いAIログを削除しますか？${aiLogCleanupProjectId ? `\n対象: ${projects.find(p => p.id === aiLogCleanupProjectId)?.title || ''}` : '\n対象: 全プロジェクト'}`)) {
                          return;
                        }
                        setIsLoading(true);
                        try {
                          const cutoffDate = new Date(aiLogCleanupDate);
                          const deleted = await databaseService.deleteAILogEntriesBeforeDate(
                            cutoffDate,
                            aiLogCleanupProjectId || undefined
                          );
                          await loadStats();
                          showSuccess(`${deleted}件のAIログを削除しました`, 3000);
                          setAiLogCleanupDate('');
                          setAiLogCleanupProjectId('');
                        } catch (error) {
                          showError('AIログの削除に失敗しました', 5000);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading || !aiLogCleanupDate}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                    >
                      <Trash2 className="h-4 w-4 inline mr-2" />
                      AIログを削除
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. プロジェクト別クリーンアップ（グリッド2列） */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 履歴削除（現在のプロジェクト） */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                    履歴の削除
                  </h4>
                  {!currentProject ? (
                    <div className="text-center py-4">
                      <Clock className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        プロジェクトを選択して履歴を管理してください
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {currentProject.title} のすべての履歴を削除します
                      </p>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                          履歴は章ごとに管理されています。各章の履歴は草案編集画面の「履歴管理」タブから確認・削除できます。
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('このプロジェクトのすべての履歴を削除しますか？')) return;
                          setIsLoading(true);
                          try {
                            await databaseService.deleteProjectHistory(currentProject.id);
                            await loadStats();
                            await loadProjectData();
                            showSuccess('履歴を削除しました', 3000);
                          } catch (error) {
                            showError('履歴の削除に失敗しました', 5000);
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                      >
                        <Trash2 className="h-4 w-4 inline mr-2" />
                        すべての履歴を削除
                      </button>
                    </div>
                  )}
                </div>

                {/* AIログ削除（現在のプロジェクト） */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                    AIログの削除
                  </h4>
                  {!currentProject ? (
                    <div className="text-center py-4">
                      <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        プロジェクトを選択してAIログを管理してください
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {currentProject.title} のすべてのAIログを削除します
                      </p>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                          AIログは章ごとに管理されています。各章のAIログは草案編集画面の「AIログ」タブから確認・削除できます。
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('このプロジェクトのすべてのAIログを削除しますか？')) return;
                          setIsLoading(true);
                          try {
                            await databaseService.deleteProjectAILogs(currentProject.id);
                            await loadStats();
                            await loadProjectData();
                            showSuccess('AIログを削除しました', 3000);
                          } catch (error) {
                            showError('AIログの削除に失敗しました', 5000);
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-['Noto_Sans_JP']"
                      >
                        <Trash2 className="h-4 w-4 inline mr-2" />
                        すべてのAIログを削除
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. データベース最適化（フル幅） */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 font-['Noto_Sans_JP']">
                  データベース最適化（VACUUM相当）
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
                  未使用データの削除、参照カウントの整合性チェック、断片化の解消を行います。
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        id="opt-orphaned-images"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>孤立した画像を削除</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        id="opt-unused-images"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>未使用画像を削除（180日以上未使用）</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        id="opt-old-history"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>古い履歴を削除</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        id="opt-old-ailogs"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>古いAIログを削除</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      <input
                        type="checkbox"
                        defaultChecked={false}
                        id="opt-compact"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>データベースを再構築（時間がかかります）</span>
                    </label>
                  </div>
                  <button
                    onClick={async () => {
                      const removeOrphanedImages = (document.getElementById('opt-orphaned-images') as HTMLInputElement)?.checked ?? true;
                      const removeUnusedImages = (document.getElementById('opt-unused-images') as HTMLInputElement)?.checked ?? true;
                      const removeOldHistory = (document.getElementById('opt-old-history') as HTMLInputElement)?.checked ?? true;
                      const removeOldAILogs = (document.getElementById('opt-old-ailogs') as HTMLInputElement)?.checked ?? true;
                      const compactDatabase = (document.getElementById('opt-compact') as HTMLInputElement)?.checked ?? false;

                      if (compactDatabase) {
                        if (!confirm('データベースの再構築は時間がかかり、大量のメモリを使用する可能性があります。続行しますか？')) {
                          return;
                        }
                      } else {
                        if (!confirm('データベースの最適化を実行しますか？')) {
                          return;
                        }
                      }

                      setIsLoading(true);
                      try {
                        const result = await databaseService.optimizeDatabase({
                          removeOrphanedImages,
                          removeUnusedImages,
                          removeOldHistory,
                          removeOldAILogs,
                          compactDatabase,
                          daysUnused: 180,
                        });

                        await loadStats();
                        await loadProjectData();

                        const message = `最適化が完了しました\n\n` +
                          `削除された画像: ${result.removedImages}件\n` +
                          `削除された孤立画像: ${result.removedOrphanedImages}件\n` +
                          `削除された履歴: ${result.removedHistories}件\n` +
                          `削除されたAIログ: ${result.removedAILogs}件\n` +
                          `解放された容量: ${result.freedSpace}\n` +
                          (result.compacted ? `\nデータベースを再構築しました` : '');

                        showSuccess(message, 8000);
                      } catch (error) {
                        const errorInfo = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
                        showError(errorInfo.message, 7000, {
                          title: '最適化エラー',
                          details: errorInfo.details || errorInfo.solution,
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                  >
                    <HardDrive className="h-4 w-4 inline mr-2" />
                    データベースを最適化
                  </button>
                </div>
              </div>

              {/* 5. すべての削除（最下部、フル幅） */}
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