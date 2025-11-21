import React, { useRef, useCallback, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { PenTool, BookOpen, Save, Download, ChevronDown, ChevronUp, ListChecks, Wand2, MoreVertical, Minimize } from 'lucide-react';
import { formatTimestamp } from './utils';

interface Chapter {
  id: string;
  title: string;
  summary?: string;
  characters?: string[];
  setting?: string;
  mood?: string;
  keyEvents?: string[];
}

interface ChapterDetails {
  characters: string;
  setting: string;
  mood: string;
  keyEvents: string;
}

export interface MainEditorHandle {
  getCurrentSelection: () => string;
  getTextareaRef: () => HTMLTextAreaElement | null;
}

interface MainEditorProps {
  selectedChapterId: string | null;
  currentChapter: Chapter | null;
  draft: string;
  chapterDetails: ChapterDetails | null;
  isChapterInfoCollapsed: boolean;
  onChapterInfoToggle: () => void;
  onDraftChange: (value: string) => void;
  mainFontSize: number;
  mainLineHeight: number;
  mainTextareaHeight: number;
  showMainLineNumbers: boolean;
  isMainFocusMode: boolean;
  wordCount: number;
  lastSavedAt: Date | null;
  selectedChapter: string | null;
  onSave: () => void;
  onOpenViewer: () => void;
  onExportChapter: () => void;
  onOpenDisplaySettings: () => void;
  onOpenAIAssist: () => void;
  isVerticalWriting: boolean;
  isZenMode: boolean;
  onExitZenMode: () => void;
}

export const MainEditor = forwardRef<MainEditorHandle, MainEditorProps>(({
  selectedChapterId,
  currentChapter,
  draft,
  chapterDetails,
  isChapterInfoCollapsed,
  onChapterInfoToggle,
  onDraftChange,
  mainFontSize,
  mainLineHeight,
  mainTextareaHeight,
  showMainLineNumbers,
  isMainFocusMode,
  wordCount,
  lastSavedAt,
  selectedChapter,
  onSave,
  onOpenViewer,
  onExportChapter,
  onOpenDisplaySettings,
  onOpenAIAssist,
  isVerticalWriting,
  isZenMode,
  onExitZenMode,
}, ref) => {
  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mainLineNumbersRef = useRef<HTMLDivElement | null>(null);
  const mainLineNumbersInnerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const [localLineNumbers, setLocalLineNumbers] = React.useState<number[]>([1]);

  const mainLineNumbersContent = useMemo(() => localLineNumbers.join('\n'), [localLineNumbers]);
  const mainComputedLineHeight = useMemo(() => Math.max(mainFontSize * mainLineHeight, 12), [mainFontSize, mainLineHeight]);

  const mainEditorContainerClass = isMainFocusMode
    ? 'bg-gray-900/95 border border-emerald-500/30'
    : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600';

  // 行番号の更新
  const updateLineNumbers = useCallback(() => {
    // 縦書きモードでは行番号を計算しない（または非表示にするため不要）
    if (isVerticalWriting) return;

    const textarea = mainTextareaRef.current;
    if (!textarea) {
      setLocalLineNumbers([1]);
      return;
    }

    const computedStyle = window.getComputedStyle(textarea);
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    const contentHeight = Math.max(textarea.scrollHeight - paddingTop - paddingBottom, 0);
    const totalLines = Math.max(1, Math.ceil(contentHeight / mainComputedLineHeight));

    setLocalLineNumbers((prev) => {
      if (prev.length === totalLines) {
        return prev;
      }
      return Array.from({ length: totalLines }, (_, index) => index + 1);
    });
  }, [mainComputedLineHeight, isVerticalWriting]);

  useEffect(() => {
    updateLineNumbers();
  }, [draft, mainComputedLineHeight, mainTextareaHeight, isMainFocusMode, showMainLineNumbers, isVerticalWriting, updateLineNumbers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      updateLineNumbers();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateLineNumbers]);

  // メニューの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMenuOpen]);

  const handleMainTextareaScroll = useCallback(() => {
    if (!mainTextareaRef.current || !mainLineNumbersInnerRef.current) return;

    const textarea = mainTextareaRef.current;
    const innerElement = mainLineNumbersInnerRef.current;

    innerElement.style.transform = `translateY(-${textarea.scrollTop}px)`;
  }, []);

  useEffect(() => {
    if (showMainLineNumbers && !isVerticalWriting) {
      handleMainTextareaScroll();
    }
  }, [showMainLineNumbers, mainTextareaHeight, draft, mainComputedLineHeight, handleMainTextareaScroll, isVerticalWriting]);

  // 親コンポーネントからref経由でアクセスできるメソッドを公開
  useImperativeHandle(ref, () => ({
    getCurrentSelection: () => {
      const textarea = mainTextareaRef.current;
      if (!textarea) return '';
      const { selectionStart, selectionEnd } = textarea;
      if (selectionStart === selectionEnd) return '';
      return textarea.value.slice(selectionStart, selectionEnd);
    },
    getTextareaRef: () => mainTextareaRef.current,
  }), []);

  return (
    <div className={`flex-1 min-w-0 space-y-6 ${isZenMode ? 'z-50' : ''}`}>
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${isZenMode ? 'fixed inset-0 z-50 flex flex-col' : ''}`}
        style={isZenMode ? { borderRadius: 0, border: 'none' } : undefined}
      >
        <div className={`p-6 space-y-6 ${isZenMode ? 'flex-1 flex flex-col overflow-hidden' : ''}`}>
          {!isZenMode && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                {selectedChapterId && currentChapter ? `${currentChapter.title} の草案` : '草案執筆'}
              </h3>
            </div>
          )}

          {/* 章内容表示（禅モード時は非表示） */}
          {!isZenMode && currentChapter && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
              {/* アコーディオンヘッダー */}
              <button
                type="button"
                onClick={onChapterInfoToggle}
                className="w-full p-4 flex items-start space-x-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold text-blue-900 dark:text-blue-100 font-['Noto_Sans_JP'] ${!isChapterInfoCollapsed ? 'mb-2' : ''}`}>
                      {currentChapter.title}
                    </h4>
                    {isChapterInfoCollapsed ? (
                      <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                    )}
                  </div>
                  {!isChapterInfoCollapsed && (
                    <>
                      <p className="text-blue-800 dark:text-blue-200 text-sm font-['Noto_Sans_JP'] leading-relaxed mb-3">
                        {currentChapter.summary}
                      </p>

                      {/* 章詳細情報 */}
                      {chapterDetails && (() => {
                        const hasDetails = Object.values(chapterDetails).some(value => value !== '未設定');

                        if (!hasDetails) return null;

                        return (
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {chapterDetails.characters !== '未設定' && (
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">登場キャラクター:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.characters}</span>
                                </div>
                              )}
                              {chapterDetails.setting !== '未設定' && (
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">設定・場所:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.setting}</span>
                                </div>
                              )}
                              {chapterDetails.mood !== '未設定' && (
                                <div>
                                  <span className="font-medium text-blue-700 dark:text-blue-300">雰囲気:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.mood}</span>
                                </div>
                              )}
                              {chapterDetails.keyEvents !== '未設定' && (
                                <div className="sm:col-span-2">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">重要な出来事:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{chapterDetails.keyEvents}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* メインテキストエリア */}
          <div
            className={`rounded-lg min-h-[300px] border ${isMainFocusMode
                ? 'border-emerald-500/40 bg-gray-900 text-emerald-50'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              } ${isZenMode ? 'flex-1 flex flex-col border-none rounded-none' : ''}`}
            style={isZenMode ? { minHeight: 'auto', backgroundColor: isMainFocusMode ? '#111827' : undefined } : undefined}
          >
            {selectedChapterId ? (
              <div className={`p-4 ${isMainFocusMode ? 'bg-gray-900/80 rounded-b-lg' : ''} ${isZenMode ? 'flex-1 flex flex-col p-0 bg-transparent' : ''}`}>
                <div
                  className={`${mainEditorContainerClass} rounded-lg transition-colors duration-200 ${isZenMode ? 'flex-1 flex flex-col border-none rounded-none' : ''}`}
                  style={isMainFocusMode ? { boxShadow: isZenMode ? 'none' : '0 0 0 1px rgba(16, 185, 129, 0.25)' } : undefined}
                >
                  <div className={`flex ${isZenMode ? 'flex-1' : ''}`}>
                    {showMainLineNumbers && !isVerticalWriting && (
                      <div
                        ref={mainLineNumbersRef}
                        className={`pl-6 pr-3 py-5 md:pl-8 md:pr-4 md:py-6 select-none border-r ${isMainFocusMode
                            ? 'border-emerald-500/40 bg-gray-900/60 text-emerald-200/80'
                            : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500'
                          }`}
                        style={{
                          height: isZenMode ? '100%' : mainTextareaHeight,
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div
                          ref={mainLineNumbersInnerRef}
                          style={{
                            fontFamily: 'monospace',
                            whiteSpace: 'pre',
                            fontSize: mainFontSize,
                            lineHeight: `${mainComputedLineHeight}px`,
                            transform: 'translateY(0)',
                            willChange: 'transform',
                          }}
                        >
                          {mainLineNumbersContent}
                        </div>
                      </div>
                    )}
                    <textarea
                      ref={mainTextareaRef}
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      onScroll={!isVerticalWriting ? handleMainTextareaScroll : undefined}
                      placeholder="ここに草案を執筆してください..."
                      className={`flex-1 px-6 py-5 md:px-8 md:py-6 border-0 bg-transparent focus:outline-none resize-none ${isVerticalWriting ? 'font-serif-jp' : "font-['Noto_Sans_JP']"
                        } ${isMainFocusMode
                          ? 'text-emerald-50 placeholder-emerald-400/50'
                          : 'text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400'
                        } ${isZenMode ? 'h-full' : ''}`}
                      style={{
                        fontSize: mainFontSize,
                        lineHeight: isVerticalWriting ? '2.0' : `${mainComputedLineHeight}px`,
                        height: isZenMode ? '100%' : mainTextareaHeight,
                        writingMode: isVerticalWriting ? 'vertical-rl' : 'horizontal-tb',
                        textOrientation: isVerticalWriting ? 'upright' : 'mixed',
                        letterSpacing: isVerticalWriting ? '0.05em' : 'normal',
                        overflowX: isVerticalWriting ? 'auto' : 'hidden',
                        overflowY: isVerticalWriting ? 'hidden' : 'auto',
                      }}
                      onWheel={(e) => {
                        if (isVerticalWriting) {
                          const container = e.currentTarget;
                          container.scrollLeft -= e.deltaY;
                          // 縦書き時は横スクロールを優先するため、親要素への伝播を止める場合があるが、
                          // ここではブラウザのデフォルト挙動を上書きして横スクロールにする
                          // e.preventDefault() は状況によるが、スムーズスクロールのために必要
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 min-h-[300px] flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <PenTool className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium font-['Noto_Sans_JP'] mb-2">
                    章を選択してください
                  </p>
                  <p className="text-sm font-['Noto_Sans_JP']">
                    上部の章一覧から章を選択すると、ここで草案を執筆できます。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* フッター（禅モード時は簡易表示） */}
        <div className={`border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/30 ${isZenMode ? 'bg-gray-900/90 text-white border-none' : ''}`}>
          <div className="flex flex-col gap-1">
            <div className={`text-sm font-['Noto_Sans_JP'] ${isZenMode ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
              文字数: {wordCount.toLocaleString()}
            </div>
            {!isZenMode && lastSavedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                最終保存: {formatTimestamp(lastSavedAt.getTime())}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 禅モード解除ボタン */}
            {isZenMode && (
              <button
                type="button"
                onClick={onExitZenMode}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-['Noto_Sans_JP'] text-sm"
              >
                <Minimize className="h-4 w-4" />
                <span className="hidden sm:inline">禅モード終了</span>
              </button>
            )}

            {/* プライマリボタン */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={!selectedChapter}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-['Noto_Sans_JP'] text-sm disabled:opacity-50 disabled:cursor-not-allowed ${isZenMode
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">保存</span>
              </button>
              {selectedChapter && !isZenMode && (
                <button
                  type="button"
                  onClick={onOpenViewer}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-sm font-['Noto_Sans_JP'] text-sm"
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">プレビュー</span>
                </button>
              )}
            </div>

            {/* セカンダリボタン（ドロップダウンメニュー） */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex items-center justify-center p-2 rounded-lg border transition-colors ${isZenMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                aria-label="その他の操作"
                aria-expanded={isMenuOpen}
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {/* ドロップダウンメニュー */}
              {isMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 fade-in">
                  {currentChapter && (
                    <button
                      type="button"
                      onClick={() => {
                        onExportChapter();
                        setIsMenuOpen(false);
                      }}
                      disabled={!draft.trim()}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                    >
                      <Download className="h-4 w-4" />
                      章出力
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDisplaySettings();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    <ListChecks className="h-4 w-4" />
                    表示設定
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAIAssist();
                      setIsMenuOpen(false);
                    }}
                    disabled={!selectedChapter}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
                  >
                    <Wand2 className="h-4 w-4" />
                    AIアシスト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
