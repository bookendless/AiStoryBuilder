import React from 'react';
import { Modal } from '../../common/Modal';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { Character } from '../../../contexts/ProjectContext';

interface ReorderModalProps {
    isOpen: boolean;
    onClose: () => void;
    characters: Character[];
    onReorder: (fromIndex: number, toIndex: number) => void;
}

export const ReorderModal: React.FC<ReorderModalProps> = ({
    isOpen,
    onClose,
    characters,
    onReorder,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="キャラクターの並べ替え"
            size="md"
        >
            <div className="space-y-2 p-1">
                {characters.map((character, index) => (
                    <div
                        key={character.id}
                        className="flex items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
                    >
                        <div className="flex-shrink-0 mr-3 text-gray-400">
                            <GripVertical className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 mr-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate font-['Noto_Sans_JP']">
                                {character.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-['Noto_Sans_JP']">
                                {character.role}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onReorder(index, index - 1)}
                                disabled={index === 0}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 dark:border-gray-600"
                                aria-label="上に移動"
                            >
                                <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => onReorder(index, index + 1)}
                                disabled={index === characters.length - 1}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 dark:border-gray-600"
                                aria-label="下に移動"
                            >
                                <ArrowDown className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
                {characters.length === 0 && (
                    <div className="text-center py-8 text-gray-500 font-['Noto_Sans_JP']">
                        キャラクターがいません
                    </div>
                )}
            </div>
            <div className="mt-6 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
                >
                    完了
                </button>
            </div>
        </Modal>
    );
};
