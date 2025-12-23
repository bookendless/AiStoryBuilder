import React, { useState, useCallback } from 'react';
import { Plus, User, Network } from 'lucide-react';
import { useProject, Character } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { RelationshipDiagram } from '../tools/RelationshipDiagram';
import { useToast } from '../Toast';
import { EmptyState } from '../common/EmptyState';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { ImageViewerModal } from './character/ImageViewerModal';
import { CharacterModal } from './character/CharacterModal';
import { CharacterCard } from './character/CharacterCard';
import { CharacterPossessionChat } from '../tools/CharacterPossessionChat';
import { CharacterDiary } from '../tools/CharacterDiary';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StepNavigation } from '../common/StepNavigation';
import { Step } from '../../App';

interface CharacterStepProps {
  onNavigateToStep?: (step: Step) => void;
}

export const CharacterStep: React.FC<CharacterStepProps> = ({ onNavigateToStep }) => {
  const { currentProject, updateProject } = useProject();
  const { settings, isConfigured } = useAI();
  const { showError, showSuccess } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showRelationships, setShowRelationships] = useState(false);
  const [possessionCharacterId, setPossessionCharacterId] = useState<string | null>(null);
  const [diaryCharacterId, setDiaryCharacterId] = useState<string | null>(null);
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    type: 'ai-enhance' | 'delete' | null;
    characterId: string | null;
    characterName: string;
  }>({
    isOpen: false,
    type: null,
    characterId: null,
    characterName: '',
  });
  const [imageViewerState, setImageViewerState] = useState<{
    isOpen: boolean;
    imageUrl: string;
    characterName: string;
  }>({
    isOpen: false,
    imageUrl: '',
    characterName: ''
  });

  // モーダルを開く（新規追加）
  const handleOpenAddModal = () => {
    setEditingCharacter(null);
    setIsModalOpen(true);
  };

  // モーダルを開く（編集）
  const handleOpenEditModal = useCallback((character: Character) => {
    setEditingCharacter(character);
    setIsModalOpen(true);
  }, []);

  // モーダルを閉じる
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingCharacter(null);
  }, []);

  // キャラクター追加
  const handleAddCharacter = useCallback((character: Character) => {
    if (!currentProject) return;

    updateProject({
      characters: [...currentProject.characters, character],
    });
  }, [currentProject, updateProject]);

  // キャラクター更新
  const handleUpdateCharacter = useCallback((character: Character) => {
    if (!currentProject) return;

    const updatedCharacters = currentProject.characters.map(c =>
      c.id === character.id ? character : c
    );

    updateProject({ characters: updatedCharacters });
  }, [currentProject, updateProject]);

  // ドラッグ開始
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // ドラッグ中
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex((prevDragOverIndex) => {
      if (draggedIndex !== null && draggedIndex !== index && prevDragOverIndex !== index) {
        return index;
      }
      return prevDragOverIndex;
    });
  }, [draggedIndex]);

  // ドラッグ離脱
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  // ドロップ
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex || !currentProject) {
      setDragOverIndex(null);
      return;
    }

    const characters = [...currentProject.characters];
    const draggedCharacter = characters[draggedIndex];

    // ドラッグされたキャラクターを削除
    characters.splice(draggedIndex, 1);

    // 新しい位置に挿入
    characters.splice(dropIndex, 0, draggedCharacter);

    updateProject({ characters });
    setDraggedIndex(null);
    setDragOverIndex(null);
    showSuccess('キャラクターの並び順を変更しました');
  }, [draggedIndex, currentProject, updateProject, showSuccess]);

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // カードの展開/折りたたみ
  const toggleCardExpansion = useCallback((characterId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(characterId)) {
        newSet.delete(characterId);
      } else {
        newSet.add(characterId);
      }
      return newSet;
    });
  }, []);

  // キャラクター画像を拡大表示
  const handleOpenCharacterImageViewer = useCallback((character: Character) => {
    if (character.image) {
      setImageViewerState({
        isOpen: true,
        imageUrl: character.image,
        characterName: character.name
      });
    }
  }, []);

  const handleDeleteCharacter = useCallback((id: string) => {
    if (!currentProject) return;
    const character = currentProject.characters.find(c => c.id === id);
    if (!character) return;

    setConfirmDialogState({
      isOpen: true,
      type: 'delete',
      characterId: id,
      characterName: character.name,
    });
  }, [currentProject]);

  const handleConfirmDelete = useCallback(() => {
    if (!currentProject || !confirmDialogState.characterId) return;
    updateProject({
      characters: currentProject.characters.filter(c => c.id !== confirmDialogState.characterId),
    });
    showSuccess('キャラクターを削除しました');
    setConfirmDialogState({
      isOpen: false,
      type: null,
      characterId: null,
      characterName: '',
    });
  }, [currentProject, confirmDialogState.characterId, updateProject, showSuccess]);

  const handleRequestAIEnhance = useCallback((character: Character) => {
    setConfirmDialogState({
      isOpen: true,
      type: 'ai-enhance',
      characterId: character.id,
      characterName: character.name,
    });
  }, []);

  const handleAIEnhance = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。ヘッダーのAI設定ボタンから設定してください。');
      setConfirmDialogState({
        isOpen: false,
        type: null,
        characterId: null,
        characterName: '',
      });
      return;
    }

    if (!currentProject || !confirmDialogState.characterId) return;

    const character = currentProject.characters.find(c => c.id === confirmDialogState.characterId);
    if (!character) {
      setConfirmDialogState({
        isOpen: false,
        type: null,
        characterId: null,
        characterName: '',
      });
      return;
    }

    setConfirmDialogState({
      isOpen: false,
      type: null,
      characterId: null,
      characterName: '',
    });

    // クラウドAIかどうかを判定
    const isCloudAI = settings.provider !== 'local';
    const hasImage = !!character.image;

    setEnhancingId(character.id);

    try {
      // プロット情報を取得
      const plotInfo = {
        theme: currentProject.plot?.theme || '',
        setting: currentProject.plot?.setting || '',
        hook: currentProject.plot?.hook || '',
        protagonistGoal: currentProject.plot?.protagonistGoal || '',
        mainObstacle: currentProject.plot?.mainObstacle || '',
      };

      // 画像分析指示を追加（クラウドAIかつ画像がある場合）
      const imageAnalysisInstruction = isCloudAI && hasImage
        ? '\n\n【重要】このキャラクターには画像が設定されています。画像を詳しく分析し、以下の点を確認してください：\n- 外見の特徴（髪色、髪型、目の色、体型、服装など）\n- 表情や雰囲気から読み取れる性格の特徴\n- 背景や設定から推測できる情報\n\n画像の分析結果を、既存の情報と統合して「外見の詳細」に反映してください。'
        : '';

      const speechStyleInfo = character.speechStyle
        ? `口調・話し方: ${character.speechStyle}`
        : '';

      const prompt = aiService.buildPrompt('character', 'enhance', {
        title: currentProject.title || '未設定',
        theme: currentProject.theme || '未設定',
        plotTheme: plotInfo.theme,
        plotSetting: plotInfo.setting,
        plotHook: plotInfo.hook,
        protagonistGoal: plotInfo.protagonistGoal,
        mainObstacle: plotInfo.mainObstacle,
        name: character.name,
        role: character.role,
        appearance: character.appearance || '未設定',
        personality: character.personality || '未設定',
        background: character.background || '未設定',
        speechStyle: speechStyleInfo ? `\n${speechStyleInfo}` : '',
        imageAnalysis: imageAnalysisInstruction,
        synopsis: currentProject?.synopsis || '',
      });

      console.log('AI Request:', {
        provider: settings.provider,
        model: settings.model,
        prompt: prompt.substring(0, 100) + '...',
        hasImage: hasImage,
        isCloudAI: isCloudAI,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      const response = await aiService.generateContent({
        prompt,
        type: 'character',
        settings,
        image: isCloudAI && hasImage ? character.image : undefined,
      });

      console.log('AI Response:', {
        success: !response.error,
        contentLength: response.content?.length || 0,
        error: response.error,
        usage: response.usage,
      });
      // AI応答はコンソールにログ出力のみ（詳細ログはサイドバーのCharacterAssistantPanelで管理）
      console.log('AI Enhance Response logged.');

      if (response.error) {
        showError(`AI生成エラー: ${response.error}\n詳細はAIログを確認してください。`);
        return;
      }

      // AIの回答を解析して既存のキャラクター情報を更新
      const updatedCharacters = currentProject!.characters.map(c => {
        if (c.id === character.id) {
          const content = response.content;
          let updatedAppearance = c.appearance;
          let updatedPersonality = c.personality;
          let updatedBackground = c.background;

          // 【外見の詳細】セクションを抽出
          const appearanceMatch = content.match(/【外見の詳細】\s*([\s\S]*?)(?=【性格の詳細】|$)/);
          if (appearanceMatch) {
            updatedAppearance = appearanceMatch[1].trim();
          }

          // 【性格の詳細】セクションを抽出（簡潔な形式に対応）
          const personalityMatch = content.match(/【性格の詳細】\s*([\s\S]*?)(?=【背景の補完】|$)/);
          if (personalityMatch) {
            updatedPersonality = personalityMatch[1].trim();
          }

          // 【背景の補完】セクションを抽出（簡潔な形式に対応）
          const backgroundMatch = content.match(/【背景の補完】\s*([\s\S]*?)(?=【|$)/);
          if (backgroundMatch) {
            updatedBackground = backgroundMatch[1].trim();
          }

          return {
            ...c,
            appearance: updatedAppearance,
            personality: updatedPersonality,
            background: updatedBackground,
          };
        }
        return c;
      });

      updateProject({ characters: updatedCharacters });

    } catch (_error) {
      showError('AI生成中にエラーが発生しました');
    } finally {
      setEnhancingId(null);
    }
  };

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  // ステップナビゲーション用のハンドラー
  const handlePreviousStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('plot1');
    }
  };

  const handleNextStep = () => {
    if (onNavigateToStep) {
      onNavigateToStep('plot2');
    }
  };

  return (
    <div>
      {/* ステップナビゲーション */}
      <StepNavigation
        currentStep="character"
        onPrevious={handlePreviousStep}
        onNext={handleNextStep}
      />

      {/* AI生成中のローディングインジケーター */}
      {enhancingId && (
        <div className="mb-6">
          <AILoadingIndicator
            message={`${currentProject.characters.find(c => c.id === enhancingId)?.name || 'キャラクター'}の詳細を生成中`}
            estimatedTime={30}
            variant="inline"
          />
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-pink-400 to-rose-500">
                <User className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                キャラクター設計
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-2">
              物語の核となるキャラクターを作成しましょう。AIが背景や関係性を補完します。
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP'] mt-1">
              💡 キャラクターカードをドラッグ&ドロップで並び順を変更できます
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowRelationships(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] shadow-lg"
            >
              <Network className="h-5 w-5" />
              <span>人物相関図</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:scale-105 transition-all duration-200 font-['Noto_Sans_JP'] shadow-lg"
            >
              <Plus className="h-5 w-5" />
              <span>新しいキャラクターを追加</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          {currentProject.characters.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-12">
              <EmptyState
                icon={User}
                iconColor="text-pink-400 dark:text-pink-500"
                title="まだキャラクターがありません"
                description="物語に登場するキャラクターを追加しましょう。主人公、敵役、サブキャラクターなど、物語を彩る多様なキャラクターを設定できます。AI支援機能を使って、キャラクターの詳細を自動生成することも可能です。"
                actionLabel="最初のキャラクターを追加"
                onAction={handleOpenAddModal}
              />
            </div>
          ) : (
            <>
              {currentProject.characters.map((character, index) => {
                const isExpanded = expandedCards.has(character.id);
                const hasDetails = !!(character.appearance || character.personality || character.background);

                return (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    index={index}
                    isExpanded={isExpanded}
                    hasDetails={hasDetails}
                    draggedIndex={draggedIndex}
                    dragOverIndex={dragOverIndex}
                    enhancingId={enhancingId}
                    isConfigured={isConfigured}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onDoubleClick={() => handleOpenEditModal(character)}
                    onToggleExpansion={() => toggleCardExpansion(character.id)}
                    onAIEnhance={() => handleRequestAIEnhance(character)}
                    onEdit={() => handleOpenEditModal(character)}
                    onDelete={() => handleDeleteCharacter(character.id)}
                    onImageClick={() => handleOpenCharacterImageViewer(character)}
                    onPossession={() => setPossessionCharacterId(character.id)}
                    onDiary={() => setDiaryCharacterId(character.id)}
                    onUpdate={handleUpdateCharacter}
                  />
                );
              })}

              {/* Add Character Button */}
              <button
                onClick={handleOpenAddModal}
                className="w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors group"
              >
                <div className="text-center">
                  <Plus className="h-8 w-8 text-gray-400 group-hover:text-indigo-500 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-gray-400 group-hover:text-indigo-500 font-['Noto_Sans_JP']">
                    新しいキャラクターを追加
                  </p>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Character Modal */}
      <CharacterModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddCharacter}
        editingCharacter={editingCharacter}
        onUpdate={handleUpdateCharacter}
      />

      {/* 画像拡大表示モーダル */}
      <ImageViewerModal
        isOpen={imageViewerState.isOpen}
        onClose={() => setImageViewerState({ isOpen: false, imageUrl: '', characterName: '' })}
        imageUrl={imageViewerState.imageUrl}
        characterName={imageViewerState.characterName}
      />

      {/* 人物相関図 */}
      <RelationshipDiagram
        isOpen={showRelationships}
        onClose={() => setShowRelationships(false)}
      />

      {/* キャラクター憑依モード */}
      {possessionCharacterId && (
        <CharacterPossessionChat
          isOpen={!!possessionCharacterId}
          onClose={() => setPossessionCharacterId(null)}
          characterId={possessionCharacterId}
        />
      )}

      {/* キャラクター本音日記 */}
      {diaryCharacterId && (
        <CharacterDiary
          isOpen={!!diaryCharacterId}
          onClose={() => setDiaryCharacterId(null)}
          characterId={diaryCharacterId}
        />
      )}

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        onClose={() => setConfirmDialogState({
          isOpen: false,
          type: null,
          characterId: null,
          characterName: '',
        })}
        onConfirm={() => {
          if (confirmDialogState.type === 'delete') {
            handleConfirmDelete();
          } else if (confirmDialogState.type === 'ai-enhance') {
            handleAIEnhance();
          }
        }}
        title={
          confirmDialogState.type === 'delete'
            ? 'キャラクターを削除しますか？'
            : 'AI支援で詳細を補完しますか？'
        }
        message={
          confirmDialogState.type === 'delete'
            ? `「${confirmDialogState.characterName}」を削除します。\nこの操作は取り消せません。`
            : `「${confirmDialogState.characterName}」の詳細情報をAIで補完します。\n既存の情報が更新される可能性があります。`
        }
        type={confirmDialogState.type === 'delete' ? 'danger' : 'warning'}
        confirmLabel={confirmDialogState.type === 'delete' ? '削除' : '実行'}
        cancelLabel="キャンセル"
      />
    </div>
  );
};