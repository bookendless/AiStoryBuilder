import React, { useState, useMemo } from 'react';
import { Calendar, Plus, Edit2, Trash2, Save, BookOpen, Users, Globe, Radio, Sparkles, Loader2, Wand2, Zap, CheckCircle, AlertCircle, Lightbulb } from 'lucide-react';
import { useProject, TimelineEvent } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { Modal } from '../common/Modal';

interface TimelineViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryIcons: Record<TimelineEvent['category'], typeof BookOpen> = {
  plot: BookOpen,
  character: Users,
  world: Globe,
  other: Radio,
};

const categoryColors: Record<TimelineEvent['category'], string> = {
  plot: 'bg-blue-500',
  character: 'bg-pink-500',
  world: 'bg-green-500',
  other: 'bg-gray-500',
};

export const TimelineViewer: React.FC<TimelineViewerProps> = ({ isOpen, onClose }) => {
  const { currentProject, updateProject } = useProject();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState<Partial<TimelineEvent>>({
    title: '',
    description: '',
    date: '',
    order: 0,
    chapterId: '',
    characterIds: [],
    category: 'plot',
  });
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMode, setAiMode] = useState<'extract' | 'generate' | 'check' | 'suggest'>('extract');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<Partial<TimelineEvent>[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [consistencyCheckResult, setConsistencyCheckResult] = useState<string>('');
  const { settings, isConfigured } = useAI();

  const timeline = currentProject?.timeline || [];
  const chapters = currentProject?.chapters || [];
  const characters = currentProject?.characters || [];

  // フィルタリング
  const filteredTimeline = useMemo(() => {
    if (selectedCategory === 'all') return timeline;
    return timeline.filter(event => event.category === selectedCategory);
  }, [timeline, selectedCategory]);

  // ソート
  const sortedTimeline = useMemo(() => {
    return [...filteredTimeline].sort((a, b) => a.order - b.order);
  }, [filteredTimeline]);

  if (!isOpen || !currentProject) return null;

  const handleAddEvent = () => {
    if (!formData.title || !formData.description) {
      alert('タイトルと説明は必須です');
      return;
    }

    const newEvent: TimelineEvent = {
      id: editingEvent?.id || Date.now().toString(),
      title: formData.title,
      description: formData.description,
      date: formData.date || undefined,
      order: formData.order || 0,
      chapterId: formData.chapterId || undefined,
      characterIds: formData.characterIds || [],
      category: formData.category || 'plot',
    };

    if (editingEvent) {
      const updatedTimeline = timeline.map(e => (e.id === editingEvent.id ? newEvent : e));
      updateProject({ timeline: updatedTimeline });
    } else {
      updateProject({ timeline: [...timeline, newEvent] });
    }

    handleCloseForm();
  };

  const handleEditEvent = (event: TimelineEvent) => {
    setEditingEvent(event);
    setFormData(event);
    setShowAddForm(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (!confirm('このイベントを削除しますか？')) return;

    updateProject({
      timeline: timeline.filter(e => e.id !== eventId),
    });
  };

  const handleReorder = (eventId: string, direction: 'up' | 'down') => {
    const eventIndex = sortedTimeline.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return;

    const newOrder = direction === 'up'
      ? sortedTimeline[eventIndex].order - 1
      : sortedTimeline[eventIndex].order + 1;

    const updatedTimeline = timeline.map(e =>
      e.id === eventId ? { ...e, order: newOrder } : e
    );

    updateProject({ timeline: updatedTimeline });
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      date: '',
      order: timeline.length,
      chapterId: '',
      characterIds: [],
      category: 'plot',
    });
  };

  const getChapterTitle = (id: string) => {
    return chapters.find(c => c.id === id)?.title || '不明';
  };

  const getCharacterName = (id: string) => {
    return characters.find(c => c.id === id)?.name || '不明';
  };

  // プロジェクトコンテキストを取得
  const getProjectContext = (): string => {
    if (!currentProject) return '';

    let context = `プロジェクトタイトル: ${currentProject.title}\n`;
    context += `テーマ: ${currentProject.theme || currentProject.projectTheme || '未設定'}\n`;
    context += `メインジャンル: ${currentProject.mainGenre || currentProject.genre || '未設定'}\n\n`;

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
        context += `- ${char.name} (${char.role}): ${char.personality || char.background || ''}\n`;
      });
      context += '\n';
    }

    // 章の内容を取得
    if (currentProject.chapters && currentProject.chapters.length > 0) {
      context += `章の内容:\n`;
      currentProject.chapters.forEach((chapter, idx) => {
        if (chapter.draft) {
          context += `第${idx + 1}章: ${chapter.title}\n${chapter.draft.substring(0, 1000)}...\n\n`;
        } else if (chapter.summary) {
          context += `第${idx + 1}章: ${chapter.title}\n${chapter.summary}\n\n`;
        }
      });
    }

    return context;
  };

  // イベント自動抽出
  const handleExtractEvents = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。設定画面でAPIキーを設定してください。');
      return;
    }

    setIsAIGenerating(true);
    setAiResults([]);
    setSelectedResults(new Set());

    try {
      const projectContext = getProjectContext();

      const prompt = `以下のプロジェクト情報から、タイムラインに追加すべき重要なイベントを抽出してください。

${projectContext}

【指示】
1. プロジェクト内で発生する重要なイベント（プロット上の転換点、キャラクターの成長、世界観の変化など）を抽出してください
2. 既存のタイムラインに含まれているイベントは除外してください
3. 各イベントについて、以下の情報を提供してください：
   - タイトル（簡潔で分かりやすい）
   - 説明（100文字以上300文字程度）
   - 日付/時期（物語内での時期、例：「物語開始後3年目」「第一章」など）
   - カテゴリ（plot: プロット, character: キャラクター, world: 世界, other: その他）
   - 関連する章（該当する章のタイトル）
   - 関連するキャラクター（該当するキャラクター名）

【出力形式】
JSON配列形式で出力してください：
[
  {
    "title": "イベントタイトル",
    "description": "イベントの詳細説明",
    "date": "日付/時期",
    "category": "plot|character|world|other",
    "chapterTitle": "章のタイトル（任意）",
    "characterNames": ["キャラクター名1", "キャラクター名2"]
  },
  ...
]

既存のタイムライン: ${JSON.stringify(timeline.map(e => e.title), null, 2)}`;

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

          const extractedEvents = JSON.parse(jsonText) as Array<{
            title: string;
            description: string;
            date?: string;
            category: TimelineEvent['category'];
            chapterTitle?: string;
            characterNames?: string[];
          }>;

          // 既存のイベントと重複しないようにフィルタ
          const existingTitles = new Set(timeline.map(e => e.title.toLowerCase()));
          const filteredEvents = extractedEvents
            .filter(event => event.title && !existingTitles.has(event.title.toLowerCase()))
            .map(event => {
              // 章IDとキャラクターIDを解決
              const chapterId = event.chapterTitle
                ? chapters.find(c => c.title === event.chapterTitle)?.id
                : undefined;

              const characterIds = event.characterNames
                ? event.characterNames
                  .map(name => characters.find(c => c.name === name)?.id)
                  .filter((id): id is string => id !== undefined)
                : [];

              return {
                title: event.title,
                description: event.description,
                date: event.date,
                category: event.category || 'plot',
                chapterId,
                characterIds,
                order: timeline.length + extractedEvents.indexOf(event),
              } as Partial<TimelineEvent>;
            });

          setAiResults(filteredEvents);
          setSelectedResults(new Set(filteredEvents.map((_, idx) => idx)));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          alert('AIの応答を解析できませんでした。応答形式が正しくない可能性があります。');
        }
      }
    } catch (error) {
      console.error('イベント抽出エラー:', error);
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // イベント説明自動生成
  const handleGenerateDescription = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。設定画面でAPIキーを設定してください。');
      return;
    }

    if (!formData.title || !formData.title.trim()) {
      alert('タイトルを入力してください。');
      return;
    }

    setIsAIGenerating(true);

    try {
      const projectContext = getProjectContext();

      const prompt = `以下のイベントについて、プロジェクトの世界観に合わせた説明文を生成してください。

${projectContext}

イベントタイトル: ${formData.title}
${formData.date ? `日付/時期: ${formData.date}` : ''}
${formData.category ? `カテゴリ: ${formData.category}` : ''}

【指示】
1. プロジェクトの世界観や設定に合わせた説明文を生成してください
2. 説明文は100文字以上300文字程度で、具体的で分かりやすい内容にしてください
3. 必要に応じて日付/時期も提案してください（未入力の場合）
4. カテゴリも提案してください（plot, character, world, otherのいずれか）
5. 関連する章やキャラクターも提案してください

【出力形式】
JSON形式で出力してください：
{
  "description": "説明文",
  "date": "日付/時期（任意）",
  "category": "plot|character|world|other",
  "chapterTitle": "関連する章のタイトル（任意）",
  "characterNames": ["キャラクター名1", "キャラクター名2"]
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

          const generated = JSON.parse(jsonText) as {
            description: string;
            date?: string;
            category?: TimelineEvent['category'];
            chapterTitle?: string;
            characterNames?: string[];
          };

          // フォームに反映
          const chapterId = generated.chapterTitle
            ? chapters.find(c => c.title === generated.chapterTitle)?.id
            : undefined;

          const characterIds = generated.characterNames
            ? generated.characterNames
              .map(name => characters.find(c => c.name === name)?.id)
              .filter((id): id is string => id !== undefined)
            : [];

          setFormData(prev => ({
            ...prev,
            description: generated.description || prev.description,
            date: generated.date || prev.date,
            category: generated.category || prev.category,
            chapterId: chapterId || prev.chapterId,
            characterIds: characterIds.length > 0 ? characterIds : prev.characterIds,
          }));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          // JSON解析に失敗した場合、説明文だけを抽出
          const descriptionMatch = response.content.match(/説明[文]?[：:]\s*(.+)/);
          if (descriptionMatch) {
            setFormData(prev => ({
              ...prev,
              description: descriptionMatch[1].trim(),
            }));
          } else {
            // 最初の段落を説明文として使用
            const firstParagraph = response.content.split('\n\n')[0].trim();
            setFormData(prev => ({
              ...prev,
              description: firstParagraph,
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

  // 時系列整合性チェック
  const handleCheckConsistency = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。設定画面でAPIキーを設定してください。');
      return;
    }

    if (timeline.length === 0) {
      alert('タイムラインにイベントが登録されていません。');
      return;
    }

    setIsAIGenerating(true);
    setConsistencyCheckResult('');

    try {
      const projectContext = getProjectContext();

      const sortedTimeline = [...timeline].sort((a, b) => a.order - b.order);
      const timelineText = sortedTimeline.map((event, idx) => {
        return `${idx + 1}. ${event.title}${event.date ? ` (${event.date})` : ''}\n   ${event.description}\n   order: ${event.order}`;
      }).join('\n\n');

      const prompt = `以下のタイムラインについて、時系列の整合性をチェックしてください。

${projectContext}

【現在のタイムライン】
${timelineText}

【チェック項目】
1. イベントの順序が論理的に正しいか
2. 日付/時期の記述に矛盾がないか
3. プロット設定との整合性
4. キャラクターの行動や動機の一貫性
5. 時系列のギャップや飛躍がないか

【出力形式】
問題があれば具体的に指摘し、改善提案をしてください。JSON形式で出力してください：
{
  "hasIssues": true/false,
  "issues": ["問題点1", "問題点2", ...],
  "suggestions": ["改善提案1", "改善提案2", ...]
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

          const result = JSON.parse(jsonText) as {
            hasIssues: boolean;
            issues?: string[];
            suggestions?: string[];
          };

          let resultText = '';
          if (!result.hasIssues) {
            resultText = '✅ タイムラインに問題は見つかりませんでした。整合性が保たれています。';
          } else {
            resultText = '⚠️ 以下の問題が見つかりました：\n\n';
            if (result.issues && result.issues.length > 0) {
              resultText += '【問題点】\n';
              result.issues.forEach((issue, idx) => {
                resultText += `${idx + 1}. ${issue}\n`;
              });
              resultText += '\n';
            }
            if (result.suggestions && result.suggestions.length > 0) {
              resultText += '【改善提案】\n';
              result.suggestions.forEach((suggestion, idx) => {
                resultText += `${idx + 1}. ${suggestion}\n`;
              });
            }
          }

          setConsistencyCheckResult(resultText);
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          // JSON解析に失敗した場合、テキストをそのまま表示
          setConsistencyCheckResult(response.content);
        }
      }
    } catch (error) {
      console.error('整合性チェックエラー:', error);
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // イベント提案
  const handleSuggestEvents = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。設定画面でAPIキーを設定してください。');
      return;
    }

    setIsAIGenerating(true);
    setAiResults([]);
    setSelectedResults(new Set());

    try {
      const projectContext = getProjectContext();

      const sortedTimeline = [...timeline].sort((a, b) => a.order - b.order);
      const timelineText = sortedTimeline.length > 0
        ? sortedTimeline.map((event, idx) => `${idx + 1}. ${event.title}`).join('\n')
        : 'まだイベントが登録されていません';

      const prompt = `以下のプロジェクト情報と現在のタイムラインを参考に、物語に追加すべきイベントを提案してください。

${projectContext}

【現在のタイムライン】
${timelineText}

【指示】
1. プロットの流れを考慮して、物語に必要なイベントを提案してください
2. キャラクターの成長や関係性の発展に関わるイベントも含めてください
3. 各イベントについて、以下の情報を提供してください：
   - タイトル
   - 説明（100文字以上300文字程度）
   - 日付/時期
   - カテゴリ（plot, character, world, other）
   - 関連する章（該当する場合）
   - 関連するキャラクター（該当する場合）

【出力形式】
JSON配列形式で出力してください：
[
  {
    "title": "イベントタイトル",
    "description": "イベントの詳細説明",
    "date": "日付/時期",
    "category": "plot|character|world|other",
    "chapterTitle": "章のタイトル（任意）",
    "characterNames": ["キャラクター名1", "キャラクター名2"]
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

          const suggestedEvents = JSON.parse(jsonText) as Array<{
            title: string;
            description: string;
            date?: string;
            category: TimelineEvent['category'];
            chapterTitle?: string;
            characterNames?: string[];
          }>;

          // 章IDとキャラクターIDを解決
          const processedEvents = suggestedEvents.map(event => {
            const chapterId = event.chapterTitle
              ? chapters.find(c => c.title === event.chapterTitle)?.id
              : undefined;

            const characterIds = event.characterNames
              ? event.characterNames
                .map(name => characters.find(c => c.name === name)?.id)
                .filter((id): id is string => id !== undefined)
              : [];

            return {
              title: event.title,
              description: event.description,
              date: event.date,
              category: event.category || 'plot',
              chapterId,
              characterIds,
              order: timeline.length + suggestedEvents.indexOf(event),
            } as Partial<TimelineEvent>;
          });

          setAiResults(processedEvents);
          setSelectedResults(new Set(processedEvents.map((_, idx) => idx)));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          alert('AIの応答を解析できませんでした。応答形式が正しくない可能性があります。');
        }
      }
    } catch (error) {
      console.error('イベント提案エラー:', error);
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // AI生成結果を追加
  const handleAddAIResults = () => {
    const eventsToAdd = aiResults
      .filter((_, idx) => selectedResults.has(idx))
      .map(event => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: event.title!,
        description: event.description!,
        date: event.date,
        order: event.order || timeline.length,
        chapterId: event.chapterId,
        characterIds: event.characterIds || [],
        category: event.category || 'plot',
      }));

    if (eventsToAdd.length === 0) {
      alert('追加するイベントを選択してください。');
      return;
    }

    updateProject({
      timeline: [...timeline, ...eventsToAdd],
    });

    setShowAIAssistant(false);
    setAiResults([]);
    setSelectedResults(new Set());
    alert(`${eventsToAdd.length}件のイベントを追加しました。`);
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
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-indigo-600" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              タイムライン
            </span>
          </div>
        }
        size="xl"
        ref={modalRef}
      >
        <div className="flex flex-col h-[80vh]">
          {/* ヘッダーアクション */}
          <div className="flex items-center justify-end space-x-2 mb-4">
            <button
              onClick={() => setShowAIAssistant(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
              title="AIアシスタント"
            >
              <Sparkles className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">AIアシスト</span>
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">追加</span>
            </button>
          </div>

          {/* フィルタ */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">すべて</option>
                <option value="plot">プロット</option>
                <option value="character">キャラクター</option>
                <option value="world">世界</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>

          {/* タイムラインリスト */}
          <div className="flex-1 overflow-y-auto p-6">
            {sortedTimeline.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  まだイベントが登録されていません
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* タイムラインの線 */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-indigo-200 dark:bg-indigo-900"></div>

                {/* イベントリスト */}
                <div className="space-y-8">
                  {sortedTimeline.map((event, index) => {
                    const Icon = categoryIcons[event.category];
                    const color = categoryColors[event.category];

                    return (
                      <div key={event.id} className="relative flex items-start">
                        {/* イベントドット */}
                        <div className={`relative z-10 ${color} rounded-full p-2 text-white`}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {/* イベントコンテンツ */}
                        <div className="flex-1 ml-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                  {event.title}
                                </h3>
                                {event.date && (
                                  <span className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-['Noto_Sans_JP']">
                                    {event.date}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                                {event.description}
                              </p>

                              {/* 関連情報 */}
                              <div className="flex flex-wrap gap-2 mt-3">
                                {event.chapterId && (
                                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                    <BookOpen className="h-4 w-4" />
                                    <span className="font-['Noto_Sans_JP']">{getChapterTitle(event.chapterId)}</span>
                                  </div>
                                )}
                                {event.characterIds && event.characterIds.length > 0 && (
                                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                    <Users className="h-4 w-4" />
                                    <span className="font-['Noto_Sans_JP']">
                                      {event.characterIds.map(id => getCharacterName(id)).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => handleReorder(event.id, 'up')}
                                disabled={index === 0}
                                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="上に移動"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => handleReorder(event.id, 'down')}
                                disabled={index === sortedTimeline.length - 1}
                                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="下に移動"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => handleEditEvent(event)}
                                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* 追加/編集フォーム */}
      <Modal
        isOpen={showAddForm}
        onClose={handleCloseForm}
        title={editingEvent ? 'イベントを編集' : 'イベントを追加'}
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
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="例：魔王復活"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                説明 <span className="text-red-500">*</span>
              </label>
              {isConfigured && formData.title && (
                <button
                  onClick={handleGenerateDescription}
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
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
              placeholder="イベントの詳細"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              日付/時期
            </label>
            <input
              type="text"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
              placeholder="例：物語開始後3年目、第一章"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              カテゴリ
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as TimelineEvent['category'] })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="plot">プロット</option>
              <option value="character">キャラクター</option>
              <option value="world">世界</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              関連する章
            </label>
            <select
              value={formData.chapterId}
              onChange={(e) => setFormData({ ...formData, chapterId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">なし</option>
              {chapters.map(chapter => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              関連するキャラクター
            </label>
            <select
              multiple
              value={formData.characterIds}
              onChange={(e) => setFormData({
                ...formData,
                characterIds: Array.from(e.target.selectedOptions, option => option.value)
              })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              size={5}
            >
              {characters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-['Noto_Sans_JP']">
              Ctrlキー（Windows）またはCmdキー（Mac）を押しながらクリックで複数選択
            </p>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              onClick={handleCloseForm}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              キャンセル
            </button>
            <button
              onClick={handleAddEvent}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Save className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">保存</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* AIアシスタントモーダル */}
      <Modal
        isOpen={showAIAssistant}
        onClose={() => {
          setShowAIAssistant(false);
          setAiResults([]);
          setSelectedResults(new Set());
          setConsistencyCheckResult('');
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AIアシスタント
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                イベントの自動抽出・生成・整合性チェック
              </p>
            </div>
          </div>
        }
        size="lg"
        className="z-[70]"
      >
        <div className="space-y-6">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setAiMode('extract');
                    setAiResults([]);
                    setSelectedResults(new Set());
                    setConsistencyCheckResult('');
                  }}
                  className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'extract'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <Zap className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">自動抽出</div>
                  <div className="text-xs mt-1 opacity-80">章から抽出</div>
                </button>
                <button
                  onClick={() => {
                    setAiMode('suggest');
                    setAiResults([]);
                    setSelectedResults(new Set());
                    setConsistencyCheckResult('');
                  }}
                  className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'suggest'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <Wand2 className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">イベント提案</div>
                  <div className="text-xs mt-1 opacity-80">新規イベント提案</div>
                </button>
                <button
                  onClick={() => {
                    setAiMode('check');
                    setAiResults([]);
                    setSelectedResults(new Set());
                    setConsistencyCheckResult('');
                  }}
                  className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'check'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <CheckCircle className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">整合性チェック</div>
                  <div className="text-xs mt-1 opacity-80">時系列チェック</div>
                </button>
                <button
                  onClick={() => {
                    setAiMode('generate');
                    setAiResults([]);
                    setSelectedResults(new Set());
                    setConsistencyCheckResult('');
                  }}
                  className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'generate'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <Lightbulb className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">説明生成</div>
                  <div className="text-xs mt-1 opacity-80">説明文生成</div>
                </button>
              </div>

              {/* 自動抽出モード */}
              {aiMode === 'extract' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                      <strong>自動抽出機能</strong><br />
                      プロジェクトの章の内容から重要なイベントを自動的に抽出し、タイムラインに追加します。
                    </p>
                  </div>
                  <button
                    onClick={handleExtractEvents}
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
                        <span className="font-['Noto_Sans_JP']">イベントを自動抽出</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* イベント提案モード */}
              {aiMode === 'suggest' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                      <strong>イベント提案機能</strong><br />
                      現在のタイムラインとプロットを分析して、物語に追加すべきイベントを提案します。
                    </p>
                  </div>
                  <button
                    onClick={handleSuggestEvents}
                    disabled={isAIGenerating}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAIGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="font-['Noto_Sans_JP']">提案中...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-5 w-5" />
                        <span className="font-['Noto_Sans_JP']">イベントを提案</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 整合性チェックモード */}
              {aiMode === 'check' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                      <strong>整合性チェック機能</strong><br />
                      タイムラインの時系列が論理的に正しいか、矛盾がないかをチェックします。
                    </p>
                  </div>
                  <button
                    onClick={handleCheckConsistency}
                    disabled={isAIGenerating || timeline.length === 0}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAIGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="font-['Noto_Sans_JP']">チェック中...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-['Noto_Sans_JP']">整合性をチェック</span>
                      </>
                    )}
                  </button>
                  {consistencyCheckResult && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                        チェック結果
                      </h4>
                      <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                        {consistencyCheckResult}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 説明生成モード */}
              {aiMode === 'generate' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                      <strong>説明生成機能</strong><br />
                      イベント追加フォームでタイトルを入力後、「AIで生成」ボタンを使用してください。
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAIAssistant(false);
                      setShowAddForm(true);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="font-['Noto_Sans_JP']">イベント追加フォームを開く</span>
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
                    {aiResults.map((event, idx) => (
                      <div
                        key={idx}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedResults.has(idx)
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
                                {event.title}
                              </h5>
                              {event.date && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">({event.date})</span>
                              )}
                              {event.category && (
                                <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full font-['Noto_Sans_JP']">
                                  {event.category === 'plot' ? 'プロット' : event.category === 'character' ? 'キャラクター' : event.category === 'world' ? '世界' : 'その他'}
                                </span>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                {event.description}
                              </p>
                            )}
                            {(event.chapterId || (event.characterIds && event.characterIds.length > 0)) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {event.chapterId && (
                                  <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                                    <BookOpen className="h-3 w-3" />
                                    <span className="font-['Noto_Sans_JP']">{getChapterTitle(event.chapterId)}</span>
                                  </div>
                                )}
                                {event.characterIds && event.characterIds.length > 0 && (
                                  <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                                    <Users className="h-3 w-3" />
                                    <span className="font-['Noto_Sans_JP']">
                                      {event.characterIds.map(id => getCharacterName(id)).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
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
      </Modal>
    </>
  );
};
