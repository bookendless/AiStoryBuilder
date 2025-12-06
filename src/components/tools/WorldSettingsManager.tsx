import React, { useState, useMemo } from 'react';
import { Globe, Plus, Search, Edit2, Trash2, X, Save, Tag, Sparkles, Loader2, Wand2, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { useProject, WorldSetting } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { getUserFriendlyErrorMessage } from '../../utils/apiUtils';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { Modal } from '../common/Modal';
import { useToast } from '../Toast';
import { EmptyState } from '../common/EmptyState';

interface WorldSettingsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryLabels: Record<WorldSetting['category'], { label: string; color: string }> = {
  geography: { label: '地理・場所', color: 'bg-blue-500' },
  society: { label: '社会・制度', color: 'bg-green-500' },
  culture: { label: '文化・風習', color: 'bg-purple-500' },
  technology: { label: '技術・科学', color: 'bg-cyan-500' },
  magic: { label: '魔法・超自然', color: 'bg-pink-500' },
  history: { label: '歴史', color: 'bg-amber-500' },
  politics: { label: '政治・統治', color: 'bg-red-500' },
  economy: { label: '経済', color: 'bg-emerald-500' },
  religion: { label: '宗教', color: 'bg-indigo-500' },
  other: { label: 'その他', color: 'bg-gray-500' },
};

export const WorldSettingsManager: React.FC<WorldSettingsManagerProps> = ({ isOpen, onClose }) => {
  const { currentProject, updateProject } = useProject();
  const { showError, showWarning } = useToast();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSetting, setEditingSetting] = useState<WorldSetting | null>(null);
  const [formData, setFormData] = useState<Partial<WorldSetting>>({
    title: '',
    content: '',
    category: 'other',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMode, setAiMode] = useState<'generate' | 'enhance' | 'expand'>('generate');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiCategory, setAiCategory] = useState<WorldSetting['category']>('other');
  const [aiResult, setAiResult] = useState<{ title: string; content: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedSettingForAI, setSelectedSettingForAI] = useState<WorldSetting | null>(null);
  const { settings, isConfigured } = useAI();

  const worldSettings = currentProject?.worldSettings || [];

  // フィルタリング
  const filteredSettings = useMemo(() => {
    let filtered = worldSettings;

    // カテゴリでフィルタ
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(setting => setting.category === selectedCategory);
    }

    // 検索でフィルタ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(setting =>
        setting.title.toLowerCase().includes(query) ||
        setting.content.toLowerCase().includes(query) ||
        setting.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [worldSettings, selectedCategory, searchQuery]);

  // カテゴリ別の件数
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: worldSettings.length };
    worldSettings.forEach(setting => {
      counts[setting.category] = (counts[setting.category] || 0) + 1;
    });
    return counts;
  }, [worldSettings]);

  if (!isOpen || !currentProject) return null;

  const handleAddSetting = () => {
    if (!formData.title || !formData.content) {
      showWarning('タイトルと内容は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    const now = new Date();
    const newSetting: WorldSetting = {
      id: Date.now().toString(),
      title: formData.title,
      content: formData.content,
      category: formData.category || 'other',
      tags: formData.tags || [],
      relatedLocations: formData.relatedLocations,
      relatedCharacters: formData.relatedCharacters,
      relatedEvents: formData.relatedEvents,
      createdAt: now,
      updatedAt: now,
      aiGenerated: formData.aiGenerated,
      aiPrompt: formData.aiPrompt,
    };

    updateProject({
      worldSettings: [...worldSettings, newSetting],
    });

    // フォームリセット
    setFormData({
      title: '',
      content: '',
      category: 'other',
      tags: [],
    });
    setTagInput('');
    setShowAddForm(false);
  };

  const handleEditSetting = (setting: WorldSetting) => {
    setEditingSetting(setting);
    setFormData({
      title: setting.title,
      content: setting.content,
      category: setting.category,
      tags: setting.tags || [],
      relatedLocations: setting.relatedLocations,
      relatedCharacters: setting.relatedCharacters,
      relatedEvents: setting.relatedEvents,
      aiGenerated: setting.aiGenerated,
      aiPrompt: setting.aiPrompt,
    });
    setTagInput('');
    setShowAddForm(true);
  };

  const handleUpdateSetting = () => {
    if (!editingSetting || !formData.title || !formData.content) {
      showWarning('タイトルと内容は必須です', 5000, {
        title: '入力エラー',
      });
      return;
    }

    const updatedSetting: WorldSetting = {
      ...editingSetting,
      title: formData.title,
      content: formData.content,
      category: formData.category || 'other',
      tags: formData.tags || [],
      relatedLocations: formData.relatedLocations,
      relatedCharacters: formData.relatedCharacters,
      relatedEvents: formData.relatedEvents,
      updatedAt: new Date(),
    };

    updateProject({
      worldSettings: worldSettings.map(setting =>
        setting.id === editingSetting.id ? updatedSetting : setting
      ),
    });

    // フォームリセット
    setEditingSetting(null);
    setFormData({
      title: '',
      content: '',
      category: 'other',
      tags: [],
    });
    setTagInput('');
    setShowAddForm(false);
  };

  const handleDeleteSetting = (id: string) => {
    if (!confirm('この世界観設定を削除しますか？')) {
      return;
    }

    updateProject({
      worldSettings: worldSettings.filter(setting => setting.id !== id),
    });
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const newTag = tagInput.trim();
    if (!formData.tags?.includes(newTag)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag],
      });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag) || [],
    });
  };

  const handleCancelEdit = () => {
    setEditingSetting(null);
    setFormData({
      title: '',
      content: '',
      category: 'other',
      tags: [],
    });
    setTagInput('');
    setShowAddForm(false);
  };

  // AI生成機能
  const handleAIGenerate = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (!currentProject) return;

    // 新規生成モードの場合はカテゴリが必須
    if (aiMode === 'generate' && !aiCategory) {
      showWarning('カテゴリを選択してください。', 5000, {
        title: '選択エラー',
      });
      return;
    }

    setIsAIGenerating(true);
    setAiError(null);
    setAiResult(null);

    try {
      let prompt = '';

      // 既存の世界観情報をまとめる
      const existingWorldInfo = worldSettings.length > 0
        ? worldSettings.map(ws => `【${ws.title}】\n${ws.content.substring(0, 200)}...`).join('\n\n')
        : 'なし';

      // キャラクター情報をまとめる
      const charactersInfo = currentProject.characters && currentProject.characters.length > 0
        ? currentProject.characters.map(char =>
          `名前: ${char.name}\n役割: ${char.role}\n外見: ${char.appearance}\n性格: ${char.personality}\n背景: ${char.background}`
        ).join('\n\n')
        : 'なし';

      // プロット基礎設定をまとめる
      const plotInfo = currentProject.plot
        ? `テーマ: ${currentProject.plot.theme || '未設定'}\n舞台設定: ${currentProject.plot.setting || '未設定'}\nフック: ${currentProject.plot.hook || '未設定'}\n主人公の目標: ${currentProject.plot.protagonistGoal || '未設定'}\n主要な障害: ${currentProject.plot.mainObstacle || '未設定'}${currentProject.plot.ending ? `\n結末: ${currentProject.plot.ending}` : ''}`
        : 'なし';

      if (aiMode === 'generate') {
        // 新規生成
        prompt = aiService.buildPrompt('world', 'generate', {
          title: currentProject.title || '',
          theme: currentProject.theme || currentProject.projectTheme || '',
          mainGenre: currentProject.mainGenre || '',
          subGenre: currentProject.subGenre || '',
          targetReader: currentProject.targetReader || '',
          description: currentProject.description || '',
          characters: charactersInfo,
          plotInfo: plotInfo,
          existingWorldInfo,
          category: categoryLabels[aiCategory].label,
          instruction: aiInstruction || '作品に適した世界観設定を生成してください',
        });
      } else if (aiMode === 'enhance') {
        // 既存設定の強化
        if (!selectedSettingForAI) {
          showWarning('強化する世界観設定を選択してください', 5000, {
            title: '選択エラー',
          });
          setIsAIGenerating(false);
          return;
        }
        prompt = aiService.buildPrompt('world', 'enhance', {
          title: selectedSettingForAI.title,
          category: categoryLabels[selectedSettingForAI.category].label,
          content: selectedSettingForAI.content,
          projectTitle: currentProject.title || '',
          theme: currentProject.theme || currentProject.projectTheme || '',
          mainGenre: currentProject.mainGenre || '',
          subGenre: currentProject.subGenre || '',
          instruction: aiInstruction || 'より詳細で魅力的な設定に強化してください',
        });
      } else if (aiMode === 'expand') {
        // 既存設定からの展開
        if (!selectedSettingForAI) {
          showWarning('展開元の世界観設定を選択してください', 5000, {
            title: '選択エラー',
          });
          setIsAIGenerating(false);
          return;
        }
        prompt = aiService.buildPrompt('world', 'expand', {
          sourceTitle: selectedSettingForAI.title,
          sourceCategory: categoryLabels[selectedSettingForAI.category].label,
          sourceContent: selectedSettingForAI.content,
          targetCategory: categoryLabels[aiCategory].label,
          instruction: aiInstruction || '元の設定と一貫性を保ちながら新しい側面を展開してください',
        });
      }

      const response = await aiService.generateContent({
        prompt,
        type: 'world',
        settings,
      });

      if (response.error) {
        // エラーメッセージを日本語化
        const friendlyError = getUserFriendlyErrorMessage(new Error(response.error), 'AI生成');
        setAiError(friendlyError);
        return;
      }

      if (response.content) {
        // AI応答を解析してタイトルと内容を抽出
        const content = response.content.trim();

        // 【タイトル】と【詳細】の形式で解析
        const titleMatch = content.match(/【タイトル】\s*(.+?)(?:\n|【|$)/);
        const contentMatch = content.match(/【詳細】\s*([\s\S]+?)(?:\n【|$)/);

        let title = '';
        let extractedContent = '';

        // タイトルの抽出
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        } else {
          // 最初の行をタイトルとして使用
          const firstLine = content.split('\n')[0].trim();
          if (firstLine && firstLine.length < 100 && !firstLine.includes('【詳細')) {
            title = firstLine.replace(/^【|】$/g, '').trim();
          } else {
            title = `AI生成された世界観設定（${categoryLabels[aiCategory].label}）`;
          }
        }

        // 【詳細】セクションのみを抽出
        if (contentMatch && contentMatch[1]) {
          extractedContent = contentMatch[1].trim();
        } else {
          // 【詳細】が見つからない場合、タイトル行を除いた内容を使用
          const lines = content.split('\n');
          const detailIndex = lines.findIndex(line => line.includes('【詳細'));

          if (detailIndex >= 0) {
            // 【詳細】以降の内容を取得（次の【】セクションまで）
            const detailStart = detailIndex + 1;
            const nextSectionIndex = lines.findIndex((line, idx) =>
              idx > detailIndex && line.match(/^【[^】]+】/)
            );

            if (nextSectionIndex > 0) {
              extractedContent = lines.slice(detailStart, nextSectionIndex).join('\n').trim();
            } else {
              extractedContent = lines.slice(detailStart).join('\n').trim();
            }
          } else {
            // 【詳細】が見つからない場合、タイトル行を除いた全体を使用
            const titleLineIndex = lines.findIndex(line => line.includes('【タイトル'));
            if (titleLineIndex >= 0) {
              extractedContent = lines.slice(titleLineIndex + 1).join('\n').replace(/^【詳細】\s*/gm, '').trim();
            } else {
              extractedContent = lines.slice(1).join('\n').trim() || content;
            }
          }
        }

        setAiResult({
          title: title || `AI生成された世界観設定（${categoryLabels[aiCategory].label}）`,
          content: extractedContent || content,
        });
      } else {
        // コンテンツが空の場合
        setAiError('AIからの応答が空でした。もう一度お試しください。');
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      // エラーメッセージを日本語化
      const friendlyError = getUserFriendlyErrorMessage(error, 'AI生成');
      setAiError(friendlyError);
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleApplyAIResult = () => {
    if (!aiResult) return;

    const now = new Date();
    const newSetting: WorldSetting = {
      id: Date.now().toString(),
      title: aiResult.title,
      content: aiResult.content,
      category: aiMode === 'expand' ? aiCategory : (selectedSettingForAI?.category || aiCategory),
      tags: [],
      createdAt: now,
      updatedAt: now,
      aiGenerated: true,
    };

    updateProject({
      worldSettings: [...worldSettings, newSetting],
    });

    // リセット
    setAiResult(null);
    setAiInstruction('');
    setShowAIAssistant(false);
    setSelectedSettingForAI(null);
  };

  const handleEnhanceApply = () => {
    if (!aiResult || !selectedSettingForAI) return;

    const updatedSetting: WorldSetting = {
      ...selectedSettingForAI,
      title: aiResult.title,
      content: aiResult.content,
      updatedAt: new Date(),
    };

    updateProject({
      worldSettings: worldSettings.map(setting =>
        setting.id === selectedSettingForAI.id ? updatedSetting : setting
      ),
    });

    // リセット
    setAiResult(null);
    setAiInstruction('');
    setShowAIAssistant(false);
    setSelectedSettingForAI(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center space-x-3">
            <Globe className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              世界観設定管理
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
              ({worldSettings.length}件)
            </span>
          </div>
        }
        size="xl"
        ref={modalRef}
      >
        <div className="flex flex-col h-[80vh]">
          {/* ツールバー */}
          <div className="pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
            {/* 検索と追加ボタン */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
                />
              </div>
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setEditingSetting(null);
                  setFormData({
                    title: '',
                    content: '',
                    category: 'other',
                    tags: [],
                  });
                  setTagInput('');
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
              >
                <Plus className="h-5 w-5" />
                <span>新規作成</span>
              </button>
              <button
                onClick={() => {
                  setShowAIAssistant(true);
                  setAiMode('generate');
                  setAiResult(null);
                  setAiError(null);
                  setAiInstruction('');
                  setSelectedSettingForAI(null);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isConfigured}
                title={!isConfigured ? 'AI設定が必要です' : 'AIで世界観を生成'}
              >
                <Sparkles className="h-5 w-5" />
                <span>AI生成</span>
              </button>
            </div>

            {/* カテゴリタブ */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${selectedCategory === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                すべて ({categoryCounts.all || 0})
              </button>
              {Object.entries(categoryLabels).map(([category, { label, color }]) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${selectedCategory === category
                      ? `${color} text-white`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {label} ({categoryCounts[category] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="flex-1 overflow-hidden pt-4">
            {/* 設定一覧 */}
            <div className="overflow-y-auto">
              {filteredSettings.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <EmptyState
                    icon={Globe}
                    iconColor="text-indigo-400 dark:text-indigo-500"
                    title={searchQuery || selectedCategory !== 'all'
                      ? '条件に一致する世界観設定が見つかりません'
                      : '世界観設定がありません'}
                    description={searchQuery || selectedCategory !== 'all'
                      ? `「${searchQuery || categoryLabels[selectedCategory as WorldSetting['category']].label}」に一致する世界観設定が見つかりませんでした。検索条件やカテゴリを変更して再度お試しください。`
                      : '物語の世界観を詳細に設定しましょう。地理、社会制度、文化、技術、魔法など、物語の舞台となる世界の様々な側面を定義できます。AI生成機能を使って、プロジェクトの設定に基づいて自動的に世界観を生成することも可能です。'}
                    actionLabel={searchQuery || selectedCategory !== 'all' ? undefined : '最初の設定を作成'}
                    onAction={searchQuery || selectedCategory !== 'all' ? undefined : () => {
                      setShowAddForm(true);
                      setEditingSetting(null);
                      setFormData({
                        title: '',
                        content: '',
                        category: 'other',
                        tags: [],
                      });
                      setTagInput('');
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSettings.map((setting) => {
                    const categoryInfo = categoryLabels[setting.category];
                    return (
                      <div
                        key={setting.id}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col min-h-[200px]"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium text-white ${categoryInfo.color}`}
                              >
                                {categoryInfo.label}
                              </span>
                              {setting.aiGenerated && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200">
                                  AI生成
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-1">
                              {setting.title}
                            </h3>
                          </div>
                          <div className="flex items-center space-x-1">
                            {isConfigured && (
                              <>
                                <button
                                  onClick={() => {
                                    setShowAIAssistant(true);
                                    setAiMode('enhance');
                                    setSelectedSettingForAI(setting);
                                    setAiResult(null);
                                    setAiError(null);
                                    setAiInstruction('');
                                  }}
                                  className="p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                                  aria-label="AI強化"
                                  title="AIで強化"
                                >
                                  <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </button>
                                <button
                                  onClick={() => {
                                    setShowAIAssistant(true);
                                    setAiMode('expand');
                                    setSelectedSettingForAI(setting);
                                    setAiResult(null);
                                    setAiError(null);
                                    setAiInstruction('');
                                  }}
                                  className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                                  aria-label="AI展開"
                                  title="AIで展開"
                                >
                                  <Wand2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleEditSetting(setting)}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-label="編集"
                            >
                              <Edit2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteSetting(setting.id)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                              aria-label="削除"
                            >
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2 flex-1 overflow-y-auto max-h-40">
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {setting.content}
                          </p>
                        </div>
                        {setting.tags && setting.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {setting.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                              >
                                <Tag className="h-3 w-3 mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-['Noto_Sans_JP']">
                          更新: {new Date(setting.updatedAt).toLocaleDateString('ja-JP')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 追加/編集フォームモーダル */}
      <Modal
        isOpen={showAddForm}
        onClose={handleCancelEdit}
        title={editingSetting ? '世界観設定を編集' : '世界観設定を追加'}
        size="md"
        className="z-[60]"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
              placeholder="例: エルフの森の生態系"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              カテゴリ <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category || 'other'}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as WorldSetting['category'] })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
            >
              {Object.entries(categoryLabels).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP'] resize-y"
              placeholder="世界観の詳細な説明を記入してください..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              タグ
            </label>
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
                placeholder="タグを入力してEnter"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
              >
                追加
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-indigo-900 dark:hover:text-indigo-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              キャンセル
            </button>
            <button
              onClick={editingSetting ? handleUpdateSetting : handleAddSetting}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
            >
              <Save className="h-5 w-5" />
              <span>{editingSetting ? '更新' : '作成'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* AIアシスタントモーダル */}
      <Modal
        isOpen={showAIAssistant}
        onClose={() => {
          setShowAIAssistant(false);
          setAiResult(null);
          setAiError(null);
          setAiInstruction('');
          setSelectedSettingForAI(null);
        }}
        title={
          <div className="flex items-center space-x-3">
            <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <span className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              AI世界観生成
            </span>
          </div>
        }
        size="lg"
        className="z-[60]"
      >
        <div className="flex flex-col space-y-4">
          {/* モード選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              モード
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setAiMode('generate');
                  setSelectedSettingForAI(null);
                  setAiResult(null);
                  setAiError(null);
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors font-['Noto_Sans_JP'] ${aiMode === 'generate'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <Wand2 className="h-4 w-4 inline mr-2" />
                新規生成
              </button>
              <button
                onClick={() => {
                  setAiMode('enhance');
                  setAiResult(null);
                  setAiError(null);
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors font-['Noto_Sans_JP'] ${aiMode === 'enhance'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                disabled={worldSettings.length === 0}
              >
                <Zap className="h-4 w-4 inline mr-2" />
                強化
              </button>
              <button
                onClick={() => {
                  setAiMode('expand');
                  setAiResult(null);
                  setAiError(null);
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors font-['Noto_Sans_JP'] ${aiMode === 'expand'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                disabled={worldSettings.length === 0}
              >
                <Sparkles className="h-4 w-4 inline mr-2" />
                展開
              </button>
            </div>
          </div>

          {/* 選択された設定表示（enhance/expandモード） */}
          {(aiMode === 'enhance' || aiMode === 'expand') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                {aiMode === 'enhance' ? '強化する設定' : '展開元の設定'}
              </label>
              {!selectedSettingForAI && (
                <select
                  value=""
                  onChange={(e) => {
                    const setting = worldSettings.find(ws => ws.id === e.target.value);
                    if (setting) {
                      setSelectedSettingForAI(setting);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 font-['Noto_Sans_JP'] mb-2"
                >
                  <option value="">設定を選択してください</option>
                  {worldSettings.map(setting => (
                    <option key={setting.id} value={setting.id}>
                      {setting.title} ({categoryLabels[setting.category].label})
                    </option>
                  ))}
                </select>
              )}
              {selectedSettingForAI ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {selectedSettingForAI.title}
                    </span>
                    <button
                      onClick={() => setSelectedSettingForAI(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] line-clamp-2">
                    {selectedSettingForAI.content}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* カテゴリ選択（generate/expandモード） */}
          {(aiMode === 'generate' || aiMode === 'expand') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                カテゴリ {aiMode === 'generate' && <span className="text-red-500">*</span>}
              </label>
              <select
                value={aiCategory}
                onChange={(e) => setAiCategory(e.target.value as WorldSetting['category'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 font-['Noto_Sans_JP']"
              >
                {Object.entries(categoryLabels).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 指示入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              追加指示（オプション）
            </label>
            <textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              rows={3}
              placeholder="例: 魔法システムの詳細を追加してください"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-['Noto_Sans_JP'] resize-y"
            />
          </div>

          {/* エラー表示 */}
          {aiError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 font-['Noto_Sans_JP']">
                  エラーが発生しました
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1 font-['Noto_Sans_JP']">
                  {aiError}
                </p>
              </div>
            </div>
          )}

          {/* 結果表示 */}
          {aiResult && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 font-['Noto_Sans_JP']">
                    AI生成が完了しました
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-1">
                      タイトル
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {aiResult.title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-1">
                      内容
                    </p>
                    <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP']">
                        {aiResult.content}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={aiMode === 'enhance' ? handleEnhanceApply : handleApplyAIResult}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-['Noto_Sans_JP']"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>{aiMode === 'enhance' ? '更新を適用' : '設定を追加'}</span>
                </button>
                <button
                  onClick={() => {
                    setAiResult(null);
                    setAiError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                >
                  やり直す
                </button>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={() => {
              setShowAIAssistant(false);
              setAiResult(null);
              setAiError(null);
              setAiInstruction('');
              setSelectedSettingForAI(null);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
          >
            閉じる
          </button>
          <button
            onClick={handleAIGenerate}
            disabled={isAIGenerating || (aiMode === 'generate' && !aiCategory) || (aiMode !== 'generate' && !selectedSettingForAI)}
            className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
            title={aiMode === 'generate' && !aiCategory ? 'カテゴリを選択してください' : undefined}
          >
            {isAIGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>生成</span>
              </>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
};
