import React from 'react';
import { User, Sparkles, Edit3, Trash2, Loader, GripVertical, ZoomIn, ChevronDown, ChevronUp, MessageSquare, BookOpen } from 'lucide-react';
import { Character } from '../../../contexts/ProjectContext';
import { InlineEditor } from '../../common/InlineEditor';

interface CharacterCardProps {
  character: Character;
  index: number;
  isExpanded: boolean;
  hasDetails: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  enhancingId: string | null;
  isConfigured: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDoubleClick: () => void;
  onToggleExpansion: () => void;
  onAIEnhance: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onImageClick: () => void;
  onPossession?: () => void;
  onDiary?: () => void;
  onUpdate?: (character: Character) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = React.memo<CharacterCardProps>(({
  character,
  index,
  isExpanded,
  hasDetails,
  draggedIndex,
  dragOverIndex,
  enhancingId,
  isConfigured,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDoubleClick,
  onToggleExpansion,
  onAIEnhance,
  onEdit,
  onDelete,
  onImageClick,
  onPossession,
  onDiary,
  onUpdate,
}) => {
  return (
    <div
      key={character.id}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onDoubleClick={onDoubleClick}
      className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border transition-all duration-200 ${draggedIndex === index
        ? 'opacity-50 scale-95 shadow-2xl border-indigo-400 dark:border-indigo-500 cursor-grabbing'
        : dragOverIndex === index
          ? 'border-indigo-400 dark:border-indigo-500 border-2 shadow-xl scale-[1.02] bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-100 dark:border-gray-700 cursor-move hover:shadow-xl hover:scale-[1.02]'
        }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-4 sm:gap-0">
        <div className="flex justify-end sm:block order-1 sm:order-2">
          <div className="flex items-center space-x-2">
            {onPossession && (
              <button
                onClick={onPossession}
                className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                title="🎭 キャラクター憑依モード"
                aria-label="キャラクター憑依モード"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            {onDiary && (
              <button
                onClick={onDiary}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="📔 本音日記"
                aria-label="本音日記"
              >
                <BookOpen className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="キャラクターを編集"
              aria-label="キャラクターを編集"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={onAIEnhance}
              disabled={enhancingId === character.id || !isConfigured}
              className="p-2 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors disabled:opacity-50"
              title="AI支援で詳細を補完"
              aria-label="AI支援で詳細を補完"
            >
              {enhancingId === character.id ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="キャラクターを削除"
              aria-label="キャラクターを削除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto order-2 sm:order-1">
          <div className="flex items-center space-x-2">
            <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="w-16 h-24 rounded-lg flex items-center justify-center overflow-hidden relative group shrink-0">
              {character.image ? (
                <div
                  className="relative cursor-pointer w-full h-full"
                  onClick={onImageClick}
                >
                  <img
                    src={character.image}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                    <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-pink-500 to-purple-600 w-full h-full rounded-lg flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              {onUpdate ? (
                <InlineEditor
                  value={character.name}
                  onSave={(value) => onUpdate({ ...character, name: value })}
                  placeholder="キャラクター名"
                  className="text-xl font-bold"
                  maxLength={50}
                  showEditIcon={true}
                />
              ) : (
                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  {character.name}
                </h3>
              )}
            </div>
            <div>
              {onUpdate ? (
                <InlineEditor
                  value={character.role}
                  onSave={(value) => onUpdate({ ...character, role: value })}
                  placeholder="役割・立場"
                  className="text-sm"
                  maxLength={100}
                  showEditIcon={true}
                  multiline={true}
                />
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] break-words whitespace-pre-wrap">
                  {character.role}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 詳細情報の折りたたみ */}
      {hasDetails && (
        <>
          {!isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpansion();
              }}
              className="w-full mt-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center space-x-1 font-['Noto_Sans_JP']"
            >
              <span>詳細を表示</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {isExpanded && (
            <>
              <div className="space-y-3 mt-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">外見</h4>
                  {onUpdate ? (
                    <InlineEditor
                      value={character.appearance || ''}
                      onSave={(value) => onUpdate({ ...character, appearance: value })}
                      placeholder="外見・特徴を入力"
                      multiline={true}
                      rows={2}
                      className="text-gray-700 dark:text-gray-300"
                    />
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      {character.appearance || '未設定'}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">性格</h4>
                  {onUpdate ? (
                    <InlineEditor
                      value={character.personality || ''}
                      onSave={(value) => onUpdate({ ...character, personality: value })}
                      placeholder="性格を入力"
                      multiline={true}
                      rows={2}
                      className="text-gray-700 dark:text-gray-300"
                    />
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      {character.personality || '未設定'}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">背景</h4>
                  {onUpdate ? (
                    <InlineEditor
                      value={character.background || ''}
                      onSave={(value) => onUpdate({ ...character, background: value })}
                      placeholder="背景・過去を入力"
                      multiline={true}
                      rows={2}
                      className="text-gray-700 dark:text-gray-300"
                    />
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      {character.background || '未設定'}
                    </p>
                  )}
                </div>

                {character.speechStyle && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">口調・話し方</h4>
                    {onUpdate ? (
                      <InlineEditor
                        value={character.speechStyle}
                        onSave={(value) => onUpdate({ ...character, speechStyle: value })}
                        placeholder="口調・話し方を入力"
                        multiline={true}
                        rows={2}
                        className="text-gray-700 dark:text-gray-300"
                      />
                    ) : (
                      <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.speechStyle}</p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpansion();
                }}
                className="w-full mt-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center space-x-1 font-['Noto_Sans_JP']"
              >
                <span>詳細を折りたたむ</span>
                <ChevronUp className="h-4 w-4" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数：変更があった場合のみ再レンダリング
  return (
    prevProps.character.id === nextProps.character.id &&
    prevProps.character.name === nextProps.character.name &&
    prevProps.character.role === nextProps.character.role &&
    prevProps.character.appearance === nextProps.character.appearance &&
    prevProps.character.personality === nextProps.character.personality &&
    prevProps.character.background === nextProps.character.background &&
    prevProps.character.speechStyle === nextProps.character.speechStyle &&
    prevProps.character.image === nextProps.character.image &&
    prevProps.index === nextProps.index &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.hasDetails === nextProps.hasDetails &&
    prevProps.draggedIndex === nextProps.draggedIndex &&
    prevProps.dragOverIndex === nextProps.dragOverIndex &&
    prevProps.enhancingId === nextProps.enhancingId &&
    prevProps.isConfigured === nextProps.isConfigured
  );
});

CharacterCard.displayName = 'CharacterCard';


