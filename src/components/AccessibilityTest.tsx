/**
 * アクセシビリティテスト用コンポーネント
 * Phase 1: アクセシビリティのテストと検証
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';

interface AccessibilityTestProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  element?: HTMLElement;
}

export const AccessibilityTest: React.FC<AccessibilityTestProps> = ({ isOpen, onClose }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const runAccessibilityTests = async () => {
    setIsRunning(true);
    const testResults: TestResult[] = [];

    // 1. 画像のalt属性チェック
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      if (!img.alt || img.alt.trim() === '') {
        testResults.push({
          id: `img-alt-${index}`,
          name: '画像のalt属性',
          status: 'fail',
          message: `画像にalt属性が設定されていません: ${img.src}`,
          element: img
        });
      } else {
        testResults.push({
          id: `img-alt-${index}`,
          name: '画像のalt属性',
          status: 'pass',
          message: `画像にalt属性が設定されています: ${img.alt}`,
          element: img
        });
      }
    });

    // 2. ボタンのaria-labelチェック
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button, index) => {
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasTextContent = button.textContent && button.textContent.trim() !== '';
      const hasTitle = button.hasAttribute('title');
      
      if (!hasAriaLabel && !hasTextContent && !hasTitle) {
        testResults.push({
          id: `button-label-${index}`,
          name: 'ボタンのラベル',
          status: 'fail',
          message: `ボタンにアクセシブルなラベルがありません`,
          element: button
        });
      } else {
        testResults.push({
          id: `button-label-${index}`,
          name: 'ボタンのラベル',
          status: 'pass',
          message: `ボタンにアクセシブルなラベルが設定されています`,
          element: button
        });
      }
    });

    // 3. フォーム要素のラベルチェック
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
      const id = input.getAttribute('id');
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.hasAttribute('aria-label');
      const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        testResults.push({
          id: `form-label-${index}`,
          name: 'フォーム要素のラベル',
          status: 'fail',
          message: `フォーム要素にラベルが関連付けられていません`,
          element: input as HTMLElement
        });
      } else {
        testResults.push({
          id: `form-label-${index}`,
          name: 'フォーム要素のラベル',
          status: 'pass',
          message: `フォーム要素にラベルが関連付けられています`,
          element: input as HTMLElement
        });
      }
    });

    // 4. 見出しの構造チェック
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > previousLevel + 1) {
        testResults.push({
          id: `heading-structure-${index}`,
          name: '見出しの構造',
          status: 'warning',
          message: `見出しレベルが飛んでいます: ${heading.tagName}`,
          element: heading as HTMLElement
        });
      } else {
        testResults.push({
          id: `heading-structure-${index}`,
          name: '見出しの構造',
          status: 'pass',
          message: `適切な見出しレベルです: ${heading.tagName}`,
          element: heading as HTMLElement
        });
      }
      previousLevel = level;
    });

    // 5. フォーカス可能要素のチェック
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const hasFocusableElements = focusableElements.length > 0;
    
    if (!hasFocusableElements) {
      testResults.push({
        id: 'focusable-elements',
        name: 'フォーカス可能要素',
        status: 'fail',
        message: 'フォーカス可能な要素が見つかりません'
      });
    } else {
      testResults.push({
        id: 'focusable-elements',
        name: 'フォーカス可能要素',
        status: 'pass',
        message: `${focusableElements.length}個のフォーカス可能要素が見つかりました`
      });
    }

    // 6. カラーコントラストのチェック（簡易版）
    const elements = document.querySelectorAll('*');
    let contrastIssues = 0;
    elements.forEach((element) => {
      const computedStyle = window.getComputedStyle(element);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;
      
      // 簡易的なコントラストチェック（実際の実装ではより詳細な計算が必要）
      if (color === backgroundColor) {
        contrastIssues++;
      }
    });

    if (contrastIssues > 0) {
      testResults.push({
        id: 'color-contrast',
        name: 'カラーコントラスト',
        status: 'warning',
        message: `${contrastIssues}個の要素でコントラストの問題が検出されました`
      });
    } else {
      testResults.push({
        id: 'color-contrast',
        name: 'カラーコントラスト',
        status: 'pass',
        message: 'カラーコントラストに問題は見つかりませんでした'
      });
    }

    setResults(testResults);
    setIsRunning(false);
  };

  useEffect(() => {
    if (isOpen) {
      runAccessibilityTests();
    }
  }, [isOpen]);

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'fail':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
  };

  const scrollToElement = (element: HTMLElement) => {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warningCount = results.filter(r => r.status === 'warning').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              アクセシビリティテスト結果
            </h2>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {showDetails ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                <span className="text-sm">
                  {showDetails ? '詳細を隠す' : '詳細を表示'}
                </span>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="テスト結果を閉じる"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {isRunning ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">テストを実行中...</span>
              </div>
            ) : (
              <>
                {/* サマリー */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{passCount}</div>
                    <div className="text-sm text-green-700 dark:text-green-300">合格</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{failCount}</div>
                    <div className="text-sm text-red-700 dark:text-red-300">不合格</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{warningCount}</div>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">警告</div>
                  </div>
                </div>

                {/* テスト結果 */}
                <div className="space-y-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
                    >
                      <div className="flex items-start space-x-3">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <div className="font-medium">{result.name}</div>
                          <div className="text-sm mt-1">{result.message}</div>
                          {showDetails && result.element && (
                            <button
                              onClick={() => scrollToElement(result.element!)}
                              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              要素に移動
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 再テストボタン */}
                <div className="mt-6 text-center">
                  <button
                    onClick={runAccessibilityTests}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    再テストを実行
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
