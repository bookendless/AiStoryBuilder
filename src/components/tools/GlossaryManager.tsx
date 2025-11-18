import React, { useState, useMemo } from 'react';
import { BookOpen, Plus, Search, Edit2, Trash2, X, Save, Download, Upload, Sparkles, Loader2, Wand2, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { useProject, GlossaryTerm } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';

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
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMode, setAiMode] = useState<'extract' | 'generate' | 'bulk'>('extract');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<Partial<GlossaryTerm>[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const { settings, isConfigured } = useAI();

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
      } catch (_error) {
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

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // オーバーレイ自体がクリックされた場合のみ閉じる
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // プロジェクトコンテキストを取得
  const getProjectContext = (): string => {
    if (!currentProject) return '';
    
    let context = `プロジェクトタイトル: ${currentProject.title}\n`;
    context += `テーマ: ${currentProject.theme || currentProject.projectTheme || '未設定'}\n`;
    context += `メインジャンル: ${currentProject.mainGenre || currentProject.genre || '未設定'}\n`;
    context += `サブジャンル: ${currentProject.subGenre || '未設定'}\n\n`;
    
    if (currentProject.synopsis) {
      context += `あらすじ:\n${currentProject.synopsis}\n\n`;
    }
    
    if (currentProject.plot) {
      context += `プロット設定:\n`;
      context += `- テーマ: ${currentProject.plot.theme || '未設定'}\n`;
      context += `- 舞台: ${currentProject.plot.setting || '未設定'}\n`;
      context += `- 主人公の目標: ${currentProject.plot.protagonistGoal || '未設定'}\n`;
      context += `- 主要な障害: ${currentProject.plot.mainObstacle || '未設定'}\n\n`;
    }
    
    if (currentProject.characters && currentProject.characters.length > 0) {
      context += `キャラクター:\n`;
      currentProject.characters.forEach(char => {
        context += `- ${char.name}: ${char.description || char.role || ''}\n`;
      });
      context += '\n';
    }
    
    // 章の内容を取得
    if (currentProject.chapters && currentProject.chapters.length > 0) {
      context += `章の内容:\n`;
      currentProject.chapters.slice(0, 5).forEach((chapter, idx) => {
        if (chapter.content) {
          context += `第${idx + 1}章: ${chapter.title}\n${chapter.content.substring(0, 500)}...\n\n`;
        }
      });
    }
    
    return context;
  };

  // 用語自動抽出
  const handleExtractTerms = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。設定画面でAPIキーを設定してください。');
      return;
    }

    setIsAIGenerating(true);
    setAiResults([]);
    setSelectedResults(new Set());

    try {
      const projectContext = getProjectContext();
      
      const prompt = `以下のプロジェクト情報から、用語集に追加すべき重要な用語を抽出してください。

${projectContext}

【指示】
1. プロジェクト内で使用されている重要な用語（固有名詞、専門用語、特殊な概念など）を抽出してください
2. 既存の用語集に含まれている用語は除外してください
3. 各用語について、以下の情報を提供してください：
   - 用語名
   - 読み方（ひらがなまたはカタカナ）
   - 説明（プロジェクトの世界観に合わせた説明）
   - カテゴリ（character: キャラクター, location: 場所・舞台, concept: 概念・用語, item: アイテム, other: その他）

【出力形式】
JSON配列形式で出力してください：
[
  {
    "term": "用語名",
    "reading": "読み方",
    "definition": "説明",
    "category": "character|location|concept|item|other"
  },
  ...
]

既存の用語集: ${JSON.stringify(glossary.map(t => t.term), null, 2)}`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        context: projectContext,
      });

      if (response.error) {
        alert(`エラーが発生しました: ${response.error}`);
        setIsAIGenerating(false);
        return;
      }

      if (response.content) {
        try {
          // JSONを抽出（コードブロックがあれば除去）
          let jsonText = response.content.trim();
          const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
          
          const extractedTerms = JSON.parse(jsonText) as Partial<GlossaryTerm>[];
          
          // 既存の用語と重複しないようにフィルタ
          const existingTerms = new Set(glossary.map(t => t.term.toLowerCase()));
          const filteredTerms = extractedTerms.filter(
            term => term.term && !existingTerms.has(term.term.toLowerCase())
          );
          
          setAiResults(filteredTerms);
          // すべて選択状態にする
          setSelectedResults(new Set(filteredTerms.map((_, idx) => idx)));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          alert('AIの応答を解析できませんでした。応答形式が正しくない可能性があります。');
        }
      }
    } catch (error) {
      console.error('用語抽出エラー:', error);
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 説明文自動生成
  const handleGenerateDefinition = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。設定画面でAPIキーを設定してください。');
      return;
    }

    if (!formData.term || !formData.term.trim()) {
      alert('用語を入力してください。');
      return;
    }

    setIsAIGenerating(true);

    try {
      const projectContext = getProjectContext();
      
      const prompt = `以下の用語について、プロジェクトの世界観に合わせた説明文を生成してください。

${projectContext}

用語: ${formData.term}
${formData.reading ? `読み方: ${formData.reading}` : ''}

【指示】
1. プロジェクトの世界観や設定に合わせた説明文を生成してください
2. 説明文は100文字以上300文字程度で、具体的で分かりやすい内容にしてください
3. 必要に応じて読み方も提案してください（未入力の場合）
4. カテゴリも提案してください（character, location, concept, item, otherのいずれか）

【出力形式】
JSON形式で出力してください：
{
  "definition": "説明文",
  "reading": "読み方（ひらがなまたはカタカナ）",
  "category": "character|location|concept|item|other",
  "notes": "追加情報（任意）"
}`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        context: projectContext,
      });

      if (response.error) {
        alert(`エラーが発生しました: ${response.error}`);
        setIsAIGenerating(false);
        return;
      }

      if (response.content) {
        try {
          let jsonText = response.content.trim();
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
          
          const generated = JSON.parse(jsonText) as Partial<GlossaryTerm>;
          
          // フォームに反映
          setFormData(prev => ({
            ...prev,
            definition: generated.definition || prev.definition,
            reading: generated.reading || prev.reading,
            category: (generated.category as GlossaryTerm['category']) || prev.category,
            notes: generated.notes || prev.notes,
          }));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          // JSON解析に失敗した場合、説明文だけを抽出
          const definitionMatch = response.content.match(/説明[文]?[：:]\s*(.+)/);
          if (definitionMatch) {
            setFormData(prev => ({
              ...prev,
              definition: definitionMatch[1].trim(),
            }));
          } else {
            // 最初の段落を説明文として使用
            const firstParagraph = response.content.split('\n\n')[0].trim();
            setFormData(prev => ({
              ...prev,
              definition: firstParagraph,
            }));
          }
        }
      }
    } catch (error) {
      console.error('説明生成エラー:', error);
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 一括生成（用語リストから）
  const handleBulkGenerate = async (terms: string[]) => {
    if (!isConfigured) {
      alert('AI設定が必要です。設定画面でAPIキーを設定してください。');
      return;
    }

    if (terms.length === 0) {
      alert('用語を入力してください。');
      return;
    }

    setIsAIGenerating(true);
    setAiResults([]);
    setSelectedResults(new Set());

    try {
      const projectContext = getProjectContext();
      
      const prompt = `以下の用語リストについて、プロジェクトの世界観に合わせた用語集エントリを生成してください。

${projectContext}

用語リスト:
${terms.map((t, i) => `${i + 1}. ${t}`).join('\n')}

【指示】
各用語について、以下の情報を生成してください：
1. 読み方（ひらがなまたはカタカナ）
2. 説明（プロジェクトの世界観に合わせた説明、100文字以上300文字程度）
3. カテゴリ（character: キャラクター, location: 場所・舞台, concept: 概念・用語, item: アイテム, other: その他）

【出力形式】
JSON配列形式で出力してください：
[
  {
    "term": "用語名",
    "reading": "読み方",
    "definition": "説明",
    "category": "character|location|concept|item|other"
  },
  ...
]`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        context: projectContext,
      });

      if (response.error) {
        alert(`エラーが発生しました: ${response.error}`);
        setIsAIGenerating(false);
        return;
      }

      if (response.content) {
        try {
          let jsonText = response.content.trim();
          const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
          
          const generatedTerms = JSON.parse(jsonText) as Partial<GlossaryTerm>[];
          
          // 既存の用語と重複しないようにフィルタ
          const existingTerms = new Set(glossary.map(t => t.term.toLowerCase()));
          const filteredTerms = generatedTerms.filter(
            term => term.term && !existingTerms.has(term.term.toLowerCase())
          );
          
          setAiResults(filteredTerms);
          setSelectedResults(new Set(filteredTerms.map((_, idx) => idx)));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          alert('AIの応答を解析できませんでした。応答形式が正しくない可能性があります。');
        }
      }
    } catch (error) {
      console.error('一括生成エラー:', error);
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // AI生成結果を追加
  const handleAddAIResults = () => {
    const termsToAdd = aiResults
      .filter((_, idx) => selectedResults.has(idx))
      .map(term => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        term: term.term!,
        reading: term.reading,
        definition: term.definition!,
        category: term.category || 'other',
        notes: term.notes,
        createdAt: new Date(),
      }));

    if (termsToAdd.length === 0) {
      alert('追加する用語を選択してください。');
      return;
    }

    updateProject({
      glossary: [...glossary, ...termsToAdd],
    });

    setShowAIAssistant(false);
    setAiResults([]);
    setSelectedResults(new Set());
    alert(`${termsToAdd.length}件の用語を追加しました。`);
  };

  // 結果の選択を切り替え
  const toggleResultSelection = (index: number) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedResults(newSelected);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
              onClick={() => setShowAIAssistant(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
              title="AIアシスタント"
            >
              <Sparkles className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">AIアシスト</span>
            </button>
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
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseForm();
              }
            }}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                        説明 <span className="text-red-500">*</span>
                      </label>
                      {isConfigured && formData.term && (
                        <button
                          onClick={handleGenerateDefinition}
                          disabled={isAIGenerating}
                          className="flex items-center space-x-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAIGenerating ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="font-['Noto_Sans_JP']">生成中...</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3 w-3" />
                              <span className="font-['Noto_Sans_JP']">AIで生成</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
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
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImportExport(false);
              }
            }}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
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

        {/* AIアシスタントモーダル */}
        {showAIAssistant && (
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAIAssistant(false);
                setAiResults([]);
                setSelectedResults(new Set());
              }
            }}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        AIアシスタント
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        用語の自動抽出・生成
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowAIAssistant(false);
                      setAiResults([]);
                      setSelectedResults(new Set());
                    }}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {!isConfigured ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 font-['Noto_Sans_JP']">
                          AI設定が必要です
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1 font-['Noto_Sans_JP']">
                          設定画面でAPIキーを設定してください。
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* モード選択 */}
                    <div className="flex space-x-2 mb-6">
                      <button
                        onClick={() => {
                          setAiMode('extract');
                          setAiResults([]);
                          setSelectedResults(new Set());
                        }}
                        className={`flex-1 px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${
                          aiMode === 'extract'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <Zap className="h-5 w-5 mx-auto mb-1" />
                        <div className="text-sm font-medium">自動抽出</div>
                        <div className="text-xs mt-1 opacity-80">プロジェクトから用語を抽出</div>
                      </button>
                      <button
                        onClick={() => {
                          setAiMode('bulk');
                          setAiResults([]);
                          setSelectedResults(new Set());
                        }}
                        className={`flex-1 px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${
                          aiMode === 'bulk'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <Wand2 className="h-5 w-5 mx-auto mb-1" />
                        <div className="text-sm font-medium">一括生成</div>
                        <div className="text-xs mt-1 opacity-80">用語リストから生成</div>
                      </button>
                    </div>

                    {/* 自動抽出モード */}
                    {aiMode === 'extract' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                            <strong>自動抽出機能</strong><br />
                            プロジェクトのあらすじ、プロット、章の内容から重要な用語を自動的に抽出し、用語集に追加します。
                          </p>
                        </div>
                        <button
                          onClick={handleExtractTerms}
                          disabled={isAIGenerating}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAIGenerating ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span className="font-['Noto_Sans_JP']">抽出中...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="h-5 w-5" />
                              <span className="font-['Noto_Sans_JP']">用語を自動抽出</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* 一括生成モード */}
                    {aiMode === 'bulk' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                            <strong>一括生成機能</strong><br />
                            用語名のリストを入力すると、各用語の説明、読み方、カテゴリを自動生成します。1行に1つずつ用語を入力してください。
                          </p>
                        </div>
                        <textarea
                          id="bulk-terms-input"
                          placeholder="例：&#10;魔王&#10;魔法&#10;聖剣&#10;冒険者"
                          rows={8}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
                        />
                        <button
                          onClick={() => {
                            const textarea = document.getElementById('bulk-terms-input') as HTMLTextAreaElement;
                            const terms = textarea.value
                              .split('\n')
                              .map(t => t.trim())
                              .filter(t => t.length > 0);
                            if (terms.length === 0) {
                              alert('用語を入力してください。');
                              return;
                            }
                            handleBulkGenerate(terms);
                          }}
                          disabled={isAIGenerating}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAIGenerating ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span className="font-['Noto_Sans_JP']">生成中...</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-5 w-5" />
                              <span className="font-['Noto_Sans_JP']">用語を一括生成</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* 生成結果 */}
                    {aiResults.length > 0 && (
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                            生成結果 ({aiResults.length}件)
                          </h4>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedResults(new Set(aiResults.map((_, idx) => idx)));
                              }}
                              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-['Noto_Sans_JP']"
                            >
                              すべて選択
                            </button>
                            <span className="text-gray-400">|</span>
                            <button
                              onClick={() => setSelectedResults(new Set())}
                              className="text-sm text-gray-600 dark:text-gray-400 hover:underline font-['Noto_Sans_JP']"
                            >
                              選択解除
                            </button>
                          </div>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {aiResults.map((term, idx) => (
                            <div
                              key={idx}
                              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                                selectedResults.has(idx)
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                              onClick={() => toggleResultSelection(idx)}
                            >
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-1">
                                  {selectedResults.has(idx) ? (
                                    <CheckCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                  ) : (
                                    <div className="h-5 w-5 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h5 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                      {term.term}
                                    </h5>
                                    {term.reading && (
                                      <span className="text-sm text-gray-500 dark:text-gray-400">({term.reading})</span>
                                    )}
                                    {term.category && (
                                      <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full font-['Noto_Sans_JP']">
                                        {categoryLabels[term.category]}
                                      </span>
                                    )}
                                  </div>
                                  {term.definition && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                      {term.definition}
                                    </p>
                                  )}
                                  {term.notes && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic font-['Noto_Sans_JP']">
                                      {term.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => {
                              setAiResults([]);
                              setSelectedResults(new Set());
                            }}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={handleAddAIResults}
                            disabled={selectedResults.size === 0}
                            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-['Noto_Sans_JP']">
                              {selectedResults.size}件を追加
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

