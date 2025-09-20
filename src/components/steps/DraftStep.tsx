import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { PenTool, Sparkles, BookOpen, Save, Download, FileText } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { databaseService } from '../../services/databaseService';

export const DraftStep: React.FC = () => {
  const { currentProject, updateProject, createManualBackup } = useProject();
  const { isConfigured, settings } = useAI();
  
  // State variables
  const [draft, setDraft] = useState(currentProject?.draft || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterDrafts, setChapterDrafts] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState('');
  
  // 全章生成用の状態
  const [isGeneratingAllChapters, setIsGeneratingAllChapters] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [generationStatus, setGenerationStatus] = useState<string>('');
  
  // カスタムプロンプト用の状態
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);

  // カスタムプロンプトの保存・読み込み
  useEffect(() => {
    if (currentProject) {
      const savedCustomPrompt = localStorage.getItem(`customPrompt_${currentProject.id}`);
      const savedUseCustomPrompt = localStorage.getItem(`useCustomPrompt_${currentProject.id}`);
      
      if (savedCustomPrompt) {
        setCustomPrompt(savedCustomPrompt);
      }
      if (savedUseCustomPrompt === 'true') {
        setUseCustomPrompt(true);
      }
    }
  }, [currentProject]);

  // カスタムプロンプトの保存
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem(`customPrompt_${currentProject.id}`, customPrompt);
      localStorage.setItem(`useCustomPrompt_${currentProject.id}`, useCustomPrompt.toString());
    }
  }, [customPrompt, useCustomPrompt, currentProject]);
  
  // 現在の値を保持するためのref
  const currentDraftRef = useRef(draft);
  const currentSelectedChapterRef = useRef(selectedChapter);
  
  // refを更新
  useEffect(() => {
    currentDraftRef.current = draft;
  }, [draft]);
  
  useEffect(() => {
    currentSelectedChapterRef.current = selectedChapter;
  }, [selectedChapter]);

  // データ管理側のバックアップ機能を利用
  const handleCreateManualBackup = async () => {
    if (!currentProject) return;
    
    // 現在の草案状態を保存してからバックアップを作成
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }
    
    try {
      const description = prompt('手動バックアップの説明を入力してください:', '草案作業時のバックアップ');
      if (!description) return;
      
      await createManualBackup(description);
    } catch (error) {
      console.error('バックアップ作成エラー:', error);
      // createManualBackup関数内でエラーハンドリングが行われるため、ここでは追加のalertは不要
    }
  };

  // 章の草案を同期
  useEffect(() => {
    if (!currentProject) return;
    
    // 既存の章草案を初期化（空の草案も含む、既存のchapterDraftsは保持）
    setChapterDrafts(prevChapterDrafts => {
      const initialChapterDrafts: Record<string, string> = { ...prevChapterDrafts };
      currentProject.chapters.forEach(chapter => {
        // 既にchapterDraftsに存在する場合は保持、存在しない場合は初期化
        if (!(chapter.id in initialChapterDrafts)) {
          initialChapterDrafts[chapter.id] = chapter.draft || '';
        }
      });
      return initialChapterDrafts;
    });
  }, [currentProject]);

  // 章が変更されたときの処理（クリーンアップは停止）
  // useEffect(() => {
  //   if (currentProject) {
  //     cleanupDeletedChapterDrafts(currentProject);
  //   }
  // }, [currentProject?.chapters]);

  // 選択された章の草案を読み込み
  useEffect(() => {
    if (selectedChapter) {
      // 選択された章に既存の草案があるかチェック
      if (chapterDrafts[selectedChapter]) {
        setDraft(chapterDrafts[selectedChapter]);
      } else {
        // 新規章の場合は空の草案を設定
        setDraft('');
      }
    }
  }, [selectedChapter, chapterDrafts]);

  // 章選択ハンドラー
  const handleChapterSelect = async (chapterId: string) => {
    // 現在の章の内容を保存（章が選択されている場合）
    if (selectedChapter) {
      await handleSaveChapterDraft(selectedChapter, draft);
    }
    
    // 選択された章を設定（草案はuseEffectで適切に初期化される）
    setSelectedChapter(chapterId);
  };

  // 現在の章を取得
  const getCurrentChapter = () => {
    if (!selectedChapter || !currentProject) return null;
    return currentProject.chapters.find(c => c.id === selectedChapter) || null;
  };

  const currentChapter = getCurrentChapter();

  // 章草案保存ハンドラー
  const handleSaveChapterDraft = async (chapterId: string, content?: string) => {
    if (!currentProject) return;
    
    try {
      const contentToSave = content || draft;
      
      // chapterDraftsを更新（空の草案も含む）
      const updatedChapterDrafts = { ...chapterDrafts, [chapterId]: contentToSave };
      setChapterDrafts(updatedChapterDrafts);
      
      // プロジェクトの章に草案を保存
      const updatedChapters = currentProject.chapters.map(chapter => {
        if (chapter.id === chapterId) {
          return { ...chapter, draft: contentToSave };
        }
        return chapter;
      });
      
      const updatedProject = {
        ...currentProject,
        chapters: updatedChapters,
        draft: contentToSave,
        updatedAt: new Date(),
      };
      
      updateProject({ 
        chapters: updatedChapters,
        draft: contentToSave // メインの草案も更新
      });
      
      // 即座にデータベースに保存（デバウンスを待たない）
      await databaseService.saveProject(updatedProject);
    } catch (error) {
      console.error('章草案保存エラー:', error);
      // エラーが発生してもUIの状態は更新済みなので、ユーザーには通知しない
    }
  };

  // 削除された章の草案データをクリーンアップ（機能停止）
  // const cleanupDeletedChapterDrafts = (project: typeof currentProject) => {
  //   if (!project) return;
  //   
  //   const existingChapterIds = new Set(project.chapters.map(chapter => chapter.id));
  //   const cleanedChapterDrafts = Object.keys(chapterDrafts).reduce((acc, chapterId) => {
  //     // 章が存在する場合のみ保持（空の草案も含む）
  //     if (existingChapterIds.has(chapterId)) {
  //       acc[chapterId] = chapterDrafts[chapterId];
  //     }
  //     return acc;
  //   }, {} as Record<string, string>);
  //   
  //   setChapterDrafts(cleanedChapterDrafts);
  // };

  // 章詳細情報を取得
  const getChapterDetails = (chapter: any) => {
    if (!chapter || !currentProject) {
      return {
        characters: '未設定',
        setting: '未設定',
        mood: '未設定',
        keyEvents: '未設定'
      };
    }

    // キャラクター情報の取得を修正
    // chapter.charactersは文字列配列（キャラクター名）として保存されている
    const characters = chapter.characters && chapter.characters.length > 0
      ? chapter.characters.join(', ')
      : '未設定';

    const setting = chapter.setting || '未設定';
    const mood = chapter.mood || '未設定';
    const keyEvents = chapter.keyEvents && chapter.keyEvents.length > 0
      ? chapter.keyEvents.join(', ')
      : '未設定';

    return { characters, setting, mood, keyEvents };
  };

  // 文字数カウント
  const wordCount = draft.length;

  // カスタムプロンプトの構築
  const buildCustomPrompt = (currentChapter: any, chapterDetails: any, projectCharacters: string) => {
    const basePrompt = `以下の章の情報を基に、会話を重視し、読者に臨場感のある魅力的な小説の章を執筆してください。

【最重要：章情報】
章タイトル: ${currentChapter.title}
章の概要: ${currentChapter.summary}

【章の詳細設定】
設定・場所: ${chapterDetails.setting}
雰囲気・ムード: ${chapterDetails.mood}
重要な出来事: ${chapterDetails.keyEvents}
登場キャラクター: ${chapterDetails.characters}

【プロジェクト基本情報】
作品タイトル: ${currentProject?.title}
メインジャンル: ${currentProject?.mainGenre || '未設定'}
サブジャンル: ${currentProject?.subGenre || '未設定'}
ターゲット読者: ${currentProject?.targetReader || '未設定'}
プロジェクトテーマ: ${currentProject?.projectTheme || '未設定'}

【プロット基本設定】
テーマ: ${currentProject?.plot?.theme || '未設定'}
舞台設定: ${currentProject?.plot?.setting || '未設定'}
フック: ${currentProject?.plot?.hook || '未設定'}
主人公の目標: ${currentProject?.plot?.protagonistGoal || '未設定'}
主要な障害: ${currentProject?.plot?.mainObstacle || '未設定'}

【キャラクター情報】
${projectCharacters}

【執筆指示】
1. **文字数**: 3000-4000文字程度で執筆してください
2. **会話重視**: キャラクター同士の会話を豊富に含め、自然で生き生きとした対話を心がけてください
3. **臨場感**: 読者がその場にいるような感覚を与える詳細な情景描写を入れてください
4. **感情表現**: キャラクターの心理状態や感情を丁寧に描写してください
5. **五感の活用**: 視覚、聴覚、触覚、嗅覚、味覚を意識した描写を入れてください
6. **章の目的**: 章の概要に沿った内容で、物語を前進させてください
7. **一貫性**: キャラクターの性格や設定を一貫して保ってください

【文体の特徴】
- 現代的な日本語小説の文体
- 読み手が感情移入しやすい表現
- 適度な改行と段落分け（会話の前後、場面転換時など）
- 会話は「」で囲み、自然な話し方で
- 情景描写は詩的で美しい表現を
- 改行は自然な文章の流れに従って適切に行う

【改行の指示】
- 会話の前後で改行する
- 場面転換時に改行する
- 段落の区切りで改行する
- 長い文章は読みやすく適度に改行する
- 改行は通常の改行文字（\n）で表現する

章の内容を執筆してください。`;

    if (useCustomPrompt && customPrompt.trim()) {
      return `${basePrompt}\n\n【カスタム執筆指示】\n${customPrompt}`;
    }
    
    return basePrompt;
  };

  // AI生成ハンドラー
  const handleAIGenerate = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    if (!currentProject) return;

    // 非ローカルLLM推奨の警告
    if (settings.provider === 'local') {
      const useNonLocal = confirm('非ローカルLLM（OpenAI、Anthropic等）の使用を推奨します。\n\n非ローカルLLMは以下の利点があります：\n• より自然で流暢な文章生成\n• 会話の臨場感と感情表現\n• 3000-4000文字の長文生成に最適\n\n続行しますか？');
      if (!useNonLocal) return;
    }

    setIsGenerating(true);
    
    try {
      const currentChapter = getCurrentChapter();
      
      if (!currentChapter) {
        alert('章を選択してください。');
        return;
      }

      // 章詳細情報を取得
      const chapterDetails = getChapterDetails(currentChapter);
      
      // プロジェクトのキャラクター情報を整理
      const projectCharacters = currentProject.characters.map((char: any) => 
        `${char.name}: ${char.bio || char.description || '説明なし'}`
      ).join('\n');

      // プロンプトを構築
      const prompt = buildCustomPrompt(currentChapter, chapterDetails, projectCharacters);

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        // 章草案を保存
        handleSaveChapterDraft(selectedChapter!, response.content);
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      alert('AI生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 続き生成
  const handleContinueGeneration = async () => {
    if (!currentProject || !selectedChapter) return;
    
    setIsGenerating(true);
    try {
      const currentChapter = getCurrentChapter();
      // const chapterDetails = getChapterDetails(currentChapter);
      
      const prompt = `以下の章の続きを執筆してください。

【章情報】
章タイトル: ${currentChapter?.title}
章の概要: ${currentChapter?.summary}

【現在の文章】
${draft}

【続きの執筆指示】
- 上記の文章の自然な続きを書いてください
- 会話を重視し、臨場感のある描写を心がけてください
- 1000-1500文字程度で続きを執筆してください
- 章の目的に沿った内容で物語を前進させてください
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

続きを執筆してください：`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        const newContent = draft + '\n\n' + response.content;
        setDraft(newContent);
        handleSaveChapterDraft(selectedChapter!, newContent);
      }
    } catch (error) {
      console.error('続き生成エラー:', error);
      alert('続き生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 描写強化
  const handleDescriptionEnhancement = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    setIsGenerating(true);
    try {
      const prompt = `以下の文章の描写をより詳細で魅力的に強化してください。

【現在の文章】
${draft}

【強化指示】
- 情景描写をより詳細に
- キャラクターの感情表現を豊かに
- 五感を使った表現を追加
- 会話の自然さを保ちつつ、心理描写を強化
- 文章の長さは元の1.2-1.5倍程度に
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

強化された文章：`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        handleSaveChapterDraft(selectedChapter!, response.content);
      }
    } catch (error) {
      console.error('描写強化エラー:', error);
      alert('描写強化中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 文体調整
  const handleStyleAdjustment = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    setIsGenerating(true);
    try {
      const prompt = `以下の文章の文体を調整し、より読みやすく魅力的にしてください。

【現在の文章】
${draft}

【調整指示】
- 文章のリズムを整える
- 冗長な表現を簡潔に
- 読みやすい改行と段落分け
- 自然で現代的な日本語に
- 内容は変えずに表現のみ改善
- 改行はHTMLの<p>タグで表現してください

調整された文章：`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        handleSaveChapterDraft(selectedChapter!, response.content);
      }
    } catch (error) {
      console.error('文体調整エラー:', error);
      alert('文体調整中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 文章短縮
  const handleShortenText = async () => {
    if (!selectedChapter || !draft.trim()) return;
    
    setIsGenerating(true);
    try {
      const prompt = `以下の文章を簡潔にまとめ、冗長な部分を削除してください。

【現在の文章】
${draft}

【短縮指示】
- 重要な内容は保持
- 冗長な表現を削除
- 文章の流れを保つ
- 約70-80%の長さに短縮
- 読みやすさを維持
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

短縮された文章：`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setDraft(response.content);
        handleSaveChapterDraft(selectedChapter!, response.content);
      }
    } catch (error) {
      console.error('文章短縮エラー:', error);
      alert('文章短縮中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 全章生成機能
  const handleGenerateAllChapters = async () => {
    if (!isConfigured) {
      alert('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      return;
    }

    if (!currentProject || currentProject.chapters.length === 0) {
      alert('章が設定されていません。章立てステップで章を作成してから実行してください。');
      return;
    }

    // 非ローカルLLM推奨の警告
    if (settings.provider === 'local') {
      const useNonLocal = confirm('全章生成には非ローカルLLM（OpenAI、Anthropic等）の使用を強く推奨します。\n\n理由：\n• 一貫性のある長文生成\n• キャラクター設定の維持\n• 物語の流れの統一\n• 高品質な文章生成\n\n続行しますか？');
      if (!useNonLocal) return;
    }

    // 確認ダイアログ
    const confirmMessage = `全${currentProject.chapters.length}章の草案を一括生成します。\n\n既存の章草案は上書きされます。\n\n実行しますか？`;
    if (!confirm(confirmMessage)) return;

    setIsGeneratingAllChapters(true);
    setGenerationProgress({ current: 0, total: currentProject.chapters.length });
    setGenerationStatus('準備中...');

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
      const charactersInfo = currentProject.characters.map((char: any) => 
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
      const fullPrompt = `以下のプロジェクト全体の情報を基に、一貫性のある魅力的な小説の全章を執筆してください。

【プロジェクト基本情報】
作品タイトル: ${projectInfo.title}
メインジャンル: ${projectInfo.mainGenre}
サブジャンル: ${projectInfo.subGenre}
ターゲット読者: ${projectInfo.targetReader}
プロジェクトテーマ: ${projectInfo.projectTheme}

【プロット基本設定】
テーマ: ${plotInfo.theme}
舞台設定: ${plotInfo.setting}
フック: ${plotInfo.hook}
主人公の目標: ${plotInfo.protagonistGoal}
主要な障害: ${plotInfo.mainObstacle}

【物語構造の詳細】
${structureDetails}

【キャラクター情報】
${charactersInfo}

【章立て構成】
${chaptersInfo}

【執筆指示】
1. **全章の一貫性**: キャラクターの性格、設定、物語の流れを全章を通して一貫させてください
2. **文字数**: 各章3000-4000文字程度で執筆してください
3. **会話重視**: キャラクター同士の会話を豊富に含め、自然で生き生きとした対話を心がけてください
4. **臨場感**: 読者がその場にいるような感覚を与える詳細な情景描写を入れてください
5. **感情表現**: キャラクターの心理状態や感情を丁寧に描写してください
6. **五感の活用**: 視覚、聴覚、触覚、嗅覚、味覚を意識した描写を入れてください
7. **章の目的**: 各章の概要に沿った内容で、物語を前進させてください
8. **文体の統一**: 現代的な日本語小説の文体で、読み手が感情移入しやすい表現を使用してください

【出力形式】
以下の形式で各章の草案を出力してください：

=== 第1章: [章タイトル] ===
[章の草案内容]

=== 第2章: [章タイトル] ===
[章の草案内容]

[以下、全章分続く]

各章の草案を執筆してください。`;

      setGenerationStatus('AI生成中...');
      const response = await aiService.generateContent({
        prompt: fullPrompt,
        type: 'draft',
        settings
      });

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

        setGenerationStatus(`完了！${chapterIndex}章の草案を生成しました。`);
        
        // 成功メッセージ
        alert(`全章生成が完了しました！\n\n生成された章数: ${chapterIndex}/${currentProject.chapters.length}\n\n各章の草案が保存されました。`);
        
      } else {
        throw new Error('AI生成に失敗しました');
      }

    } catch (error) {
      console.error('全章生成エラー:', error);
      alert(`全章生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      setGenerationStatus('エラーが発生しました');
    } finally {
      setIsGeneratingAllChapters(false);
      setGenerationProgress({ current: 0, total: 0 });
    }
  };

  // エクスポート機能
  const handleExportChapter = () => {
    if (!currentChapter || !draft.trim()) {
      alert('エクスポートする章の内容がありません');
      return;
    }
    
    const content = `# ${currentChapter.title}\n\n${draft}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentChapter.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFull = () => {
    if (!currentProject) return;
    
    let content = `# ${currentProject.title}\n\n`;
    
    // 各章の草案をエクスポート
    currentProject.chapters.forEach(chapter => {
      const chapterDraft = chapterDrafts[chapter.id];
      if (chapterDraft && chapterDraft.trim()) {
        content += `## ${chapter.title}\n\n${chapterDraft}\n\n`;
      }
    });
    
    if (content.trim() === `# ${currentProject.title}`) {
      alert('エクスポートする内容がありません');
      return;
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.title}_完全版.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 自動保存用のタイマー
  const autoSaveTimeoutRef = useRef<number | null>(null);

  // テキストエリアの変更ハンドラー
  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setDraft(newContent);
    
    // 即座にchapterDraftsを更新（保存はしない）
    if (selectedChapter) {
      setChapterDrafts(prev => ({
        ...prev,
        [selectedChapter]: newContent
      }));
      
      // 自動保存のタイマーを設定（2秒後に保存）
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (selectedChapter && newContent.trim()) {
          handleSaveChapterDraft(selectedChapter, newContent);
        }
      }, 2000);
    }
  };

  // コンポーネントのアンマウント時に現在の章の内容を保存
  useEffect(() => {
    return () => {
      // 自動保存タイマーをクリア
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      const currentChapter = currentSelectedChapterRef.current;
      const currentDraft = currentDraftRef.current;
      
      if (currentChapter && currentProject) {
        // 即座にデータベースに保存（非同期処理を同期的に実行）
        const saveToDatabase = async () => {
          try {
            const updatedChapters = currentProject.chapters.map(chapter => {
              if (chapter.id === currentChapter) {
                return { ...chapter, draft: currentDraft };
              }
              return chapter;
            });
            
            const updatedProject = {
              ...currentProject,
              chapters: updatedChapters,
              draft: currentDraft,
              updatedAt: new Date(),
            };
            
            await databaseService.saveProject(updatedProject);
          } catch (error) {
            console.error('アンマウント時の保存エラー:', error);
          }
        };
        
        // 保存を実行（エラーハンドリング付き）
        saveToDatabase();
      }
    };
  }, [currentProject]); // currentProjectを依存関係に追加

  // モーダル用テキストエリアの変更ハンドラー
  const handleModalDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setModalDraft(e.target.value);
  };

  // モーダル関連
  const handleOpenModal = () => {
    setModalDraft(draft);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalDraft('');
  };

  const handleModalSave = () => {
    setDraft(modalDraft);
    if (selectedChapter) {
      handleSaveChapterDraft(selectedChapter, modalDraft);
    }
    handleCloseModal();
  };

  const handleModalAIGenerate = async () => {
    if (!selectedChapter) return;
    
    setIsGenerating(true);
    try {
      const currentChapter = getCurrentChapter();
      
      const prompt = `以下の章の草案を改善してください。

【章情報】
章タイトル: ${currentChapter?.title}
章の概要: ${currentChapter?.summary}

【現在の草案】
${modalDraft}

【改善指示】
- 会話を重視し、臨場感のある描写に
- 3000-4000文字程度で執筆
- キャラクターの感情表現を豊かに
- 情景描写を詳細に
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

改善された草案：`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings
      });
      
      if (response && response.content) {
        setModalDraft(response.content);
      }
    } catch (error) {
      console.error('モーダルAI生成エラー:', error);
      alert('AI生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };


  // プロジェクトが存在しない場合の表示
  if (!currentProject) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          草案作成
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          プロジェクトを作成してから草案作成を開始してください。
        </p>
      </div>
    );
  }

  // 章が存在しない場合の表示
  if (currentProject.chapters.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          草案作成
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-4">
          草案を作成するには、まず章立てを完成させてください。
        </p>
        <div className="text-center">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            「章立て」ステップで章を作成してから戻ってきてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                草案作成
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                章ごとに詳細な草案を作成し、物語を完成させましょう
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCreateManualBackup}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-['Noto_Sans_JP']"
              >
                <Save className="h-4 w-4" />
                <span>バックアップ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* メインエディタエリア */}
          <div className="lg:col-span-2 order-1 lg:order-1">
            <div className="space-y-6">
              {/* メインエディタ */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* エディタヘッダー */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col gap-4">
                    {/* 章選択 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        章を選択
                      </label>
                      <select
                        value={selectedChapter || ''}
                        onChange={(e) => handleChapterSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP']"
                      >
                        <option value="">章を選択してください</option>
                        {currentProject.chapters.map(chapter => {
                          const hasContent = chapterDrafts[chapter.id] && chapterDrafts[chapter.id].trim();
                          return (
                            <option key={chapter.id} value={chapter.id}>
                              {chapter.title} {hasContent ? '✓' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {selectedChapter && currentChapter ? `${currentChapter.title} の草案` : '草案執筆'}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            if (selectedChapter) {
                              handleSaveChapterDraft(selectedChapter);
                            }
                          }}
                          disabled={!selectedChapter}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          <span>保存</span>
                        </button>
                        {selectedChapter && (
                          <button
                            onClick={handleOpenModal}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-sm text-sm"
                          >
                            <PenTool className="h-4 w-4" />
                            <span>執筆開始</span>
                          </button>
                        )}
                        <button
                          onClick={() => setShowCustomPromptModal(true)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors text-sm"
                        >
                          <PenTool className="h-4 w-4" />
                          <span>カスタムプロンプト</span>
                        </button>
                        <button
                          onClick={handleAIGenerate}
                          disabled={isGenerating || !selectedChapter}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors text-sm disabled:opacity-50"
                        >
                          <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                          <span>{isGenerating ? '生成中...' : 'AI執筆'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editor Preview */}
                <div className="p-4">
                  {/* 章内容表示 */}
                  {currentChapter && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP'] mb-2">
                            {currentChapter.title}
                          </h4>
                          <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                            {currentChapter.summary}
                          </p>
                          
                          {/* 章詳細情報 */}
                          {(() => {
                            const chapterDetails = getChapterDetails(currentChapter);
                            const hasDetails = Object.values(chapterDetails).some(value => value !== '未設定');
                            
                            if (!hasDetails) return null;
                            
                            return (
                              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {chapterDetails.characters !== '未設定' && (
                                    <div>
                                      <span className="font-medium text-blue-700 dark:text-blue-300">登場キャラクター:</span>
                                      <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.characters}</span>
                                    </div>
                                  )}
                                  {chapterDetails.setting !== '未設定' && (
                                    <div>
                                      <span className="font-medium text-blue-700 dark:text-blue-300">設定・場所:</span>
                                      <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.setting}</span>
                                    </div>
                                  )}
                                  {chapterDetails.mood !== '未設定' && (
                                    <div>
                                      <span className="font-medium text-blue-700 dark:text-blue-300">雰囲気:</span>
                                      <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.mood}</span>
                                    </div>
                                  )}
                                  {chapterDetails.keyEvents !== '未設定' && (
                                    <div className="sm:col-span-2">
                                      <span className="font-medium text-blue-700 dark:text-blue-300">重要な出来事:</span>
                                      <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.keyEvents}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* メインテキストエリア */}
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 min-h-[300px]">
                    {selectedChapter ? (
                      <div className="p-4">
                        <textarea
                          value={draft}
                          onChange={handleDraftChange}
                          placeholder="ここに草案を執筆してください..."
                          className="w-full h-[250px] p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-['Noto_Sans_JP'] leading-relaxed"
                          style={{ lineHeight: '1.6' }}
                        />
                      </div>
                    ) : (
                      <div className="p-4 min-h-[300px] flex items-center justify-center">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <PenTool className="h-16 w-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium font-['Noto_Sans_JP'] mb-2">
                            章を選択してください
                          </p>
                          <p className="text-sm font-['Noto_Sans_JP']">
                            左側の章一覧から章を選択すると、ここで草案を執筆できます
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 執筆ボタンと文字数表示 */}
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      文字数: {wordCount.toLocaleString()}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedChapter && (
                        <button
                          onClick={handleOpenModal}
                          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-sm font-['Noto_Sans_JP']"
                        >
                          <PenTool className="h-4 w-4" />
                          <span>執筆を開始</span>
                        </button>
                      )}
                      
                      {currentChapter && (
                      <button
                        onClick={handleExportChapter}
                        disabled={!draft.trim()}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP'] text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>章出力</span>
                      </button>
                      )}
                      
                      <button
                        onClick={handleGenerateAllChapters}
                        disabled={isGeneratingAllChapters || currentProject.chapters.length === 0}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-sm font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Sparkles className={`h-4 w-4 ${isGeneratingAllChapters ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingAllChapters ? '全章生成中...' : '全章生成'}</span>
                      </button>
                      
                      <button
                        onClick={handleExportFull}
                        className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP'] text-sm"
                      >
                        <FileText className="h-4 w-4" />
                        <span>完全版出力</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 右サイドバー - AIアシスタントと進捗 */}
          <div className="lg:col-span-1 order-2 lg:order-2">
            <div className="space-y-6">
              {/* AI Assistant Panel */}
              <div className={`bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-2xl border border-green-200 dark:border-green-800 ${!selectedChapter ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-10 h-10 rounded-full flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    執筆アシスタント
                  </h3>
                </div>
                
                <p className="text-gray-700 dark:text-gray-300 mb-4 font-['Noto_Sans_JP']">
                  {selectedChapter ? 'AIが執筆をサポートします：' : '章を選択するとAIサポートが利用できます'}
                </p>
                
                <div className="space-y-3">
                  <button 
                    onClick={handleContinueGeneration}
                    disabled={isGenerating || !draft.trim() || !selectedChapter}
                    className="w-full p-3 text-left bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']">続きを生成</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">文章の続きを提案</div>
                      </div>
                      {isGenerating && (
                        <Sparkles className="h-4 w-4 text-green-500 animate-spin" />
                      )}
                    </div>
                  </button>
                  
                  <button 
                    onClick={handleDescriptionEnhancement}
                    disabled={isGenerating || !draft.trim() || !selectedChapter}
                    className="w-full p-3 text-left bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']">描写強化</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">情景描写を詳しく</div>
                      </div>
                      {isGenerating && (
                        <Sparkles className="h-4 w-4 text-green-500 animate-spin" />
                      )}
                    </div>
                  </button>
                  
                  <button 
                    onClick={handleStyleAdjustment}
                    disabled={isGenerating || !draft.trim() || !selectedChapter}
                    className="w-full p-3 text-left bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']">文体調整</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">読みやすく修正</div>
                      </div>
                      {isGenerating && (
                        <Sparkles className="h-4 w-4 text-green-500 animate-spin" />
                      )}
                    </div>
                  </button>
                  
                  <button 
                    onClick={handleShortenText}
                    disabled={isGenerating || !draft.trim() || !selectedChapter}
                    className="w-full p-3 text-left bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']">文章短縮</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">簡潔にまとめる</div>
                      </div>
                      {isGenerating && (
                        <Sparkles className="h-4 w-4 text-green-500 animate-spin" />
                      )}
                    </div>
                  </button>
                  
                  <button 
                    onClick={handleGenerateAllChapters}
                    disabled={isGeneratingAllChapters || currentProject.chapters.length === 0}
                    className="w-full p-3 text-left bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg hover:from-purple-200 hover:to-pink-200 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-purple-200 dark:border-purple-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-purple-900 dark:text-purple-100 text-sm font-['Noto_Sans_JP']">全章生成</div>
                        <div className="text-xs text-purple-600 dark:text-purple-300 font-['Noto_Sans_JP']">全章を一括生成</div>
                      </div>
                      {isGeneratingAllChapters && (
                        <Sparkles className="h-4 w-4 text-purple-500 animate-spin" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* 全章生成パネル */}
              {isGeneratingAllChapters && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 w-10 h-10 rounded-full flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-white animate-spin" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      全章生成中
                    </h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      {generationStatus}
                    </div>
                    
                    {generationProgress.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                            進捗
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {generationProgress.current} / {generationProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${(generationProgress.current / generationProgress.total) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                      全章の一貫性を保ちながら生成中です。しばらくお待ちください...
                    </div>
                  </div>
                </div>
              )}

              {/* 執筆進捗パネル */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                  執筆進捗
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {currentChapter ? '章文字数' : '目標文字数'}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {currentChapter ? wordCount.toLocaleString() : '3,000-4,000'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500" 
                        style={{ 
                          width: currentChapter 
                            ? `${Math.min((wordCount / 3500) * 100, 100)}%` 
                            : `${Math.min((wordCount / 3500) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {currentChapter 
                        ? `${Math.min((wordCount / 3500) * 100, 100).toFixed(1)}% 完了 (目標: 3,000-4,000文字)`
                        : `${Math.min((wordCount / 3500) * 100, 100).toFixed(1)}% 完了`
                      }
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {currentProject.chapters.length}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">章数</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {Object.keys(chapterDrafts).length}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">草案済み章数</div>
                      </div>
                    </div>
                    
                    {currentProject.chapters.length > 0 && (
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                          章草案進捗
                        </div>
                        <div className="space-y-2">
                          {Object.keys(chapterDrafts).length > 0 ? (
                            <div className="text-xs text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">
                              {Object.keys(chapterDrafts).length} / {currentProject.chapters.length} 章草案済み
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                              まだ章の草案は作成されていません
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* カスタムプロンプトモーダル */}
      {showCustomPromptModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* オーバーレイ */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowCustomPromptModal(false)}
            />
            
            {/* モーダルコンテンツ */}
            <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
              {/* モーダルヘッダー */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 w-8 h-8 rounded-full flex items-center justify-center">
                    <PenTool className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      カスタムプロンプト設定
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      執筆スタイルをカスタマイズできます
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowCustomPromptModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* モーダルボディ */}
              <div className="p-6">
                <div className="space-y-6">
                  {/* カスタムプロンプト使用の切り替え */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="useCustomPrompt"
                      checked={useCustomPrompt}
                      onChange={(e) => setUseCustomPrompt(e.target.checked)}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label htmlFor="useCustomPrompt" className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      カスタムプロンプトを使用する
                    </label>
                  </div>

                  {/* カスタムプロンプト入力エリア */}
                  {useCustomPrompt && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                          カスタム執筆指示
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
                          基本的なプロンプトに追加する執筆指示を記述してください。例：「詩的な表現を多用する」「一人称視点で執筆する」「短編小説風の文体にする」など
                        </p>
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="例：
• 詩的な表現を多用し、美しい情景描写を心がける
• 一人称視点で主人公の内面を深く描写する
• 短編小説風の簡潔で印象的な文体にする
• 会話は最小限に抑え、心理描写を重視する
• ミステリー要素を織り交ぜ、読者の興味を引く展開にする"
                          className="w-full h-40 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-['Noto_Sans_JP'] leading-relaxed"
                          style={{ lineHeight: '1.6' }}
                        />
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        文字数: {customPrompt.length.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* プレビューエリア */}
                  {useCustomPrompt && customPrompt.trim() && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                        プロンプトプレビュー
                      </h4>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] whitespace-pre-wrap">
                          【基本プロンプト】<br/>
                          以下の章の情報を基に、会話を重視し、読者に臨場感のある魅力的な小説の章を執筆してください。<br/><br/>
                          【章情報・プロジェクト情報・キャラクター情報・執筆指示】<br/>
                          （省略）<br/><br/>
                          【カスタム執筆指示】<br/>
                          {customPrompt}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* モーダルフッター */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {useCustomPrompt ? 'カスタムプロンプトが有効です' : 'デフォルトプロンプトを使用します'}
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setCustomPrompt('');
                      setUseCustomPrompt(false);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
                  >
                    リセット
                  </button>
                  <button
                    onClick={() => setShowCustomPromptModal(false)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    保存して閉じる
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* オーバーレイ */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCloseModal}
            />
            
            {/* モーダルコンテンツ */}
            <div className="relative w-full max-w-7xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
              {/* モーダルヘッダー */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-8 h-8 rounded-full flex items-center justify-center">
                    <PenTool className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      {currentChapter ? `${currentChapter.title} の草案執筆` : '物語の草案執筆'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {modalDraft.length.toLocaleString()} 文字
                      {currentChapter && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          ({currentChapter.title})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleModalAIGenerate}
                    disabled={isGenerating || !selectedChapter}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors text-sm disabled:opacity-50"
                  >
                    <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>{isGenerating ? '生成中...' : 'AI執筆支援'}</span>
                  </button>
                  
                  <button
                    onClick={handleCloseModal}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* モーダルボディ */}
              <div className="p-4">
                {/* 章内容表示 */}
                {currentChapter && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP'] mb-2">
                          {currentChapter.title}
                        </h4>
                        <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                          {currentChapter.summary}
                        </p>
                        
                        {/* 章詳細情報 */}
                        {(() => {
                          const chapterDetails = getChapterDetails(currentChapter);
                          const hasDetails = Object.values(chapterDetails).some(value => value !== '未設定');
                          
                          if (!hasDetails) return null;
                          
                          return (
                            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {chapterDetails.characters !== '未設定' && (
                                  <div>
                                    <span className="font-medium text-blue-700 dark:text-blue-300">登場キャラクター:</span>
                                    <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.characters}</span>
                                  </div>
                                )}
                                {chapterDetails.setting !== '未設定' && (
                                  <div>
                                    <span className="font-medium text-blue-700 dark:text-blue-300">設定・場所:</span>
                                    <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.setting}</span>
                                  </div>
                                )}
                                {chapterDetails.mood !== '未設定' && (
                                  <div>
                                    <span className="font-medium text-blue-700 dark:text-blue-300">雰囲気:</span>
                                    <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.mood}</span>
                                  </div>
                                )}
                                {chapterDetails.keyEvents !== '未設定' && (
                                  <div className="sm:col-span-2">
                                    <span className="font-medium text-blue-700 dark:text-blue-300">重要な出来事:</span>
                                    <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.keyEvents}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* テキストエリア */}
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  <textarea
                    value={modalDraft}
                    onChange={handleModalDraftChange}
                    placeholder={`上記の章内容を詳しく描写し、魅力的な物語の草案を執筆してください...\n\n例：\n・情景描写を豊かに\n・キャラクターの心理描写を深く\n・会話を自然に\n・物語の流れを滑らかに`}
                    className="w-full h-[400px] p-4 border-0 rounded-lg bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none resize-none font-['Noto_Sans_JP'] leading-relaxed"
                    style={{ lineHeight: '1.6' }}
                  />
                </div>

                {/* モーダルフッター */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    文字数: {modalDraft.length.toLocaleString()}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleModalSave}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-['Noto_Sans_JP']"
                    >
                      保存して閉じる
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};