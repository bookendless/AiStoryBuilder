import React, { useState } from 'react';
import { Check, Sparkles, AlertCircle } from 'lucide-react';
import { Modal } from '../../common/Modal';

export type EnhanceField = 'appearance' | 'personality' | 'background' | 'speechStyle';

export interface EnhanceProposal {
    field: EnhanceField;
    label: string;
    currentValue: string;
    proposedValue: string;
}

interface EnhanceReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    characterName: string;
    proposals: EnhanceProposal[];
    onApply: (fields: EnhanceField[]) => void;
}

export const EnhanceReviewModal: React.FC<EnhanceReviewModalProps> = ({
    isOpen,
    onClose,
    characterName,
    proposals,
    onApply,
}) => {
    const [selectedFields, setSelectedFields] = useState<Set<EnhanceField>>(
        new Set(proposals.map(p => p.field))
    );

    const handleToggleSelect = (field: EnhanceField) => {
        const newSelected = new Set(selectedFields);
        if (newSelected.has(field)) {
            newSelected.delete(field);
        } else {
            newSelected.add(field);
        }
        setSelectedFields(newSelected);
    };

    const handleApply = () => {
        onApply(proposals.filter(p => selectedFields.has(p.field)).map(p => p.field));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="AI補完内容の確認"
            size="lg"
        >
            <div className="space-y-4 font-['Noto_Sans_JP']">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-bold mb-1">「{characterName}」の詳細補完案が生成されました</p>
                        <p>採用する項目を選択してください。チェックを外した項目は現在の内容が維持されます。</p>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                    {proposals.map((proposal) => (
                        <div
                            key={proposal.field}
                            onClick={() => handleToggleSelect(proposal.field)}
                            className={`
                relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md
                ${selectedFields.has(proposal.field)
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                }
              `}
                        >
                            {/* チェックインジケータ */}
                            <div className={`
                absolute top-4 right-4 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors
                ${selectedFields.has(proposal.field)
                                    ? 'bg-indigo-500 border-indigo-500'
                                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                                }
              `}>
                                {selectedFields.has(proposal.field) && <Check className="h-4 w-4 text-white" />}
                            </div>

                            <div className="pr-10 space-y-2">
                                <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                                    {proposal.label}
                                </span>

                                <div>
                                    <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">現在</span>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap max-h-24 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900/40 rounded border border-gray-100 dark:border-gray-700">
                                        {proposal.currentValue || '（未設定）'}
                                    </p>
                                </div>

                                <div>
                                    <span className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-0.5">提案</span>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap max-h-40 overflow-y-auto p-2 bg-indigo-50/70 dark:bg-indigo-900/30 rounded border border-indigo-100 dark:border-indigo-800">
                                        {proposal.proposedValue}
                                    </p>
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
                        onClick={handleApply}
                        disabled={selectedFields.size === 0}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2"
                    >
                        <Sparkles className="h-4 w-4" />
                        <span>選択した {selectedFields.size} 項目を採用</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};
