import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Wand2, Trash2, Save } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { useProject } from '../../../contexts/ProjectContext';
import { useOverlayBackHandler } from '../../../contexts/BackButtonContext';
import { extractStyleSample } from '../../../services/import/classifyStyle';
import { STYLE_SAMPLE_MAX_CHARS } from '../../../constants/writingStyle';

interface StyleSampleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 文体見本（Project.styleSample）の閲覧・編集モーダル
 *
 * AI執筆（続きを書く・章生成・リバイズ）のプロンプトに
 * 「この文章の雰囲気・文体に合わせる」見本として注入される原文抜粋を管理する。
 * アシスタントパネルの「文体設定」セクションから起動する（パネルは幅が狭く
 * 長文の編集に向かないため、編集はこのモーダルに集約する）。
 */
export const StyleSampleModal: React.FC<StyleSampleModalProps> = ({ isOpen, onClose }) => {
    useOverlayBackHandler(isOpen, onClose, 'style-sample-modal', 95);

    const { currentProject, updateProject } = useProject();
    const [text, setText] = useState('');

    // 開いたときに現在の見本を読み込む
    useEffect(() => {
        if (isOpen) setText(currentProject?.styleSample || '');
    }, [isOpen, currentProject?.styleSample]);

    // 抽出元の本文（章ドラフトを章順に連結。無ければプロジェクト直下のドラフト）
    const sourceProse = useMemo(() => {
        if (!currentProject) return '';
        const chapterDrafts = (currentProject.chapters || [])
            .map(c => c.draft?.trim())
            .filter(Boolean)
            .join('\n\n');
        return chapterDrafts || currentProject.draft?.trim() || '';
    }, [currentProject]);

    if (!currentProject) return null;

    const handleExtract = () => {
        const extracted = extractStyleSample(sourceProse);
        if (extracted) setText(extracted);
    };

    const handleSave = () => {
        updateProject({ styleSample: text.trim() || undefined }, true);
        onClose();
    };

    const handleClear = () => {
        setText('');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
                        <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span>文体見本</span>
                </div>
            }
            size="lg"
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    ここに登録した文章は、AI執筆（続きを書く・章全体の生成・リバイズ）の際に
                    「この文章の雰囲気・文体に合わせる」見本としてAIに渡されます。
                    文体設定の選択肢よりも直接的に文体を伝えられるため、作品の最も「らしい」一節を登録するのが効果的です。
                </p>

                <div>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={12}
                        maxLength={STYLE_SAMPLE_MAX_CHARS}
                        placeholder="本文から代表的な一節を貼り付けるか、「本文から抽出」で自動的に取り出せます。空のまま保存すると見本は使用されません。"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] text-sm leading-relaxed"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-right">
                        {text.length.toLocaleString()} / {STYLE_SAMPLE_MAX_CHARS}字
                    </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExtract}
                            disabled={!sourceProse}
                            title={sourceProse ? '章の本文の中間部から代表的な一節を自動抽出します' : '抽出元になる本文（章ドラフト）がありません'}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-['Noto_Sans_JP']"
                        >
                            <Wand2 className="h-4 w-4" />
                            本文から抽出
                        </button>
                        <button
                            onClick={handleClear}
                            disabled={!text}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-['Noto_Sans_JP']"
                        >
                            <Trash2 className="h-4 w-4" />
                            クリア
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline font-['Noto_Sans_JP']"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleSave}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
                        >
                            <Save className="h-4 w-4" />
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
