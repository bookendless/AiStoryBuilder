import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    FileText, Upload, Sparkles, AlertCircle, ChevronRight, RotateCcw,
    ArrowUp, ArrowDown, X, Plus, Trash2, Wand2,
} from 'lucide-react';
import { Step } from '../../App';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { Chapter, Character, Project } from '../../types/project';
import { ImportSourceFile, ImportResult } from '../../types/import';
import {
    STYLE_OPTIONS,
    PERSPECTIVE_OPTIONS,
    FORMALITY_OPTIONS,
    RHYTHM_OPTIONS,
    METAPHOR_OPTIONS,
    DIALOGUE_OPTIONS,
    EMOTION_OPTIONS,
    TONE_OPTIONS,
    STYLE_SAMPLE_MAX_CHARS,
} from '../../constants/writingStyle';
import { Modal } from '../common/Modal';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { useOverlayBackHandler } from '../../contexts/BackButtonContext';
import { useToast } from '../Toast';
import { getInputCharBudget } from '../../services/summarization/tokenBudget';
import { IMPORT_PROMPT_HARD_CAP, STYLE_MIN_CHARS } from '../../services/import/constants';
import { readTextFileSmart } from '../../utils/textEncoding';
import { useStoryImporter, getImportSnapshot } from './hooks/useStoryImporter';

interface StoryImporterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToStep: (step: Step) => void;
}

const inputClass =
    "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] text-sm";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-['Noto_Sans_JP']";

export const StoryImporterModal: React.FC<StoryImporterModalProps> = ({ isOpen, onClose, onNavigateToStep }) => {
    useOverlayBackHandler(isOpen, onClose, 'story-importer-modal', 90);

    const { createImportedProject } = useProject();
    const { isConfigured, settings } = useAI();
    const { showSuccess } = useToast();

    const importer = useStoryImporter();
    const {
        step, result, progress, isRunning, error,
        setResult, runAnalysis, cancel, reset, restoreSnapshot,
    } = importer;

    const [files, setFiles] = useState<ImportSourceFile[]>([]);
    const [pasteText, setPasteText] = useState('');
    const [title, setTitle] = useState('');
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // 連結済みプローズ（ファイルを order 昇順 → 貼り付けテキストの順に結合）
    const concatenatedProse = useMemo(() => {
        const parts = [...files]
            .sort((a, b) => a.order - b.order)
            .map(f => f.content.trim())
            .filter(Boolean);
        if (pasteText.trim()) parts.push(pasteText.trim());
        return parts.join('\n\n＊＊＊\n\n');
    }, [files, pasteText]);

    // 文字数とおおよそのAI呼び出し回数（実行前の目安。I2）
    const estimate = useMemo(() => {
        const totalChars = concatenatedProse.length;
        if (totalChars === 0) return { totalChars: 0, calls: 0 };
        const budget = getInputCharBudget(settings, IMPORT_PROMPT_HARD_CAP);
        const chunkCount = Math.max(1, Math.ceil(totalChars / budget));
        // 要約map + キャラmap + 集約(複数時) + 概要抽出1 + 文体分類1(本文が十分なとき)
        const aggregate = chunkCount > 1 ? Math.ceil(chunkCount / 2) + 1 : 0;
        const styleCall = totalChars >= STYLE_MIN_CHARS ? 1 : 0;
        const calls = chunkCount + chunkCount + aggregate + 1 + styleCall;
        return { totalChars, calls };
    }, [concatenatedProse, settings]);

    // モーダルを開いたとき: 中断状態があれば再開を確認
    useEffect(() => {
        if (!isOpen) return;
        const snapshot = getImportSnapshot();
        if (snapshot && snapshot.result) {
            setShowResumePrompt(true);
        }
    }, [isOpen]);

    // 確認ステップでデフォルトタイトルを設定（未入力時のみ）
    useEffect(() => {
        if ((step === 'review' || step === 'finalize') && result) {
            setTitle(prev => prev || result.overview.title || '');
        }
    }, [step, result]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (isRunning) cancel();
        onClose();
    };

    const handleResume = () => {
        const snapshot = getImportSnapshot();
        if (snapshot) restoreSnapshot(snapshot);
        setShowResumePrompt(false);
    };

    const handleDiscardResume = () => {
        reset();
        setShowResumePrompt(false);
    };

    const handleAddFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const added: ImportSourceFile[] = [];
        for (const f of Array.from(fileList)) {
            try {
                // File.text() は常に UTF-8 デコードのため、Shift-JIS 等が文字化けする。
                // エンコーディング判定つきで読み込む。
                const content = await readTextFileSmart(f);
                added.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    name: f.name,
                    content,
                    order: 0,
                });
            } catch {
                // 読み込み失敗ファイルはスキップ
            }
        }
        setFiles(prev => [...prev, ...added].map((f, i) => ({ ...f, order: i })));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const moveFile = (index: number, dir: -1 | 1) => {
        setFiles(prev => {
            const sorted = [...prev].sort((a, b) => a.order - b.order);
            const target = index + dir;
            if (target < 0 || target >= sorted.length) return prev;
            [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
            return sorted.map((f, i) => ({ ...f, order: i }));
        });
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i })));
    };

    const handleStartAnalysis = () => {
        if (!concatenatedProse.trim() || !isConfigured) return;
        runAnalysis(concatenatedProse);
    };

    const handleFinalize = () => {
        if (!result) return;
        const finalTitle = title.trim() || result.overview.title.trim() || 'インポート作品';
        const importedChapter: Chapter = {
            id: `import-chapter-${Date.now()}`,
            title: 'インポート本文',
            summary: '取り込んだ原文（章分割は未実施。チャプターステップで分割できます）',
            draft: result.originalProse,
        };
        createImportedProject(finalTitle, {
            mainGenre: result.overview.mainGenre || undefined,
            subGenre: result.overview.subGenre || undefined,
            targetReader: result.overview.targetReader || undefined,
            synopsis: result.overview.synopsis,
            plot: {
                theme: result.overview.plot.theme,
                setting: result.overview.plot.setting,
                hook: result.overview.plot.hook,
                protagonistGoal: result.overview.plot.protagonistGoal,
                mainObstacle: result.overview.plot.mainObstacle,
            },
            characters: result.characters,
            // 全軸が空（推測不能・全消去）の場合は未設定のままにする
            writingStyle: result.writingStyle && Object.values(result.writingStyle).some(v => v?.trim())
                ? result.writingStyle
                : undefined,
            styleSample: result.styleSample?.trim() || undefined,
            draft: result.originalProse,
            chapters: [importedChapter],
        });
        showSuccess('小説を取り込み、新規プロジェクトを作成しました', 4000);
        reset();
        setFiles([]);
        setPasteText('');
        setTitle('');
        onClose();
        onNavigateToStep('character');
    };

    // ---- result 編集ヘルパー ----

    const updateOverview = (patch: Partial<ImportResult['overview']>) => {
        if (!result) return;
        setResult({ ...result, overview: { ...result.overview, ...patch } });
    };
    const updatePlot = (patch: Partial<ImportResult['overview']['plot']>) => {
        if (!result) return;
        setResult({ ...result, overview: { ...result.overview, plot: { ...result.overview.plot, ...patch } } });
    };
    const updateWritingStyle = (patch: Partial<NonNullable<Project['writingStyle']>>) => {
        if (!result) return;
        setResult({ ...result, writingStyle: { ...result.writingStyle, ...patch } });
    };
    const updateCharacter = (index: number, patch: Partial<Character>) => {
        if (!result) return;
        const next = result.characters.map((c, i) => (i === index ? { ...c, ...patch } : c));
        setResult({ ...result, characters: next });
    };
    const removeCharacter = (index: number) => {
        if (!result) return;
        setResult({ ...result, characters: result.characters.filter((_, i) => i !== index) });
    };
    const addCharacter = () => {
        if (!result) return;
        const blank: Character = {
            id: `import-char-${Date.now()}`,
            name: '', role: '', appearance: '', personality: '', background: '',
        };
        setResult({ ...result, characters: [...result.characters, blank] });
    };

    // ---- レンダリング ----

    const renderResumePrompt = () => (
        <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                    中断していたインポート作業があります。続きから再開しますか？
                </p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={handleDiscardResume}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                >
                    破棄して新規
                </button>
                <button
                    onClick={handleResume}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
                >
                    再開する
                </button>
            </div>
        </div>
    );

    const renderInput = () => {
        const sortedFiles = [...files].sort((a, b) => a.order - b.order);
        return (
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    手持ちの小説（断片・未完成作品）を読み込み、AIが分析してキャラクター・プロット・あらすじなどに再構成します。
                    原文はそのまま保存され、書き換えはされません。
                </p>

                {!isConfigured && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                            AIが設定されていません。AI設定でプロバイダーとAPIキーを設定してください。
                        </p>
                    </div>
                )}

                {/* ファイル選択 */}
                <div>
                    <label className={labelClass}>テキストファイル（.txt / .md・複数可）</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,text/plain,text/markdown"
                        multiple
                        onChange={(e) => handleAddFiles(e.target.files)}
                        className="hidden"
                        id="story-import-file-input"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors font-['Noto_Sans_JP'] text-sm"
                    >
                        <Upload className="h-4 w-4" />
                        ファイルを追加
                    </button>
                </div>

                {/* ファイル一覧（並べ替え） */}
                {sortedFiles.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                            読み込み順（上から順に連結されます）
                        </p>
                        {sortedFiles.map((f, i) => (
                            <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate font-['Noto_Sans_JP']">{f.name}</span>
                                <span className="text-xs text-gray-400">{f.content.length.toLocaleString()}字</span>
                                <button onClick={() => moveFile(i, -1)} disabled={i === 0} className="p-1 disabled:opacity-30 hover:text-indigo-600" title="上へ">
                                    <ArrowUp className="h-4 w-4" />
                                </button>
                                <button onClick={() => moveFile(i, 1)} disabled={i === sortedFiles.length - 1} className="p-1 disabled:opacity-30 hover:text-indigo-600" title="下へ">
                                    <ArrowDown className="h-4 w-4" />
                                </button>
                                <button onClick={() => removeFile(f.id)} className="p-1 hover:text-red-600" title="削除">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* 直接貼り付け */}
                <div>
                    <label className={labelClass}>または本文を直接貼り付け</label>
                    <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        rows={5}
                        placeholder="小説本文をここに貼り付けられます。"
                        className={inputClass}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        ファイル取り込みで文字化けする場合や、分析がうまくいかない・エラーになる場合は、本文をここに直接貼り付けると改善することがあります。
                    </p>
                </div>

                {/* 文字数・呼び出し回数の目安 */}
                {estimate.totalChars > 0 && (
                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-xs text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']">
                        合計 {estimate.totalChars.toLocaleString()} 字 / AI呼び出し約 {estimate.calls} 回（目安）。
                        分量が多いほど時間とコストがかかります。
                    </div>
                )}

                {error && (
                    <div className="text-xs font-['Noto_Sans_JP'] space-y-1">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                        <p className="text-gray-500 dark:text-gray-400">
                            解決しない場合は、ファイルではなく本文を直接貼り付けて再試行してください。
                        </p>
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleStartAnalysis}
                        disabled={!concatenatedProse.trim() || !isConfigured}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all font-['Noto_Sans_JP']"
                    >
                        <Sparkles className="h-4 w-4" />
                        解析する
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    };

    const renderAnalyzing = () => (
        <div className="py-6">
            <AILoadingIndicator
                message={progress?.phase || 'AIが分析中...'}
                progress={progress ? { current: progress.current, total: progress.total, status: progress.phase } : undefined}
                variant="inline"
                cancellable
                onCancel={cancel}
            />
        </div>
    );

    // 文体設定の択一ドロップダウン（未設定 = 空文字を許可）
    const renderStyleSelect = (
        label: string,
        key: keyof NonNullable<Project['writingStyle']>,
        options: readonly string[],
    ) => (
        <div>
            <label className={labelClass}>{label}</label>
            <select
                value={result?.writingStyle?.[key] || ''}
                onChange={(e) => updateWritingStyle({ [key]: e.target.value })}
                className={inputClass}
            >
                <option value="">（未設定）</option>
                {options.map(o => (
                    <option key={o} value={o}>{o}</option>
                ))}
            </select>
        </div>
    );

    const renderReview = () => {
        if (!result) return null;
        return (
            <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Wand2 className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                        以下はAIによる推定です。原文に無い創作や取りこぼしが含まれる場合があります。必ず内容を確認・修正してください。内容が本文と大きく食い違う（文字化け・登場人物が一致しない等）場合は、「最初からやり直す」で本文を直接貼り付けてお試しください。
                    </p>
                </div>

                {/* 概要 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>タイトル案</label>
                        <input type="text" value={result.overview.title} onChange={(e) => updateOverview({ title: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>想定読者</label>
                        <input type="text" value={result.overview.targetReader} onChange={(e) => updateOverview({ targetReader: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>主ジャンル</label>
                        <input type="text" value={result.overview.mainGenre} onChange={(e) => updateOverview({ mainGenre: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>サブジャンル</label>
                        <input type="text" value={result.overview.subGenre} onChange={(e) => updateOverview({ subGenre: e.target.value })} className={inputClass} />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>あらすじ</label>
                    <textarea value={result.overview.synopsis} onChange={(e) => updateOverview({ synopsis: e.target.value })} rows={4} className={inputClass} />
                </div>

                {/* プロット基本 */}
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>テーマ</label>
                        <textarea value={result.overview.plot.theme} onChange={(e) => updatePlot({ theme: e.target.value })} rows={2} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>舞台設定</label>
                        <textarea value={result.overview.plot.setting} onChange={(e) => updatePlot({ setting: e.target.value })} rows={2} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>物語の引き（フック）</label>
                        <textarea value={result.overview.plot.hook} onChange={(e) => updatePlot({ hook: e.target.value })} rows={2} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>主人公の目標</label>
                            <textarea value={result.overview.plot.protagonistGoal} onChange={(e) => updatePlot({ protagonistGoal: e.target.value })} rows={2} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>主要な障害</label>
                            <textarea value={result.overview.plot.mainObstacle} onChange={(e) => updatePlot({ mainObstacle: e.target.value })} rows={2} className={inputClass} />
                        </div>
                    </div>
                </div>

                {/* キャラクター */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className={labelClass}>登場人物（{result.characters.length}人）</label>
                        <button onClick={addCharacter} className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-['Noto_Sans_JP']">
                            <Plus className="h-3.5 w-3.5" /> 追加
                        </button>
                    </div>
                    {result.characters.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">人物が抽出されませんでした。必要に応じて追加してください。</p>
                    ) : (
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {result.characters.map((c, i) => (
                                <div key={c.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input type="text" value={c.name} onChange={(e) => updateCharacter(i, { name: e.target.value })} placeholder="名前" className={inputClass + ' flex-1'} />
                                        <input type="text" value={c.role} onChange={(e) => updateCharacter(i, { role: e.target.value })} placeholder="役割" className={inputClass + ' flex-1'} />
                                        <button onClick={() => removeCharacter(i)} className="p-1.5 text-gray-400 hover:text-red-600" title="削除">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <textarea value={c.personality} onChange={(e) => updateCharacter(i, { personality: e.target.value })} placeholder="性格" rows={2} className={inputClass} />
                                    <textarea value={c.background} onChange={(e) => updateCharacter(i, { background: e.target.value })} placeholder="背景" rows={2} className={inputClass} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 文体設定（推測） */}
                <div>
                    <label className={labelClass}>文体設定（原文から推測）</label>
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        原文の文体をAIが分析して自動選択しました。プロジェクト作成後のAI執筆（続きの執筆・リバイズ）が、この設定に沿って原文に近い雰囲気で生成されます。必要に応じて変更してください。
                    </p>
                    {result.styleNote && (
                        <div className="mb-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-xs text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']">
                            <span className="font-medium">文体の特徴: </span>{result.styleNote}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {renderStyleSelect('基本文体', 'style', STYLE_OPTIONS)}
                        {renderStyleSelect('人称', 'perspective', PERSPECTIVE_OPTIONS)}
                        {renderStyleSelect('硬軟', 'formality', FORMALITY_OPTIONS)}
                        {renderStyleSelect('リズム', 'rhythm', RHYTHM_OPTIONS)}
                        {renderStyleSelect('比喩表現', 'metaphor', METAPHOR_OPTIONS)}
                        {renderStyleSelect('会話比率', 'dialogue', DIALOGUE_OPTIONS)}
                        {renderStyleSelect('感情描写', 'emotion', EMOTION_OPTIONS)}
                        {renderStyleSelect('トーン', 'tone', TONE_OPTIONS)}
                    </div>
                    <div className="mt-3">
                        <label className={labelClass}>文体見本（原文からの抜粋）</label>
                        <textarea
                            value={result.styleSample || ''}
                            onChange={(e) => setResult({ ...result, styleSample: e.target.value })}
                            rows={4}
                            maxLength={STYLE_SAMPLE_MAX_CHARS}
                            placeholder="AI執筆時に「この文章の雰囲気に合わせる」見本として使われます。空にすると使用されません。"
                            className={inputClass}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                            原文の中間部から自動抽出した逐語抜粋です（{(result.styleSample || '').length.toLocaleString()} / {STYLE_SAMPLE_MAX_CHARS}字）。最も「らしい」一節に差し替えると再現精度が上がります。
                        </p>
                    </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    原文（{result.originalProse.length.toLocaleString()}字）は「インポート本文」として保存され、ドラフトステップで章に分割できます。
                </div>

                <div className="flex justify-between pt-2">
                    <button onClick={reset} className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:underline font-['Noto_Sans_JP']">
                        最初からやり直す
                    </button>
                    <button
                        onClick={() => importer.setStep('finalize')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all font-['Noto_Sans_JP']"
                    >
                        次へ
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    };

    const renderFinalize = () => (
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                プロジェクトのタイトルを入力して作成します。作成後、キャラクターステップから編集を続けられます。
            </p>
            <div>
                <label className={labelClass}>プロジェクトのタイトル</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </div>
            <div className="flex justify-between pt-2">
                <button onClick={() => importer.setStep('review')} className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:underline font-['Noto_Sans_JP']">
                    戻る
                </button>
                <button
                    onClick={handleFinalize}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all font-['Noto_Sans_JP']"
                >
                    <FileText className="h-4 w-4" />
                    プロジェクトを作成
                </button>
            </div>
        </div>
    );

    const renderBody = () => {
        if (showResumePrompt) return renderResumePrompt();
        switch (step) {
            case 'input': return renderInput();
            case 'analyzing': return renderAnalyzing();
            case 'review': return renderReview();
            case 'finalize': return renderFinalize();
            default: return renderInput();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
                        <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span>小説を取り込む</span>
                </div>
            }
            size="xl"
        >
            {renderBody()}
        </Modal>
    );
};
