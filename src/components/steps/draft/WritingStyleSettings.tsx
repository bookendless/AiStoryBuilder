import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import {
    STYLE_OPTIONS,
    PERSPECTIVE_OPTIONS,
    FORMALITY_OPTIONS,
    RHYTHM_OPTIONS,
    METAPHOR_OPTIONS,
    DIALOGUE_OPTIONS,
    EMOTION_OPTIONS,
    TONE_OPTIONS,
} from '../../../constants/writingStyle';

export const WritingStyleSettings: React.FC = () => {
    const { currentProject, updateProject } = useProject();

    // ローカルステートでフォームの値を管理
    const [styleData, setStyleData] = useState({
        style: '',
        perspective: '',
        formality: '',
        rhythm: '',
        metaphor: '',
        dialogue: '',
        emotion: '',
        tone: '',
        customStyle: '',
        customPerspective: '',
        customFormality: '',
        customRhythm: '',
        customMetaphor: '',
        customDialogue: '',
        customEmotion: '',
        customTone: '',
    });

    // 選択肢とカスタム値の解決ロジック
    const resolveSelection = useCallback((
        value: string | undefined,
        options: readonly string[],
        customValue?: string
    ) => {
        const actualValue = customValue || value || '';
        if (!actualValue) {
            return { selected: '', custom: '' };
        }
        if (options.includes(actualValue)) {
            return { selected: actualValue, custom: '' };
        }
        return { selected: 'その他', custom: actualValue };
    }, []);

    // プロジェクトデータから初期値を設定
    useEffect(() => {
        if (!currentProject) return;

        const ws = currentProject.writingStyle || {};

        const style = resolveSelection(ws.style, STYLE_OPTIONS, ws.customStyle);
        const perspective = resolveSelection(ws.perspective, PERSPECTIVE_OPTIONS, ws.customPerspective);
        const formality = resolveSelection(ws.formality, FORMALITY_OPTIONS, ws.customFormality);
        const rhythm = resolveSelection(ws.rhythm, RHYTHM_OPTIONS, ws.customRhythm);
        const metaphor = resolveSelection(ws.metaphor, METAPHOR_OPTIONS, ws.customMetaphor);
        const dialogue = resolveSelection(ws.dialogue, DIALOGUE_OPTIONS, ws.customDialogue);
        const emotion = resolveSelection(ws.emotion, EMOTION_OPTIONS, ws.customEmotion);
        const tone = resolveSelection(ws.tone, TONE_OPTIONS, ws.customTone);

        setStyleData({
            style: style.selected,
            perspective: perspective.selected,
            formality: formality.selected,
            rhythm: rhythm.selected,
            metaphor: metaphor.selected,
            dialogue: dialogue.selected,
            emotion: emotion.selected,
            tone: tone.selected,
            customStyle: style.custom,
            customPerspective: perspective.custom,
            customFormality: formality.custom,
            customRhythm: rhythm.custom,
            customMetaphor: metaphor.custom,
            customDialogue: dialogue.custom,
            customEmotion: emotion.custom,
            customTone: tone.custom,
        });
    }, [currentProject?.id, resolveSelection]); // eslint-disable-line react-hooks/exhaustive-deps

    // 設定を保存する関数
    const saveSettings = useCallback((newStyleData: typeof styleData) => {
        if (!currentProject) return;

        const computeStyleValue = (selected: string, custom: string) => {
            if (!selected) return undefined;
            if (selected === 'その他') {
                return custom.trim() || undefined;
            }
            return selected;
        };

        const writingStyle = {
            style: computeStyleValue(newStyleData.style, newStyleData.customStyle),
            perspective: computeStyleValue(newStyleData.perspective, newStyleData.customPerspective),
            formality: computeStyleValue(newStyleData.formality, newStyleData.customFormality),
            rhythm: computeStyleValue(newStyleData.rhythm, newStyleData.customRhythm),
            metaphor: computeStyleValue(newStyleData.metaphor, newStyleData.customMetaphor),
            dialogue: computeStyleValue(newStyleData.dialogue, newStyleData.customDialogue),
            emotion: computeStyleValue(newStyleData.emotion, newStyleData.customEmotion),
            tone: computeStyleValue(newStyleData.tone, newStyleData.customTone),
            customStyle: newStyleData.style === 'その他' ? newStyleData.customStyle.trim() : undefined,
            customPerspective: newStyleData.perspective === 'その他' ? newStyleData.customPerspective.trim() : undefined,
            customFormality: newStyleData.formality === 'その他' ? newStyleData.customFormality.trim() : undefined,
            customRhythm: newStyleData.rhythm === 'その他' ? newStyleData.customRhythm.trim() : undefined,
            customMetaphor: newStyleData.metaphor === 'その他' ? newStyleData.customMetaphor.trim() : undefined,
            customDialogue: newStyleData.dialogue === 'その他' ? newStyleData.customDialogue.trim() : undefined,
            customEmotion: newStyleData.emotion === 'その他' ? newStyleData.customEmotion.trim() : undefined,
            customTone: newStyleData.tone === 'その他' ? newStyleData.customTone.trim() : undefined,
        };

        // すべての値が undefined の場合は writingStyle 自体を undefined にするかも検討したが、
        // 既存の設定を消す柔軟性を持たせるため、空オブジェクトでも更新する
        updateProject({ writingStyle }, false); // false = デバウンス有効
    }, [currentProject, updateProject]);

    // セレクトボックス変更ハンドラ（即保存）
    const handleSelectChange = (key: keyof typeof styleData, value: string) => {
        const newData = { ...styleData, [key]: value };
        // 「その他」から別の選択肢に変えた場合、対応するカスタム値はクリアしない（UX向上のため残しても良いが、今回は残す）
        setStyleData(newData);
        saveSettings(newData);
    };

    // テキスト入力変更ハンドラ（保存しない）
    const handleTextChange = (key: keyof typeof styleData, value: string) => {
        setStyleData(prev => ({ ...prev, [key]: value }));
    };

    // テキスト入力ブラーハンドラ（ここで保存）
    const handleTextBlur = () => {
        saveSettings(styleData);
    };

    if (!currentProject) return null;

    return (
        <div className="space-y-4 p-1">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs mb-4">
                <p className="text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">
                    ここでの設定変更はプロジェクト全体に反映されます。
                </p>
            </div>

            {/* 基本文体 */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    基本文体
                </label>
                <select
                    value={styleData.style}
                    onChange={(e) => handleSelectChange('style', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">デフォルト（現代小説風）</option>
                    {STYLE_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                {styleData.style === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customStyle}
                        onChange={(e) => handleTextChange('customStyle', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタム基本文体"
                    />
                )}
            </div>

            {/* 人称 */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    人称
                </label>
                <select
                    value={styleData.perspective}
                    onChange={(e) => handleSelectChange('perspective', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">指定なし</option>
                    {PERSPECTIVE_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="その他">その他</option>
                </select>
                {styleData.perspective === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customPerspective}
                        onChange={(e) => handleTextChange('customPerspective', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタム人称"
                    />
                )}
            </div>

            {/* 硬軟 */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    硬軟
                </label>
                <select
                    value={styleData.formality}
                    onChange={(e) => handleSelectChange('formality', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">指定なし</option>
                    {FORMALITY_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="その他">その他</option>
                </select>
                {styleData.formality === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customFormality}
                        onChange={(e) => handleTextChange('customFormality', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタム硬軟"
                    />
                )}
            </div>

            {/* リズム */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    リズム
                </label>
                <select
                    value={styleData.rhythm}
                    onChange={(e) => handleSelectChange('rhythm', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">指定なし</option>
                    {RHYTHM_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="その他">その他</option>
                </select>
                {styleData.rhythm === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customRhythm}
                        onChange={(e) => handleTextChange('customRhythm', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタムリズム"
                    />
                )}
            </div>

            {/* 比喩表現 */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    比喩表現
                </label>
                <select
                    value={styleData.metaphor}
                    onChange={(e) => handleSelectChange('metaphor', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">指定なし</option>
                    {METAPHOR_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="その他">その他</option>
                </select>
                {styleData.metaphor === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customMetaphor}
                        onChange={(e) => handleTextChange('customMetaphor', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタム比喩表現"
                    />
                )}
            </div>

            {/* 会話比率 */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    会話比率
                </label>
                <select
                    value={styleData.dialogue}
                    onChange={(e) => handleSelectChange('dialogue', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">指定なし</option>
                    {DIALOGUE_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="その他">その他</option>
                </select>
                {styleData.dialogue === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customDialogue}
                        onChange={(e) => handleTextChange('customDialogue', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタム会話比率"
                    />
                )}
            </div>

            {/* 感情描写 */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    感情描写
                </label>
                <select
                    value={styleData.emotion}
                    onChange={(e) => handleSelectChange('emotion', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">指定なし</option>
                    {EMOTION_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="その他">その他</option>
                </select>
                {styleData.emotion === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customEmotion}
                        onChange={(e) => handleTextChange('customEmotion', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタム感情描写"
                    />
                )}
            </div>

            {/* トーン */}
            <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    トーン
                </label>
                <select
                    value={styleData.tone}
                    onChange={(e) => handleSelectChange('tone', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                >
                    <option value="">指定なし</option>
                    {TONE_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="その他">その他</option>
                </select>
                {styleData.tone === 'その他' && (
                    <input
                        type="text"
                        value={styleData.customTone}
                        onChange={(e) => handleTextChange('customTone', e.target.value)}
                        onBlur={handleTextBlur}
                        className="w-full px-2 py-1.5 mt-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-['Noto_Sans_JP']"
                        placeholder="詳細を入力"
                        title="カスタムトーン"
                    />
                )}
            </div>
        </div>
    );
};
