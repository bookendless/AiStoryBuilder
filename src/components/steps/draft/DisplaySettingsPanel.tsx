import React from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  MODAL_DEFAULT_LINE_HEIGHT,
  MODAL_FONT_SIZE_OPTIONS,
  MODAL_LINE_HEIGHT_OPTIONS,
  MODAL_TEXTAREA_HEIGHT_STEP,
  MODAL_TEXTAREA_MAX_HEIGHT,
  MODAL_TEXTAREA_MIN_HEIGHT,
} from './constants';

interface DisplaySettingsPanelProps {
  mainFontSize: number;
  setMainFontSize: React.Dispatch<React.SetStateAction<number>>;
  mainLineHeight: number;
  setMainLineHeight: React.Dispatch<React.SetStateAction<number>>;
  mainTextareaHeight: number;
  adjustMainTextareaHeight: (delta: number) => void;
  showMainLineNumbers: boolean;
  setShowMainLineNumbers: React.Dispatch<React.SetStateAction<boolean>>;
  isMainFocusMode: boolean;
  setIsMainFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleResetDisplaySettings: () => void;
  mainControlButtonBase: string;
  mainControlButtonActive: string;
}

export const DisplaySettingsPanel: React.FC<DisplaySettingsPanelProps> = ({
  mainFontSize,
  setMainFontSize,
  mainLineHeight,
  setMainLineHeight,
  mainTextareaHeight,
  adjustMainTextareaHeight,
  showMainLineNumbers,
  setShowMainLineNumbers,
  isMainFocusMode,
  setIsMainFocusMode,
  handleResetDisplaySettings,
  mainControlButtonBase,
  mainControlButtonActive,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">表示設定</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              執筆エリアの見た目と操作感を調整します。
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDisplaySettings}
            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-['Noto_Sans_JP'] transition-colors"
          >
            リセット
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 font-['Noto_Sans_JP']">
              フォントサイズ
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {MODAL_FONT_SIZE_OPTIONS.map((size) => (
                <button
                  key={`display-font-${size}`}
                  type="button"
                  onClick={() => setMainFontSize(size)}
                  className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
                    mainFontSize === size ? mainControlButtonActive : ''
                  }`}
                  aria-pressed={mainFontSize === size}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 font-['Noto_Sans_JP']">
              行間
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {MODAL_LINE_HEIGHT_OPTIONS.map((value) => (
                <button
                  key={`display-line-height-${value}`}
                  type="button"
                  onClick={() => setMainLineHeight(value)}
                  className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
                    mainLineHeight === value ? mainControlButtonActive : ''
                  }`}
                  aria-pressed={mainLineHeight === value}
                >
                  {value === MODAL_DEFAULT_LINE_HEIGHT ? '標準' : value.toFixed(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 font-['Noto_Sans_JP']">
                テキストエリアの高さ
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                {Math.round(mainTextareaHeight)}px
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustMainTextareaHeight(-MODAL_TEXTAREA_HEIGHT_STEP)}
                disabled={mainTextareaHeight <= MODAL_TEXTAREA_MIN_HEIGHT}
                className={`${mainControlButtonBase} w-9 h-9 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="テキストエリアの高さを縮小"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">テキストエリアの高さを縮小</span>
              </button>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full relative">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all"
                  style={{
                    width: `${((mainTextareaHeight - MODAL_TEXTAREA_MIN_HEIGHT) / (MODAL_TEXTAREA_MAX_HEIGHT - MODAL_TEXTAREA_MIN_HEIGHT)) * 100}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => adjustMainTextareaHeight(MODAL_TEXTAREA_HEIGHT_STEP)}
                disabled={mainTextareaHeight >= MODAL_TEXTAREA_MAX_HEIGHT}
                className={`${mainControlButtonBase} w-9 h-9 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="テキストエリアの高さを拡大"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">テキストエリアの高さを拡大</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2 pt-3">
          <button
            type="button"
            onClick={() => setShowMainLineNumbers((prev) => !prev)}
            className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
              showMainLineNumbers ? mainControlButtonActive : ''
            }`}
            aria-pressed={showMainLineNumbers}
          >
            行番号 {showMainLineNumbers ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => setIsMainFocusMode((prev) => !prev)}
            className={`${mainControlButtonBase} px-3 py-1.5 text-xs font-['Noto_Sans_JP'] ${
              isMainFocusMode ? mainControlButtonActive : ''
            }`}
            aria-pressed={isMainFocusMode}
          >
            {isMainFocusMode ? '集中モード解除' : '集中モード'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2">表示プリセット</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMainFontSize(16);
              setMainLineHeight(1.6);
              setShowMainLineNumbers(false);
              setIsMainFocusMode(false);
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2 text-left hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors text-xs font-['Noto_Sans_JP'] text-gray-600 dark:text-gray-300"
          >
            標準ビュー
            <br />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">16px / 行間1.6 / 行番号OFF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMainFontSize(18);
              setMainLineHeight(1.8);
              setShowMainLineNumbers(true);
              setIsMainFocusMode(true);
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2 text-left hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors text-xs font-['Noto_Sans_JP'] text-gray-600 dark:text-gray-300"
          >
            集中ビュー
            <br />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">18px / 行間1.8 / 行番号ON</span>
          </button>
        </div>
      </div>
    </div>
  );
};

