import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Scissors, Loader2, Check, Plus, Trash2, Sparkles, RefreshCw, Search } from 'lucide-react';
import { Chapter } from '../../../contexts/ProjectContext';
import { useAI } from '../../../contexts/AIContext';
import { useToast } from '../../Toast';
import { useOverlayBackHandler } from '../../../contexts/BackButtonContext';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { normalizeLineEndings } from '../../../utils/textEncoding';
import { detectHeadings } from '../../../services/chapterSplit/detectHeadings';
import {
    SplitBoundary,
    buildDefaultBoundaries,
    sliceByBoundaries,
    validateBoundaries,
    PREAMBLE_TITLE,
} from '../../../services/chapterSplit/splitDraft';
import { suggestBoundariesAI } from '../../../services/chapterSplit/suggestBoundariesAI';
import { createImportRunner } from '../../../services/import/createImportRunner';

interface ChapterDraftSplitModalProps {
    isOpen: boolean;
    chapter: Chapter;
    chapterIndex: number;
    onClose: () => void;
    onApply: (newChapters: Chapter[]) => void;
}

/** 行検索ピッカーの最大表示件数（巨大ドラフトでも全文をDOMに描画しない） */
const MAX_PICKER_HITS = 50;
/** 章カードの本文プレビュー行数 */
const PREVIEW_LINES = 3;

/**
 * 章ドラフト本文を複数章に分割する対話ツール。
 *
 * - 見出しの決定的検出（AI不要）で初期境界を提示
 * - ユーザーが行検索ピッカーで境界を追加、カードから削除・タイトル編集
 * - AI提案は任意ボタン（ロケータ方式・適用までは保存されない）
 * - 章は char オフセットの連続スライス＝逐語（合計文字数を常時表示して可視化）
 */
export const ChapterDraftSplitModal: React.FC<ChapterDraftSplitModalProps> = ({
    isOpen,
    chapter,
    chapterIndex,
    onClose,
    onApply,
}) => {
    const { settings, isConfigured } = useAI();
    const { showError, showSuccess } = useToast();

    // 旧バージョンで保存された CR 改行ドラフトへの防御として、ここでも正規化する
    const text = useMemo(() => normalizeLineEndings(chapter.draft || ''), [chapter.draft]);

    const lines = useMemo(() => text.split('\n'), [text]);
    const lineOffsets = useMemo(() => {
        const offsets: number[] = new Array(lines.length);
        let acc = 0;
        for (let i = 0; i < lines.length; i++) {
            offsets[i] = acc;
            acc += lines[i].length + 1;
        }
        return offsets;
    }, [lines]);

    const [boundaries, setBoundaries] = useState<SplitBoundary[]>([]);
    const [includeSceneBreaks, setIncludeSceneBreaks] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    // Android戻るボタン対応
    useOverlayBackHandler(isOpen, onClose, 'chapter-draft-split-modal', 96);

    const detectAndSetBoundaries = useCallback((withSceneBreaks: boolean) => {
        const headings = detectHeadings(text, { includeSceneBreaks: withSceneBreaks });
        const defaults = buildDefaultBoundaries(text, headings);
        // 見出しが無い場合はタイトルが空で返るため、元の章タイトルを引き継ぐ
        if (defaults.length === 1 && !defaults[0].title) {
            defaults[0] = { ...defaults[0], title: chapter.title };
        }
        setBoundaries(defaults);
    }, [text, chapter.title]);

    // モーダルを開くたびに初期検出をやり直す
    useEffect(() => {
        if (isOpen) {
            setIncludeSceneBreaks(false);
            setPickerOpen(false);
            setPickerQuery('');
            detectAndSetBoundaries(false);
        }
        return () => abortRef.current?.abort();
    }, [isOpen, detectAndSetBoundaries]);

    const slices = useMemo(() => sliceByBoundaries(text, boundaries), [text, boundaries]);
    const errors = useMemo(() => validateBoundaries(text, boundaries), [text, boundaries]);
    const totalChars = useMemo(() => slices.reduce((sum, s) => sum + s.draft.length, 0), [slices]);

    // 行検索ピッカーのヒット（既存境界の行は除外）
    const pickerHits = useMemo(() => {
        if (!pickerOpen) return [];
        const query = pickerQuery.trim();
        const used = new Set(boundaries.map(b => b.offset));
        const hits: Array<{ lineIndex: number; offset: number; line: string }> = [];
        for (let i = 0; i < lines.length && hits.length < MAX_PICKER_HITS; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            if (used.has(lineOffsets[i])) continue;
            if (query && !line.includes(query)) continue;
            hits.push({ lineIndex: i, offset: lineOffsets[i], line });
        }
        return hits;
    }, [pickerOpen, pickerQuery, lines, lineOffsets, boundaries]);

    const handleToggleSceneBreaks = () => {
        const next = !includeSceneBreaks;
        setIncludeSceneBreaks(next);
        // 再検出は手動調整を破棄する（トグルの説明文で明示）
        detectAndSetBoundaries(next);
    };

    const handleAddBoundary = (offset: number, line: string) => {
        const heading = detectHeadings(line)[0];
        const title = heading ? heading.title : line.trim().slice(0, 20);
        setBoundaries(prev =>
            [...prev, { offset, title }].sort((a, b) => a.offset - b.offset)
        );
        setPickerOpen(false);
        setPickerQuery('');
    };

    const handleRemoveBoundary = (index: number) => {
        // 先頭境界（offset 0）は削除不可＝前章への統合は2番目以降のみ
        if (index === 0) return;
        setBoundaries(prev => prev.filter((_, i) => i !== index));
    };

    const handleTitleChange = (index: number, title: string) => {
        setBoundaries(prev => prev.map((b, i) => (i === index ? { ...b, title } : b)));
    };

    const handleSuggestAI = async () => {
        if (isSuggesting) return;
        if (!isConfigured) {
            showError('AI設定が必要です。設定画面でプロバイダーとAPIキーを設定してください。');
            return;
        }

        setIsSuggesting(true);
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const run = createImportRunner(settings, controller.signal);
            const { boundaries: suggested, skipped } = await suggestBoundariesAI(text, {
                settings,
                run,
                signal: controller.signal,
            });

            if (suggested.length === 0) {
                showError('AIは章の区切りを見つけられませんでした。行検索から手動で追加してください。');
                return;
            }

            // 既存境界とマージ（同一オフセットは既存を優先）し、先頭章を必ず確保する
            setBoundaries(prev => {
                const merged = [...prev];
                const used = new Set(prev.map(b => b.offset));
                for (const s of suggested) {
                    if (!used.has(s.offset)) {
                        merged.push(s);
                        used.add(s.offset);
                    }
                }
                merged.sort((a, b) => a.offset - b.offset);
                if (merged.length === 0 || merged[0].offset !== 0) {
                    merged.unshift({ offset: 0, title: PREAMBLE_TITLE });
                }
                return merged;
            });

            showSuccess(
                skipped > 0
                    ? `AIが${suggested.length}件の分割位置を提案しました（${skipped}件は本文中に見つからずスキップ）`
                    : `AIが${suggested.length}件の分割位置を提案しました`
            );
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            const message = error instanceof Error ? error.message : 'AI提案の取得に失敗しました';
            showError(message);
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleApply = () => {
        if (errors.length > 0 || boundaries.length < 2) return;
        const stamp = Date.now();
        const newChapters: Chapter[] = slices.map((slice, i) => ({
            id: `${chapter.id}-dsplit-${i}-${stamp}`,
            title: slice.title.trim() || `${chapter.title}（${i + 1}）`,
            summary: '',
            draft: slice.draft,
            foreshadowingRefs: chapter.foreshadowingRefs,
        }));
        onApply(newChapters);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="glass-strong glass-shimmer rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* ヘッダー */}
                <div className="p-6 border-b border-white/20 dark:border-white/10 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-gradient-to-br from-blue-500 to-teal-600 p-2 rounded-lg">
                                <Scissors className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                    本文を章に分割
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                    第{chapterIndex + 1}章: {chapter.title}（{text.length.toLocaleString()} 文字）
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* 操作バー */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => detectAndSetBoundaries(includeSceneBreaks)}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-white/40 dark:bg-gray-800/40 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/60 transition-colors text-sm font-['Noto_Sans_JP']"
                            title="見出し（第○章・○話・プロローグ等）を再検出します。手動の調整はリセットされます"
                        >
                            <RefreshCw className="h-4 w-4" />
                            <span>見出しを再検出</span>
                        </button>
                        <button
                            onClick={handleSuggestAI}
                            disabled={isSuggesting}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                            title="AIに章の区切り位置を提案させます（適用するまで保存されません）"
                        >
                            {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            <span>{isSuggesting ? 'AI提案中...' : 'AIに分割位置を提案させる'}</span>
                        </button>
                        <label
                            className="flex items-center space-x-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer font-['Noto_Sans_JP']"
                            title="切り替えると分割位置を再検出します（手動の調整はリセットされます）"
                        >
                            <input
                                type="checkbox"
                                checked={includeSceneBreaks}
                                onChange={handleToggleSceneBreaks}
                                className="h-4 w-4 text-indigo-600 rounded"
                            />
                            <span>区切り記号（◇◆◇・*** など）も候補に含める</span>
                        </label>
                    </div>
                </div>

                {/* コンテンツ: 章カード一覧 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {slices.map((slice, i) => {
                        const previewLines = slice.draft
                            .split('\n')
                            .filter(l => l.trim())
                            .slice(0, PREVIEW_LINES);
                        return (
                            <div
                                key={`${boundaries[i]?.offset}-${i}`}
                                className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <span className="text-white font-bold text-sm">{i + 1}</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={boundaries[i]?.title ?? ''}
                                        onChange={(e) => handleTitleChange(i, e.target.value)}
                                        placeholder="章タイトル"
                                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                                    />
                                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-['Noto_Sans_JP']">
                                        {slice.draft.length.toLocaleString()} 字
                                    </span>
                                    {i > 0 && (
                                        <button
                                            onClick={() => handleRemoveBoundary(i)}
                                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="この分割を解除（前の章に統合）"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-2 ml-11 text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] space-y-0.5">
                                    {previewLines.map((line, li) => (
                                        <p key={li} className="truncate">{line}</p>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* 分割位置の追加（行検索ピッカー） */}
                    {!pickerOpen ? (
                        <button
                            onClick={() => setPickerOpen(true)}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-['Noto_Sans_JP']"
                        >
                            <Plus className="h-4 w-4" />
                            <span>分割位置を追加（本文の行から選択）</span>
                        </button>
                    ) : (
                        <div className="border border-indigo-300 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/50 dark:bg-indigo-900/10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        autoFocus
                                        value={pickerQuery}
                                        onChange={(e) => setPickerQuery(e.target.value)}
                                        placeholder="章の開始行を本文から検索（例: 見出しや書き出しの一部）"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setPickerOpen(false);
                                        setPickerQuery('');
                                    }}
                                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {pickerHits.length === 0 ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 py-2 text-center font-['Noto_Sans_JP']">
                                        一致する行がありません
                                    </p>
                                ) : (
                                    pickerHits.map(hit => (
                                        <button
                                            key={hit.lineIndex}
                                            onClick={() => handleAddBoundary(hit.offset, hit.line)}
                                            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                                        >
                                            <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">{hit.lineIndex + 1}行</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                                {hit.line.trim().slice(0, 60)}
                                            </span>
                                        </button>
                                    ))
                                )}
                                {pickerHits.length >= MAX_PICKER_HITS && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 py-1 text-center font-['Noto_Sans_JP']">
                                        表示は{MAX_PICKER_HITS}件まで。検索語で絞り込んでください
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="p-6 border-t border-white/20 dark:border-white/10 shrink-0">
                    {errors.length > 0 && (
                        <div className="mb-3 text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                            {errors.map((e, i) => <p key={i}>{e}</p>)}
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                            合計 {totalChars.toLocaleString()} 字 / 原文 {text.length.toLocaleString()} 字（逐語分割）
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/20 transition-colors font-['Noto_Sans_JP']"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={() => setShowApplyConfirm(true)}
                                disabled={errors.length > 0 || boundaries.length < 2}
                                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-600 text-white rounded-lg hover:from-blue-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-['Noto_Sans_JP']"
                            >
                                <Check className="h-5 w-5" />
                                <span>分割を適用（{boundaries.length}章）</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 適用確認 */}
            <ConfirmDialog
                isOpen={showApplyConfirm}
                onClose={() => setShowApplyConfirm(false)}
                onConfirm={handleApply}
                title="章の分割を適用"
                message={`この章を ${boundaries.length} 個の章に置き換えます。本文は一字一句そのまま各章に引き継がれ、適用前の状態は章の変更履歴から確認できます。`}
                type="warning"
                confirmLabel="適用する"
            />
        </div>
    );
};
