import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronRight, FileSearch } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { searchProject, SearchResult, getSearchResultTypeLabel } from '../utils/searchUtils';
import { Step } from '../App';
import { EmptyState } from './common/EmptyState';

interface SearchBarProps {
  onNavigate?: (step: Step, chapterId?: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onNavigate }) => {
  const { currentProject } = useProject();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 検索実行
  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchProject(currentProject, query);
      setResults(searchResults);
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, currentProject]);

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onNavigate && result.step) {
      onNavigate(result.step as Step, result.chapterId);
    }
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // ハイライト表示用の関数
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-ai-200 dark:bg-ai-800 text-ai-900 dark:text-ai-100 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={searchRef} className="relative flex-1 max-w-2xl">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-sumi-400 dark:text-usuzumi-500" aria-hidden="true" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder="プロジェクト全体を検索..."
          className="block w-full pl-10 pr-10 py-2 border border-usuzumi-300 dark:border-usuzumi-600 rounded-lg bg-unohana-50 dark:bg-sumi-800 text-sumi-900 dark:text-usuzumi-50 placeholder-sumi-400 dark:placeholder-usuzumi-500 focus:outline-none focus:ring-2 focus:ring-ai-500 focus:border-transparent font-['Noto_Sans_JP']"
          aria-label="検索"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="search-results"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sumi-400 dark:text-usuzumi-500 hover:text-sumi-600 dark:hover:text-usuzumi-300 transition-colors"
            aria-label="検索をクリア"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 検索結果ドロップダウン */}
      {isOpen && results.length > 0 && (
        <div
          id="search-results"
          className="absolute z-50 w-full mt-2 bg-unohana-50 dark:bg-sumi-800 border border-usuzumi-200 dark:border-usuzumi-700 rounded-lg shadow-xl max-h-96 overflow-y-auto"
          role="listbox"
        >
          <div className="px-3 py-2 border-b border-usuzumi-200 dark:border-usuzumi-700">
            <span className="text-sm font-semibold text-sumi-700 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
              {results.length}件の結果
            </span>
          </div>
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}-${index}`}
              onClick={() => handleResultClick(result)}
              className={`w-full text-left px-4 py-3 hover:bg-usuzumi-100 dark:hover:bg-usuzumi-700 transition-colors border-b border-usuzumi-100 dark:border-usuzumi-700 last:border-b-0 ${
                index === selectedIndex ? 'bg-ai-50 dark:bg-ai-900/30' : ''
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-semibold text-ai-600 dark:text-ai-400 px-2 py-0.5 rounded bg-ai-100 dark:bg-ai-900/30 font-['Noto_Sans_JP']">
                      {getSearchResultTypeLabel(result.type)}
                    </span>
                    {result.step && (
                      <span className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
                        {result.step === 'character' ? 'キャラクター' :
                         result.step === 'plot1' ? 'プロット基本' :
                         result.step === 'plot2' ? 'プロット構成' :
                         result.step === 'synopsis' ? 'あらすじ' :
                         result.step === 'chapter' ? '章立て' :
                         result.step === 'draft' ? '草案' : result.step}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-sumi-900 dark:text-usuzumi-50 mb-1 font-['Noto_Sans_JP']">
                    {highlightText(result.title, query)}
                  </div>
                  {result.matchText && (
                    <div className="text-xs text-sumi-600 dark:text-usuzumi-400 line-clamp-2 font-['Noto_Sans_JP']">
                      {highlightText(result.matchText, query)}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-sumi-400 dark:text-usuzumi-500 flex-shrink-0 ml-2" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-unohana-50 dark:bg-sumi-800 border border-usuzumi-200 dark:border-usuzumi-700 rounded-lg shadow-xl">
          <EmptyState
            icon={FileSearch}
            iconSize={48}
            iconColor="text-usuzumi-400 dark:text-usuzumi-500"
            title="検索結果が見つかりませんでした"
            description={`「${query}」に一致する内容が見つかりませんでした。別のキーワードで検索するか、スペルを確認してください。`}
            className="py-8"
          />
        </div>
      )}
    </div>
  );
};

