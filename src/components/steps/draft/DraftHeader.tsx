import React from 'react';
import { PenTool, Save } from 'lucide-react';

interface DraftHeaderProps {
  onBackup: () => void;
}

export const DraftHeader: React.FC<DraftHeaderProps> = ({ onBackup }) => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-emerald-500">
                <PenTool className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                草案作成
              </h1>
            </div>
            <p className="mt-2 text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              章ごとに詳細な草案を作成し、物語を完成させましょう
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBackup}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-['Noto_Sans_JP']"
            >
              <Save className="h-4 w-4" />
              <span>バックアップ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

