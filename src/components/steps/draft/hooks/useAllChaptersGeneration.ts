import { useState, useCallback, useRef } from 'react';
import { Project } from '../../../../contexts/ProjectContext';
import { AISettings } from '../../../../types/ai';
import { aiService } from '../../../../services/aiService';

interface Chapter {
  id: string;
  title: string;
  summary: string;
  draft?: string;
  characters?: string[];
  setting?: string;
  mood?: string;
  keyEvents?: string[];
}

interface ChapterDetails {
  characters: string;
  setting: string;
  mood: string;
  keyEvents: string;
}

interface ChapterProgress {
  chapterId: string;
  chapterTitle: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

interface UseAllChaptersGenerationOptions {
  currentProject: Project | null;
  settings: AISettings;
  isConfigured: boolean;
  getChapterDetails: (chapter: Chapter) => ChapterDetails;
  onError: (message: string, duration?: number, options?: { title?: string; details?: string }) => void;
  onWarning: (message: string, duration?: number, options?: { title?: string }) => void;
  updateProject: (updates: Partial<Project>) => void;
  setChapterDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setShowCompletionToast: (message: string | null) => void;
  addLog?: (log: { type: string; prompt: string; response: string; error?: string; chapterId?: string }) => Promise<unknown>;
}

interface UseAllChaptersGenerationReturn {
  isGeneratingAllChapters: boolean;
  generationProgress: { current: number; total: number };
  generationStatus: string;
  chapterProgressList: ChapterProgress[];
  handleGenerateAllChapters: () => Promise<void>;
  handleCancelAllChaptersGeneration: () => void;
}

export const useAllChaptersGeneration = ({
  currentProject,
  settings,
  isConfigured,
  getChapterDetails,
  onError,
  onWarning,
  updateProject,
  setChapterDrafts,
  setShowCompletionToast,
  addLog,
}: UseAllChaptersGenerationOptions): UseAllChaptersGenerationReturn => {
  const [isGeneratingAllChapters, setIsGeneratingAllChapters] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [chapterProgressList, setChapterProgressList] = useState<ChapterProgress[]>([]);
  const generationAbortControllerRef = useRef<AbortController | null>(null);

  // 全章生成のキャンセル処理
  const handleCancelAllChaptersGeneration = useCallback(() => {
    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
      generationAbortControllerRef.current = null;
    }
    setIsGeneratingAllChapters(false);
    setGenerationProgress({ current: 0, total: 0 });
    setGenerationStatus('キャンセルされました');
    setChapterProgressList(prev => 
      prev.map(ch => ch.status === 'generating' ? { ...ch, status: 'pending' } : ch)
    );
  }, []);

  // 全章生成
  const handleGenerateAllChapters = useCallback(async () => {
    if (!isConfigured) {
      onError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (!currentProject || currentProject.chapters.length === 0) {
      onWarning('章が設定されていません。章立てステップで章を作成してから実行してください。', 7000, {
        title: '章が設定されていません',
      });
      return;
    }

    // 確認は親コンポーネントで行う（ConfirmDialogを使用）

    setIsGeneratingAllChapters(true);
    setGenerationProgress({ current: 0, total: currentProject.chapters.length });
    setGenerationStatus('準備中...');
    
    // 章ごとの進捗リストを初期化
    const initialChapterProgress = currentProject.chapters.map(chapter => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      status: 'pending' as const,
    }));
    setChapterProgressList(initialChapterProgress);

    // キャンセル用のAbortControllerを作成
    const abortController = new AbortController();
    generationAbortControllerRef.current = abortController;

    let fullPrompt = '';
    
    try {
      // プロジェクト全体の情報を整理
      const projectInfo = {
        title: currentProject.title,
        mainGenre: currentProject.mainGenre || '未設定',
        subGenre: currentProject.subGenre || '未設定',
        targetReader: currentProject.targetReader || '未設定',
        projectTheme: currentProject.projectTheme || '未設定'
      };

      // キャラクター情報を整理
      const charactersInfo = currentProject.characters.map((char: { name: string; role: string; appearance: string; personality: string; background: string }) => 
        `【${char.name}】\n役割: ${char.role}\n外見: ${char.appearance}\n性格: ${char.personality}\n背景: ${char.background}`
      ).join('\n\n');

      // プロット情報を整理
      const plotInfo = {
        theme: currentProject.plot?.theme || '未設定',
        setting: currentProject.plot?.setting || '未設定',
        hook: currentProject.plot?.hook || '未設定',
        protagonistGoal: currentProject.plot?.protagonistGoal || '未設定',
        mainObstacle: currentProject.plot?.mainObstacle || '未設定',
        structure: currentProject.plot?.structure || 'kishotenketsu'
      };

      // 物語構造の詳細を取得
      let structureDetails = '';
      if (plotInfo.structure === 'kishotenketsu') {
        structureDetails = `起承転結構造:\n起: ${currentProject.plot?.ki || '未設定'}\n承: ${currentProject.plot?.sho || '未設定'}\n転: ${currentProject.plot?.ten || '未設定'}\n結: ${currentProject.plot?.ketsu || '未設定'}`;
      } else if (plotInfo.structure === 'three-act') {
        structureDetails = `三幕構成:\n第1幕: ${currentProject.plot?.act1 || '未設定'}\n第2幕: ${currentProject.plot?.act2 || '未設定'}\n第3幕: ${currentProject.plot?.act3 || '未設定'}`;
      } else if (plotInfo.structure === 'four-act') {
        structureDetails = `四幕構成:\n第1幕: ${currentProject.plot?.fourAct1 || '未設定'}\n第2幕: ${currentProject.plot?.fourAct2 || '未設定'}\n第3幕: ${currentProject.plot?.fourAct3 || '未設定'}\n第4幕: ${currentProject.plot?.fourAct4 || '未設定'}`;
      } else if (plotInfo.structure === 'heroes-journey') {
        structureDetails = `ヒーローズ・ジャーニー:\n日常の世界: ${currentProject.plot?.hj1 || '未設定'}\n冒険への誘い: ${currentProject.plot?.hj2 || '未設定'}\n境界越え: ${currentProject.plot?.hj3 || '未設定'}\n試練と仲間: ${currentProject.plot?.hj4 || '未設定'}\n最大の試練: ${currentProject.plot?.hj5 || '未設定'}\n報酬: ${currentProject.plot?.hj6 || '未設定'}\n帰路: ${currentProject.plot?.hj7 || '未設定'}\n復活と帰還: ${currentProject.plot?.hj8 || '未設定'}`;
      } else if (plotInfo.structure === 'beat-sheet') {
        structureDetails = `ビートシート:\n導入 (Setup): ${currentProject.plot?.bs1 || '未設定'}\n決断 (Break into Two): ${currentProject.plot?.bs2 || '未設定'}\n試練 (Fun and Games): ${currentProject.plot?.bs3 || '未設定'}\n転換点 (Midpoint): ${currentProject.plot?.bs4 || '未設定'}\n危機 (All Is Lost): ${currentProject.plot?.bs5 || '未設定'}\nクライマックス (Finale): ${currentProject.plot?.bs6 || '未設定'}\n結末 (Final Image): ${currentProject.plot?.bs7 || '未設定'}`;
      } else if (plotInfo.structure === 'mystery-suspense') {
        structureDetails = `ミステリー・サスペンス構成:\n発端（事件発生）: ${currentProject.plot?.ms1 || '未設定'}\n捜査（初期）: ${currentProject.plot?.ms2 || '未設定'}\n仮説とミスリード: ${currentProject.plot?.ms3 || '未設定'}\n第二の事件/急展開: ${currentProject.plot?.ms4 || '未設定'}\n手がかりの統合: ${currentProject.plot?.ms5 || '未設定'}\n解決（真相解明）: ${currentProject.plot?.ms6 || '未設定'}\nエピローグ: ${currentProject.plot?.ms7 || '未設定'}`;
      }

      // 各章の情報を整理
      const chaptersInfo = currentProject.chapters.map((chapter, index) => {
        const chapterDetails = getChapterDetails(chapter);
        return `【第${index + 1}章: ${chapter.title}】
概要: ${chapter.summary}
登場キャラクター: ${chapterDetails.characters}
設定・場所: ${chapterDetails.setting}
雰囲気: ${chapterDetails.mood}
重要な出来事: ${chapterDetails.keyEvents}`;
      }).join('\n\n');

      // 全章生成用のプロンプトを作成
      fullPrompt = aiService.buildPrompt('draft', 'generateFull', {
        title: projectInfo.title,
        mainGenre: projectInfo.mainGenre,
        subGenre: projectInfo.subGenre,
        targetReader: projectInfo.targetReader,
        projectTheme: projectInfo.projectTheme,
        plotTheme: plotInfo.theme,
        plotSetting: plotInfo.setting,
        plotHook: plotInfo.hook,
        protagonistGoal: plotInfo.protagonistGoal,
        mainObstacle: plotInfo.mainObstacle,
        structureDetails: structureDetails,
        charactersInfo: charactersInfo,
        chaptersInfo: chaptersInfo,
      });

      setGenerationStatus('AI生成中...（全章の一貫性を保ちながら執筆中）');
      
      // 最初の章を生成中に設定
      if (initialChapterProgress.length > 0) {
        setChapterProgressList(prev => 
          prev.map((ch, idx) => idx === 0 ? { ...ch, status: 'generating' } : ch)
        );
      }
      
      // 全章生成は長時間かかる可能性があるため、タイムアウトを600秒（10分）に設定
      const response = await aiService.generateContent({
        prompt: fullPrompt,
        type: 'draft',
        settings,
        signal: abortController.signal,
        timeout: 600000, // 600秒 = 10分
      });

      // キャンセルされた場合は処理をスキップ
      if (abortController.signal.aborted) {
        return;
      }

      if (response && response.content) {
        setGenerationStatus('結果を解析中...');
        
        // 生成された内容を解析して各章に分割
        const content = response.content;
        const chapterSections = content.split(/=== 第\d+章: .+? ===/);
        
        // 最初の要素は空文字列なので削除
        chapterSections.shift();
        
        // 各章の内容を抽出
        const generatedChapters: Record<string, string> = {};
        let chapterIndex = 0;
        
        for (let i = 0; i < currentProject.chapters.length && i < chapterSections.length; i++) {
          const chapter = currentProject.chapters[i];
          const chapterContent = chapterSections[i]?.trim() || '';
          
          // 進捗を更新
          setGenerationProgress({ current: i + 1, total: currentProject.chapters.length });
          setChapterProgressList(prev => 
            prev.map((ch, idx) => {
              if (idx === i) {
                return { ...ch, status: chapterContent ? 'completed' : 'error' };
              }
              if (idx === i + 1 && chapterContent) {
                return { ...ch, status: 'generating' };
              }
              return ch;
            })
          );
          
          if (chapterContent) {
            generatedChapters[chapter.id] = chapterContent;
            chapterIndex++;
          }
        }

        // 章草案を更新
        setChapterDrafts(prev => ({ ...prev, ...generatedChapters }));

        // プロジェクトの章に草案を保存
        const updatedChapters = currentProject.chapters.map(chapter => {
          if (generatedChapters[chapter.id]) {
            return { ...chapter, draft: generatedChapters[chapter.id] };
          }
          return chapter;
        });

        updateProject({ chapters: updatedChapters });

        setGenerationStatus(`完了！${chapterIndex}章の草案を生成しました。各章の内容を確認してください。`);
        
        // 成功メッセージ
        setShowCompletionToast(`全章生成が完了しました（${chapterIndex}/${currentProject.chapters.length}章）`);
        setTimeout(() => {
          setShowCompletionToast(null);
        }, 5000);

        // AIログを記録
        if (addLog) {
          try {
            await addLog({
              type: 'generateFull',
              prompt: fullPrompt,
              response: response.content,
            });
          } catch (logError) {
            console.error('AIログの記録に失敗しました:', logError);
          }
        }
        
      } else {
        throw new Error('AI生成に失敗しました');
      }

    } catch (error) {
      console.error('全章生成エラー:', error);
      
      // キャンセルされた場合
      if ((error as Error).name === 'AbortError') {
        setGenerationStatus('キャンセルされました');
        setChapterProgressList(prev => 
          prev.map(ch => ch.status === 'generating' ? { ...ch, status: 'pending' } : ch)
        );
        return;
      }
      
      if ((error as Error).name !== 'AbortError') {
        // エラーが発生した章をマーク
        setChapterProgressList(prev => 
          prev.map(ch => ch.status === 'generating' ? { ...ch, status: 'error' } : ch)
        );
        let errorMessage = '不明なエラーが発生しました';
        let errorDetails = '';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // エラーの種類に応じた詳細メッセージ
          if (error.message.includes('network') || error.message.includes('fetch')) {
            errorDetails = '\n\nネットワークエラーが発生しました。インターネット接続を確認してください。';
          } else if (error.message.includes('timeout')) {
            errorDetails = '\n\nタイムアウトエラーが発生しました。時間をおいて再度お試しください。';
          } else if (error.message.includes('quota') || error.message.includes('limit')) {
            errorDetails = '\n\nAPIの利用制限に達しました。しばらく時間をおいてから再度お試しください。';
          } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
            errorDetails = '\n\nAPIキーが無効です。AI設定でAPIキーを確認してください。';
          } else if (error.message.includes('rate limit')) {
            errorDetails = '\n\nリクエスト制限に達しました。しばらく時間をおいてから再度お試しください。';
          }
        }
        
        const fullErrorMessage = `全章生成中にエラーが発生しました: ${errorMessage}${errorDetails}`;
        const errorDetailsText = '対処方法：\n• ネットワーク接続を確認してください\n• AI設定でAPIキーが正しく設定されているか確認してください\n• しばらく時間をおいてから再度お試しください\n• 問題が続く場合は、個別に章を生成してください';
        
        onError(fullErrorMessage, 10000, {
          title: '全章生成エラー',
          details: errorDetailsText,
        });
        setGenerationStatus('エラーが発生しました');

        // エラー時もAIログを記録
        if (addLog && currentProject) {
          try {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await addLog({
              type: 'generateFull',
              prompt: fullPrompt || '',
              response: '',
              error: errorMessage,
            });
          } catch (logError) {
            console.error('AIログの記録に失敗しました:', logError);
          }
        }
      }
    } finally {
      setIsGeneratingAllChapters(false);
      setGenerationProgress({ current: 0, total: 0 });
      setChapterProgressList([]);
      generationAbortControllerRef.current = null;
    }
  }, [
    currentProject,
    settings,
    isConfigured,
    getChapterDetails,
    onError,
    onWarning,
    updateProject,
    setChapterDrafts,
    setShowCompletionToast,
    addLog,
  ]);

  return {
    isGeneratingAllChapters,
    generationProgress,
    generationStatus,
    chapterProgressList,
    handleGenerateAllChapters,
    handleCancelAllChaptersGeneration,
  };
};

