import React, { useRef, useCallback, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { PenTool, BookOpen, Save, Download, MoreVertical, Minimize } from 'lucide-react';
import { formatTimestamp } from './utils';
// @ts-ignore - markdown-itの型定義が不完全な場合がある
import MarkdownIt from 'markdown-it';
// @ts-ignore - react-markdown-editor-liteの型定義が不完全な場合がある
import MdEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';

interface Chapter {
  id: string;
  title: string;
  summary?: string;
  characters?: string[];
  setting?: string;
  mood?: string;
  keyEvents?: string[];
}

export interface MainEditorHandle {
  getCurrentSelection: () => string;
  getTextareaRef: () => HTMLTextAreaElement | null;
  insertText: (text: string) => void;
}

interface MainEditorProps {
  selectedChapterId: string | null;
  currentChapter: Chapter | null;
  draft: string;
  onDraftChange: (value: string) => void;
  mainFontSize: number;
  mainLineHeight: number;
  mainTextareaHeight: number;
  wordCount: number;
  lastSavedAt: Date | null;
  selectedChapter: string | null;
  onSave: () => void;
  onOpenViewer: () => void;
  onExportChapter: () => void;
  isVerticalWriting: boolean;
  isZenMode: boolean;
  onExitZenMode: () => void;
}

export const MainEditor = forwardRef<MainEditorHandle, MainEditorProps>(({
  selectedChapterId,
  currentChapter,
  draft,
  onDraftChange,
  mainFontSize,
  mainLineHeight,
  mainTextareaHeight,
  wordCount,
  lastSavedAt,
  selectedChapter,
  onSave,
  onOpenViewer,
  onExportChapter,
  isVerticalWriting,
  isZenMode,
  onExitZenMode,
}, ref) => {
  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const mdEditorRef = useRef<any>(null);

  // Markdownパーサーの初期化
  const mdParser = useMemo(() => new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  }), []);

  const mainComputedLineHeight = useMemo(() => Math.max(mainFontSize * mainLineHeight, 12), [mainFontSize, mainLineHeight]);

  // Markdownエディタのフォントサイズと行間を適用
  useEffect(() => {
    if (!isVerticalWriting && mdEditorRef.current) {
      const applyStyles = () => {
        const editor = mdEditorRef.current;
        if (!editor) return;
        
        const textarea = editor.querySelector?.('textarea');
        if (textarea) {
          textarea.style.fontSize = `${mainFontSize}px`;
          textarea.style.lineHeight = `${mainComputedLineHeight}px`;
        }
      };

      // 即座に適用
      applyStyles();

      // 少し遅延して再適用（Markdownエディタの内部レンダリングを待つ）
      const timeoutId = setTimeout(applyStyles, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [mainFontSize, mainComputedLineHeight, isVerticalWriting, draft]);

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

  // Markdownエディタの変更ハンドラ
  const handleMarkdownChange = useCallback(({ text }: { text: string }) => {
    onDraftChange(text);
  }, [onDraftChange]);

  // 親コンポーネントからref経由でアクセスできるメソッドを公開
  useImperativeHandle(ref, () => ({
    getCurrentSelection: () => {
      if (isVerticalWriting) {
        const textarea = mainTextareaRef.current;
        if (!textarea) return '';
        const { selectionStart, selectionEnd } = textarea;
        if (selectionStart === selectionEnd) return '';
        return textarea.value.slice(selectionStart, selectionEnd);
      } else {
        // Markdownエディタの場合
        if (mdEditorRef.current) {
          const editor = mdEditorRef.current;
          const textarea = editor?.querySelector?.('textarea');
          if (textarea) {
            const { selectionStart, selectionEnd } = textarea;
            if (selectionStart === selectionEnd) return '';
            return textarea.value.slice(selectionStart, selectionEnd);
          }
        }
        return '';
      }
    },
    getTextareaRef: () => {
      if (isVerticalWriting) {
        return mainTextareaRef.current;
      } else {
        // Markdownエディタのtextareaを返す
        if (mdEditorRef.current) {
          return mdEditorRef.current?.querySelector?.('textarea') || null;
        }
        return null;
      }
    },
    insertText: (text: string) => {
      let textarea: HTMLTextAreaElement | null = null;
      
      if (isVerticalWriting) {
        textarea = mainTextareaRef.current;
      } else if (mdEditorRef.current) {
        textarea = mdEditorRef.current?.querySelector?.('textarea') || null;
      }
      
      if (!textarea) return;
      
      const { selectionStart, selectionEnd, value } = textarea;
      const newValue = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
      
      // 値を更新
      onDraftChange(newValue);
      
      // カーソル位置を挿入したテキストの後に移動
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const newPosition = selectionStart + text.length;
          textarea.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    },
  }), [isVerticalWriting, onDraftChange]);

  return (
    <div className={`flex-1 min-w-0 space-y-6 ${isZenMode ? 'z-50' : ''}`}>
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${isZenMode ? 'fixed inset-0 z-50 flex flex-col' : ''}`}
        style={isZenMode ? { borderRadius: 0, border: 'none' } : undefined}
      >
        <div className={`p-6 space-y-6 ${isZenMode ? 'flex-1 flex flex-col overflow-hidden' : ''}`}>
          {/* メインテキストエリア */}
          <div
            className={`rounded-lg min-h-[300px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isZenMode ? 'flex-1 flex flex-col border-none rounded-none' : ''}`}
          >
            {selectedChapterId ? (
              <div className={`p-4 ${isZenMode ? 'flex-1 flex flex-col p-0 bg-transparent' : ''}`}>
                <div
                  className={`bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors duration-200 ${isZenMode ? 'flex-1 flex flex-col border-none rounded-none' : ''}`}
                >
                  <div className={`flex ${isZenMode ? 'flex-1' : ''}`}>
                    {isVerticalWriting ? (
                      // 縦書きモード: 従来のtextareaを使用
                      <textarea
                        ref={mainTextareaRef}
                        value={draft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        placeholder="ここに草案を執筆してください..."
                        className={`flex-1 px-6 py-5 md:px-8 md:py-6 border-0 bg-transparent focus:outline-none resize-none font-serif-jp text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${isZenMode ? 'h-full' : ''}`}
                        style={{
                          fontSize: mainFontSize,
                          lineHeight: mainLineHeight,
                          height: isZenMode ? '100%' : mainTextareaHeight,
                          writingMode: 'vertical-rl',
                          textOrientation: 'upright',
                          letterSpacing: '0.05em',
                          overflowX: 'auto',
                          overflowY: 'hidden',
                        }}
                        onWheel={(e) => {
                          const container = e.currentTarget;
                          container.scrollLeft -= e.deltaY;
                        }}
                      />
                    ) : (
                      // 横書きモード: Markdownエディタを使用
                      <div
                        ref={mdEditorRef}
                        className="flex-1"
                        style={{
                          height: isZenMode ? '100%' : mainTextareaHeight,
                          '--editor-font-size': `${mainFontSize}px`,
                          '--editor-line-height': `${mainComputedLineHeight}px`,
                        } as React.CSSProperties}
                      >
                        <MdEditor
                          value={draft}
                          style={{
                            height: isZenMode ? '100%' : mainTextareaHeight,
                          }}
                          renderHTML={(text: string) => mdParser.render(text)}
                          onChange={handleMarkdownChange}
                          placeholder="ここに草案を執筆してください..."
                          config={{
                            view: {
                              menu: true,
                              md: true,
                              html: false, // プレビューは非表示（小説執筆向け）
                            },
                            canView: {
                              menu: true,
                              md: true,
                              html: false,
                              fullScreen: false,
                              hideMenu: false,
                            },
                            // 小説執筆向けにツールバーをカスタマイズ（太字、斜体、見出しのみ）
                            toolbar: ['bold', 'italic', 'heading', '|', 'quote'],
                          }}
                          className="novel-editor"
                        />
                      </div>
                    )}
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
