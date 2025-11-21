import React from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-blue-500';
  const hoverColor = type === 'success' ? 'hover:bg-emerald-600' : 'hover:bg-blue-600';

  return (
    <div className="fixed top-4 right-4 z-50 fade-in">
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-md`}>
        <CheckCircle className="h-5 w-5 flex-shrink-0" />
        <span className="flex-1 text-sm font-['Noto_Sans_JP']">{message}</span>
        <button
          onClick={onClose}
          className={`flex-shrink-0 p-1 ${hoverColor} rounded transition-colors`}
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

