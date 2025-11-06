import React, { useState, useMemo } from 'react';
import { BookOpen, Plus, Search, Edit2, Trash2, X, Save, Download, Upload } from 'lucide-react';
import { useProject, GlossaryTerm } from '../../contexts/ProjectContext';

interface GlossaryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryLabels: Record<GlossaryTerm['category'], string> = {
  character: 'キャラクター',
  location: '場所・舞台',
  concept: '概念・用語',
  item: 'アイテム',
  other: 'その他',
};

export const GlossaryManager: React.FC<GlossaryManagerProps> = ({ isOpen, onClose }) => {
  const { currentProject, updateProject } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [formData, setFormData] = useState<Partial<GlossaryTerm>>({
    term: '',
    reading: '',
    definition: '',
    category: 'other',
    notes: '',
  });
  const [showImportExport, setShowImportExport] = useState(false);

  const glossary = currentProject?.glossary || [];

  // フィルタリング
  const filteredGlossary = useMemo(() => {
    let filtered = glossary;

    // カテゴリでフィルタ
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(term => term.category === selectedCategory);
    }

    // 検索でフィルタ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(term =>
        term.term.toLowerCase().includes(query) ||
        term.reading?.toLowerCase().includes(query) ||
        term.definition.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [glossary, selectedCategory, searchQuery]);

  if (!isOpen || !currentProject) return null;

  const handleAddTerm = () => {
    if (!formData.term || !formData.definition) {
      alert('用語と説明は必須です');
      return;
    }

    const newTerm: GlossaryTerm = {
      id: Date.now().toString(),
      term: formData.term,
      reading: formData.reading || undefined,
      definition: formData.definition,
      category: formData.category || 'other',
      notes: formData.notes || undefined,
      createdAt: new Date(),
    };

    updateProject({
      glossary: [...glossary, newTerm],
    });

    // フォームリセット
    setFormData({
      term: '',
      reading: '',
      definition: '',
      category: 'other',
      notes: '',
    });
    setShowAddForm(false);
  };

  const handleEditTerm = (term: GlossaryTerm) => {
    setEditingTerm(term);
    setFormData(term);
    setShowAddForm(true);
  };

  const handleUpdateTerm = () => {
    if (!editingTerm || !formData.term || !formData.definition) {
      alert('用語と説明は必須です');
      return;
    }

    const updatedTerms = glossary.map(term =>
      term.id === editingTerm.id
        ? {
            ...term,
            term: formData.term!,
            reading: formData.reading || undefined,
            definition: formData.definition!,
            category: formData.category || 'other',
            notes: formData.notes || undefined,
          }
        : term
    );

    updateProject({
      glossary: updatedTerms,
    });

    setEditingTerm(null);
    setFormData({
      term: '',
      reading: '',
      definition: '',
      category: 'other',
      notes: '',
    });
    setShowAddForm(false);
  };

  const handleDeleteTerm = (termId: string) => {
    if (!confirm('この用語を削除しますか？')) return;

    updateProject({
      glossary: glossary.filter(term => term.id !== termId),
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(glossary, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProject.title}_用語集.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as GlossaryTerm[];
        
        // IDの再生成
        const importedWithNewIds = imported.map(term => ({
          ...term,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          createdAt: new Date(),
        }));

        updateProject({
          glossary: [...glossary, ...importedWithNewIds],
        });
        
        alert(`${imported.length}件の用語をインポートしました`);
        setShowImportExport(false);
      } catch (error) {
        alert('インポートに失敗しました: ファイル形式が正しくありません');
      }
    };
    reader.readAsText(file);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingTerm(null);
    setFormData({
      term: '',
      reading: '',
      definition: '',
      category: 'other',
      notes: '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              用語集管理
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="エクスポート"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowImportExport(true)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="インポート"
            >
              <Upload className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 検索とフィルタ */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="用語を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">すべて</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span className="font-['Noto_Sans_JP']">追加</span>
              </button>
            </div>
          </div>
        </div>

        {/* 用語リスト */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredGlossary.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                {searchQuery || selectedCategory !== 'all' ? '検索結果がありません' : '用語が登録されていません'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredGlossary.map((term) => (
                <div
                  key={term.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                          {term.term}
                        </h3>
                        {term.reading && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">({term.reading})</span>
                        )}
                        <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full font-['Noto_Sans_JP']">
                          {categoryLabels[term.category]}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                        {term.definition}
                      </p>
                      {term.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic font-['Noto_Sans_JP']">
                          {term.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditTerm(term)}
                        className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTerm(term.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 追加/編集フォーム */}
        {showAddForm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    {editingTerm ? '用語を編集' : '用語を追加'}
                  </h3>
                  <button
                    onClick={handleCloseForm}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      用語 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.term}
                      onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="例：魔王"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      読み方（ひらがな、カタカナ）
                    </label>
                    <input
                      type="text"
                      value={formData.reading}
                      onChange={(e) => setFormData({ ...formData, reading: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="例：まおう"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      説明 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.definition}
                      onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
                      placeholder="用語の説明を入力してください"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      カテゴリ
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as GlossaryTerm['category'] })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      備考
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
                      placeholder="追加情報や使用例など"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-4 pt-4">
                    <button
                      onClick={handleCloseForm}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={editingTerm ? handleUpdateTerm : handleAddTerm}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Save className="h-5 w-5" />
                      <span className="font-['Noto_Sans_JP']">保存</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* インポートダイアログ */}
        {showImportExport && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    インポート
                  </h3>
                  <button
                    onClick={() => setShowImportExport(false)}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    JSON形式のファイルを選択してください
                  </p>
                  <label className="block">
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                      <div className="text-center">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                          ファイルを選択
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setShowImportExport(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

