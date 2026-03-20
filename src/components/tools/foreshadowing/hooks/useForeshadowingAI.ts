import { useState } from 'react';
import { useProject, Foreshadowing, ForeshadowingPoint } from '../../../../contexts/ProjectContext';
import { useAI } from '../../../../contexts/AIContext';
import { useToast } from '../../../Toast';
import { aiService } from '../../../../services/aiService';
import { parseAIResponse } from '../../../../utils/aiResponseParser';
import { statusConfig, categoryConfig, importanceConfig, pointTypeConfig } from '../config';
import type { AISuggestion, ConsistencyResult, EnhanceResult, PayoffResult } from '../types';

export const useForeshadowingAI = () => {
  const { currentProject, updateProject } = useProject();
  const { settings: aiSettings, isConfigured } = useAI();
  const { showError } = useToast();

  const foreshadowings = currentProject?.foreshadowings || [];
  const chapters = currentProject?.chapters || [];
  const characters = currentProject?.characters || [];

  const [isAILoading, setIsAILoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMode, setAiMode] = useState<'suggest' | 'check'>('suggest');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [consistencyResult, setConsistencyResult] = useState<ConsistencyResult | null>(null);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [selectedForEnhance, setSelectedForEnhance] = useState<Foreshadowing | null>(null);
  const [enhanceResult, setEnhanceResult] = useState<EnhanceResult | null>(null);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [selectedForPayoff, setSelectedForPayoff] = useState<Foreshadowing | null>(null);
  const [payoffResult, setPayoffResult] = useState<PayoffResult | null>(null);
  const [showPayoffModal, setShowPayoffModal] = useState(false);

  // AIレスポンスからJSONを安全にパース
  const parseAIJsonResponse = (content: string): unknown => {
    if (!content || typeof content !== 'string') {
      throw new Error('無効な応答内容です');
    }
    const parsed = parseAIResponse(content, 'json');
    if (!parsed.success) {
      console.error('JSON parsing failed:', parsed.error);
      console.debug('Raw content (first 500 chars):', content.substring(0, 500));
      throw new Error(parsed.error || 'JSONの解析に失敗しました');
    }
    if (!parsed.data) {
      throw new Error('JSONデータが見つかりませんでした');
    }
    return parsed.data;
  };

  // プロジェクト情報をプロンプト用にフォーマット
  const buildProjectInfo = (): Record<string, string> => {
    if (!currentProject) return {
      title: '', mainGenre: '', subGenre: '', theme: '', plotTheme: '', plotSetting: '',
      plotHook: '', protagonistGoal: '', mainObstacle: '', structureInfo: '',
      characters: '', chapters: '', synopsis: '', existingForeshadowings: '', foreshadowings: '',
    };

    const structureInfo = currentProject.plot.structure === 'kishotenketsu'
      ? `起: ${currentProject.plot.ki || '未設定'}\n承: ${currentProject.plot.sho || '未設定'}\n転: ${currentProject.plot.ten || '未設定'}\n結: ${currentProject.plot.ketsu || '未設定'}`
      : currentProject.plot.structure === 'three-act'
        ? `第1幕: ${currentProject.plot.act1 || '未設定'}\n第2幕: ${currentProject.plot.act2 || '未設定'}\n第3幕: ${currentProject.plot.act3 || '未設定'}`
        : `第1幕: ${currentProject.plot.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot.fourAct4 || '未設定'}`;

    const charactersInfo = characters.map(c =>
      `- ${c.name}（${c.role}）: ${c.personality || '性格未設定'}`
    ).join('\n') || '未設定';

    const chaptersInfo = chapters.map((c, idx) =>
      `第${idx + 1}章: ${c.title}${c.summary ? ` - ${c.summary}` : ''}`
    ).join('\n') || '未設定';

    const existingForeshadowingsInfo = foreshadowings.map(f => {
      const categoryInfo = categoryConfig[f.category] || categoryConfig.other;
      const statusInfo = statusConfig[f.status] || statusConfig.planted;
      return `- ${f.title}（${categoryInfo.label}）[${statusInfo.label}]: ${f.description}`;
    }).join('\n') || 'なし';

    return {
      title: currentProject.title,
      mainGenre: currentProject.mainGenre || currentProject.genre || '未設定',
      subGenre: currentProject.subGenre || '未設定',
      theme: currentProject.projectTheme || currentProject.theme || '未設定',
      plotTheme: currentProject.plot.theme || '未設定',
      plotSetting: currentProject.plot.setting || '未設定',
      plotHook: currentProject.plot.hook || '未設定',
      protagonistGoal: currentProject.plot.protagonistGoal || '未設定',
      mainObstacle: currentProject.plot.mainObstacle || '未設定',
      structureInfo,
      characters: charactersInfo,
      chapters: chaptersInfo,
      synopsis: currentProject.synopsis || '未設定',
      existingForeshadowings: existingForeshadowingsInfo,
      foreshadowings: existingForeshadowingsInfo,
    };
  };

  // キャラクター名を取得
  const getCharacterName = (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    return character?.name || '不明';
  };

  // 章名を取得
  const getChapterTitle = (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    return chapter?.title || '不明な章';
  };

  // AI伏線提案
  const handleAISuggest = async () => {
    if (!currentProject) return;
    setIsAILoading(true);
    setAiError(null);
    setAiSuggestions([]);

    try {
      const projectInfo = buildProjectInfo();
      const prompt = aiService.buildPrompt('foreshadowing', 'suggest', projectInfo);
      const response = await aiService.generateContent({ prompt, type: 'foreshadowing', settings: aiSettings });

      if (response.error) throw new Error(response.error);
      if (!response.content) throw new Error('AIからの応答が空です');

      const parsed = parseAIJsonResponse(response.content) as { suggestions?: AISuggestion[] };
      if (!parsed || typeof parsed !== 'object') throw new Error('AI応答の形式が正しくありません');

      setAiSuggestions(parsed.suggestions || []);
    } catch (error) {
      console.error('AI suggest error:', error);
      const errorMessage = error instanceof Error ? error.message : '伏線提案の生成に失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI整合性チェック
  const handleConsistencyCheck = async () => {
    if (!currentProject || foreshadowings.length === 0) return;
    setIsAILoading(true);
    setAiError(null);
    setConsistencyResult(null);

    try {
      const projectInfo = buildProjectInfo();
      const prompt = aiService.buildPrompt('foreshadowing', 'checkConsistency', projectInfo);
      const response = await aiService.generateContent({ prompt, type: 'foreshadowing', settings: aiSettings });

      if (response.error) throw new Error(response.error);
      if (!response.content) throw new Error('AIからの応答が空です');

      const parsed = parseAIJsonResponse(response.content) as ConsistencyResult;
      if (!parsed || typeof parsed !== 'object') throw new Error('AI応答の形式が正しくありません');

      setConsistencyResult(parsed);
      setShowConsistencyModal(true);
    } catch (error) {
      console.error('AI consistency check error:', error);
      const errorMessage = error instanceof Error ? error.message : '整合性チェックに失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI伏線強化提案
  const handleEnhanceForeshadowing = async (foreshadowing: Foreshadowing) => {
    if (!currentProject) return;
    setIsAILoading(true);
    setAiError(null);
    setEnhanceResult(null);
    setSelectedForEnhance(foreshadowing);

    try {
      const projectInfo = buildProjectInfo();
      const relatedChars = foreshadowing.relatedCharacterIds?.map(id => getCharacterName(id)).join(', ') || 'なし';
      const currentPoints = foreshadowing.points.map(p =>
        `${pointTypeConfig[p.type].label}: ${p.description} (${getChapterTitle(p.chapterId)})`
      ).join('\n') || 'なし';

      const categoryInfo = categoryConfig[foreshadowing.category] || categoryConfig.other;
      const importanceInfo = importanceConfig[foreshadowing.importance] || importanceConfig.medium;
      const statusInfo = statusConfig[foreshadowing.status] || statusConfig.planted;
      const prompt = aiService.buildPrompt('foreshadowing', 'enhance', {
        ...projectInfo,
        foreshadowingTitle: foreshadowing.title,
        foreshadowingDescription: foreshadowing.description,
        foreshadowingCategory: categoryInfo.label,
        foreshadowingImportance: importanceInfo.label,
        foreshadowingStatus: statusInfo.label,
        currentPoints,
        plannedPayoff: foreshadowing.plannedPayoffDescription || '未設定',
        relatedCharacters: relatedChars,
        themeConnection: `この伏線はプロジェクトのテーマ「${projectInfo.theme}」と関連している可能性があります。`,
      });

      const response = await aiService.generateContent({ prompt, type: 'foreshadowing', settings: aiSettings });
      if (response.error) throw new Error(response.error);
      if (!response.content) throw new Error('AIからの応答が空です');

      const parsed = parseAIJsonResponse(response.content) as EnhanceResult;
      if (!parsed || typeof parsed !== 'object') throw new Error('AI応答の形式が正しくありません');

      setEnhanceResult(parsed);
      setShowEnhanceModal(true);
    } catch (error) {
      console.error('AI enhance error:', error);
      const errorMessage = error instanceof Error ? error.message : '伏線強化提案の生成に失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI回収タイミング提案
  const handleSuggestPayoff = async (foreshadowing: Foreshadowing) => {
    if (!currentProject) return;
    setIsAILoading(true);
    setAiError(null);
    setPayoffResult(null);
    setSelectedForPayoff(foreshadowing);

    try {
      const projectInfo = buildProjectInfo();
      const relatedChars = foreshadowing.relatedCharacterIds?.map(id => {
        const char = characters.find(c => c.id === id);
        return char ? `${char.name}（${char.role}）: ${char.personality || '性格未設定'}` : '';
      }).filter(Boolean).join('\n') || 'なし';
      const currentPoints = foreshadowing.points.map(p =>
        `${pointTypeConfig[p.type].label}: ${p.description} (${getChapterTitle(p.chapterId)})`
      ).join('\n') || 'なし';
      const otherForeshadowings = foreshadowings
        .filter(f => f.id !== foreshadowing.id)
        .map(f => {
          const statusInfo = statusConfig[f.status] || statusConfig.planted;
          return `- ${f.title}（${statusInfo.label}）`;
        })
        .join('\n') || 'なし';

      const prompt = aiService.buildPrompt('foreshadowing', 'suggestPayoff', {
        ...projectInfo,
        foreshadowingTitle: foreshadowing.title,
        foreshadowingDescription: foreshadowing.description,
        foreshadowingCategory: (categoryConfig[foreshadowing.category] || categoryConfig.other).label,
        foreshadowingImportance: (importanceConfig[foreshadowing.importance] || importanceConfig.medium).label,
        currentPoints,
        relatedCharacters: relatedChars,
        otherForeshadowings,
      });

      const response = await aiService.generateContent({ prompt, type: 'foreshadowing', settings: aiSettings });
      if (response.error) throw new Error(response.error);
      if (!response.content) throw new Error('AIからの応答が空です');

      const parsed = parseAIJsonResponse(response.content) as PayoffResult;
      if (!parsed || typeof parsed !== 'object') throw new Error('AI応答の形式が正しくありません');

      setPayoffResult(parsed);
      setShowPayoffModal(true);
    } catch (error) {
      console.error('AI payoff suggest error:', error);
      const errorMessage = error instanceof Error ? error.message : '回収タイミング提案の生成に失敗しました';
      setAiError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAILoading(false);
    }
  };

  // AI提案から伏線を追加
  const handleAddFromSuggestion = (suggestion: AISuggestion) => {
    const now = new Date();
    const relatedCharacterIds = suggestion.relatedCharacters
      .map(name => characters.find(c => c.name === name)?.id)
      .filter((id): id is string => !!id);

    const plantChapterMatch = suggestion.plantChapter.match(/第(\d+)章/);
    const payoffChapterMatch = suggestion.payoffChapter.match(/第(\d+)章/);
    const plantChapterId = plantChapterMatch ? chapters[parseInt(plantChapterMatch[1]) - 1]?.id : undefined;
    const payoffChapterId = payoffChapterMatch ? chapters[parseInt(payoffChapterMatch[1]) - 1]?.id : undefined;

    const initialPoints: ForeshadowingPoint[] = plantChapterId ? [{
      id: `${Date.now()}-plant`,
      chapterId: plantChapterId,
      type: 'plant',
      description: suggestion.plantDescription,
      createdAt: now,
    }] : [];

    const newForeshadowing: Foreshadowing = {
      id: Date.now().toString(),
      title: suggestion.title,
      description: suggestion.description,
      importance: suggestion.importance,
      status: 'planted',
      category: suggestion.category,
      points: initialPoints,
      relatedCharacterIds,
      plannedPayoffChapterId: payoffChapterId,
      plannedPayoffDescription: suggestion.payoffDescription,
      tags: [],
      notes: `AI提案から作成\n設置推奨: ${suggestion.plantChapter} - ${suggestion.plantDescription}\n期待効果: ${suggestion.effect}`,
      createdAt: now,
      updatedAt: now,
    };

    const additionalUpdates: { chapterId: string; eventText: string }[] = [];
    if (payoffChapterId && suggestion.payoffDescription) {
      additionalUpdates.push({
        chapterId: payoffChapterId,
        eventText: `【伏線：回収予定】${suggestion.title} - ${suggestion.payoffDescription}`,
      });
    }

    // 章への同期
    const chapterUpdates = new Map<string, { events: string[]; refId: string }>();
    for (const point of newForeshadowing.points) {
      const eventText = `【伏線：設置】${newForeshadowing.title} - ${point.description}`;
      chapterUpdates.set(point.chapterId, { events: [eventText], refId: newForeshadowing.id });
    }
    for (const update of additionalUpdates) {
      const existing = chapterUpdates.get(update.chapterId);
      if (existing) {
        existing.events.push(update.eventText);
      } else {
        chapterUpdates.set(update.chapterId, { events: [update.eventText], refId: newForeshadowing.id });
      }
    }

    const updatedChapters = chapters.map(chapter => {
      const update = chapterUpdates.get(chapter.id);
      if (!update) return chapter;
      const currentKeyEvents = chapter.keyEvents || [];
      const currentRefs = chapter.foreshadowingRefs || [];
      const newEvents = update.events.filter(evt => !currentKeyEvents.includes(evt));
      const newRefs = currentRefs.includes(update.refId) ? currentRefs : [...currentRefs, update.refId];
      if (newEvents.length === 0 && newRefs.length === currentRefs.length) return chapter;
      return { ...chapter, keyEvents: [...currentKeyEvents, ...newEvents], foreshadowingRefs: newRefs };
    });

    updateProject({
      foreshadowings: [...foreshadowings, newForeshadowing],
      chapters: updatedChapters,
    });

    setAiSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
  };

  return {
    isConfigured,
    isAILoading,
    aiError,
    setAiError,
    showAIAssistant,
    setShowAIAssistant,
    aiMode,
    setAiMode,
    aiSuggestions,
    setAiSuggestions,
    consistencyResult,
    showConsistencyModal,
    setShowConsistencyModal,
    selectedForEnhance,
    setSelectedForEnhance,
    enhanceResult,
    setEnhanceResult,
    showEnhanceModal,
    setShowEnhanceModal,
    selectedForPayoff,
    setSelectedForPayoff,
    payoffResult,
    setPayoffResult,
    showPayoffModal,
    setShowPayoffModal,
    handleAISuggest,
    handleConsistencyCheck,
    handleEnhanceForeshadowing,
    handleSuggestPayoff,
    handleAddFromSuggestion,
  };
};
