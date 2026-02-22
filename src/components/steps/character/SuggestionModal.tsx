import React, { useState } from 'react';
import { UserPlus, Check, AlertCircle } from 'lucide-react';
import { Character } from '../../../types/project/character';
import { Modal } from '../../common/Modal';

export interface SuggestedCharacter extends Character {
    reason?: string;
}

interface SuggestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    suggestions: SuggestedCharacter[];
    onAddCharacters: (characters: Character[]) => void;
}

export const SuggestionModal: React.FC<SuggestionModalProps> = ({
    isOpen,
    onClose,
    suggestions,
    onAddCharacters,
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(suggestions.map(s => s.id)));

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleAdd = () => {
        const charactersToAdd = suggestions.filter(s => selectedIds.has(s.id));
        // reason プロパティを除外して純粋な Character オブジェクトにする
        const cleanCharacters: Character[] = charactersToAdd.map(({ reason, ...char }) => char);
        onAddCharacters(cleanCharacters);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="AI提案キャラクターの確認"
            size="lg"
        >
            <div className="space-y-4 font-['Noto_Sans_JP']">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-bold mb-1">物語を彩る {suggestions.length} 人のキャラクターが提案されました</p>
                        <p>作品に追加したいキャラクターを選択してください。追加後、詳細は自由に編集できます。</p>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                    {suggestions.map((char) => (
                        <div
                            key={char.id}
                            onClick={() => handleToggleSelect(char.id)}
                            className={`
                relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md
                ${selectedIds.has(char.id)
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                }
              `}
                        >
                            {/* Checkbox indicator */}
                            <div className={`
                absolute top-4 right-4 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors
                ${selectedIds.has(char.id)
                                    ? 'bg-indigo-500 border-indigo-500'
                                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                                }
              `}>
                                {selectedIds.has(char.id) && <Check className="h-4 w-4 text-white" />}
                            </div>

                            <div className="pr-10">
                                <div className="flex items-center space-x-2 mb-2">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {char.name}
                                    </h3>
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                        {char.role}
                                    </span>
                                </div>

                                {char.reason && (
                                    <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-800/30">
                                        <p className="text-xs font-bold text-yellow-700 dark:text-yellow-500 mb-1">
                                            💡 提案理由
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {char.reason}
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">性格</span>
                                        <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{char.personality}</p>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">外見</span>
                                        <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{char.appearance}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">背景</span>
                                        <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{char.background}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex space-x-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={selectedIds.size === 0}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2"
                    >
                        <UserPlus className="h-4 w-4" />
                        <span>選択した {selectedIds.size} 人を追加</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};
