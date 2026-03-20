import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { Modal } from '../../../../common/Modal';
import { Shield } from 'lucide-react';
import type { ConsistencyResult } from '../../types';

interface ConsistencyResultModalProps {
  isOpen: boolean;
  consistencyResult: ConsistencyResult | null;
  onClose: () => void;
}

export const ConsistencyResultModal: React.FC<ConsistencyResultModalProps> = ({
  isOpen,
  consistencyResult,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-500" />
          <span className="font-['Noto_Sans_JP']">伏線整合性チェック結果</span>
        </div>
      }
      size="lg"
      className="z-[60]"
    >
      {consistencyResult && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* スコア表示 */}
          <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
            <div className={`text-5xl font-bold ${consistencyResult.overallScore >= 80 ? 'text-green-600' :
              consistencyResult.overallScore >= 60 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {consistencyResult.overallScore}
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">整合性スコア</p>
          </div>

          {/* サマリー */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{consistencyResult.summary}</p>
          </div>

          {/* 良い点 */}
          {consistencyResult.strengths.length > 0 && (
            <div>
              <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <span>良い点</span>
              </h4>
              <ul className="space-y-1">
                {consistencyResult.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 未解決の問題 */}
          {consistencyResult.unresolvedIssues.length > 0 && (
            <div>
              <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <span>未解決の問題</span>
              </h4>
              <div className="space-y-2">
                {consistencyResult.unresolvedIssues.map((issue, i) => (
                  <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
                        {issue.foreshadowingTitle}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">{issue.issue}</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 font-['Noto_Sans_JP']">
                      💡 {issue.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 矛盾 */}
          {consistencyResult.contradictions.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2 font-['Noto_Sans_JP'] flex items-center space-x-2">
                <X className="h-5 w-5" />
                <span>矛盾点</span>
              </h4>
              <div className="space-y-2">
                {consistencyResult.contradictions.map((c, i) => (
                  <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300 font-['Noto_Sans_JP']">
                      {c.items.join(' ↔ ')}
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">{c.description}</p>
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1 font-['Noto_Sans_JP']">
                      💡 {c.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* バランスの問題 */}
          {consistencyResult.balanceIssues.length > 0 && (
            <div>
              <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 font-['Noto_Sans_JP']">
                バランスの問題
              </h4>
              <div className="space-y-2">
                {consistencyResult.balanceIssues.map((b, i) => (
                  <div key={i} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">{b.issue}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-['Noto_Sans_JP']">
                      💡 {b.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
