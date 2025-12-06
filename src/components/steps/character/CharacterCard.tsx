import React from 'react';
import { User, Sparkles, Edit3, Trash2, Loader, GripVertical, ZoomIn, ChevronDown, ChevronUp, MessageSquare, BookOpen } from 'lucide-react';
import { Character } from '../../../contexts/ProjectContext';

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
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
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
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="w-16 h-24 rounded-lg flex items-center justify-center overflow-hidden relative group">
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
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              {character.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              {character.role}
            </p>
          </div>
        </div>

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
                {character.appearance && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">外見</h4>
                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.appearance}</p>
                  </div>
                )}

                {character.personality && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">性格</h4>
                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.personality}</p>
                  </div>
                )}

                {character.background && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">背景</h4>
                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.background}</p>
                  </div>
                )}

                {character.speechStyle && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 font-['Noto_Sans_JP']">口調・話し方</h4>
                    <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{character.speechStyle}</p>
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
};


