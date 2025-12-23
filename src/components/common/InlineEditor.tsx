import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Edit3 } from 'lucide-react';

interface InlineEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel?: () => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
  showEditIcon?: boolean;
}

export const InlineEditor: React.FC<InlineEditorProps> = ({
  value,
  onSave,
  onCancel,
  multiline = false,
  placeholder = 'クリックして編集',
  className = '',
  maxLength,
  rows = 3,
  disabled = false,
  showEditIcon = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // 外部のvalueが変更されたら、編集値も更新
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // 編集モードに入ったらフォーカス
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // テキストエリアの場合は末尾にカーソルを移動
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.setSelectionRange(
          inputRef.current.value.length,
          inputRef.current.value.length
        );
      }
    }
  }, [isEditing, multiline]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue !== value) {
      onSave(trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    if (onCancel) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`flex items-start space-x-2 ${className}`}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => {
              const newValue = e.target.value;
              if (!maxLength || newValue.length <= maxLength) {
                setEditValue(newValue);
              }
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={placeholder}
            rows={rows}
            className="flex-1 px-3 py-2 rounded-lg border border-indigo-500 dark:border-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP'] resize-none"
            disabled={disabled}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => {
              const newValue = e.target.value;
              if (!maxLength || newValue.length <= maxLength) {
                setEditValue(newValue);
              }
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-lg border border-indigo-500 dark:border-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
            disabled={disabled}
          />
        )}
        {maxLength && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] whitespace-nowrap">
            {editValue.length}/{maxLength}
          </span>
        )}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleSave}
            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            aria-label="保存"
            title="保存 (Enter)"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            aria-label="キャンセル"
            title="キャンセル (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleStartEdit}
      className={`group flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-2 transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      <div className="flex-1 min-w-0">
        {multiline ? (
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-['Noto_Sans_JP']">
            {value || <span className="text-gray-400 dark:text-gray-500 italic">{placeholder}</span>}
          </p>
        ) : (
          <p className="text-gray-700 dark:text-gray-300 truncate font-['Noto_Sans_JP']">
            {value || <span className="text-gray-400 dark:text-gray-500 italic">{placeholder}</span>}
          </p>
        )}
      </div>
      {showEditIcon && !disabled && (
        <Edit3 className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      )}
    </div>
  );
};













































































