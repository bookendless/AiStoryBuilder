import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, BookOpen, Calendar, Network, Zap, CheckCircle, Lightbulb, StopCircle } from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { useProject, CharacterRelationship } from '../../contexts/ProjectContext';
import { aiService } from '../../services/aiService';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { Modal } from '../common/Modal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ isOpen, onClose }) => {
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });
  const { settings, isConfigured } = useAI();
  const { currentProject } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // メッセージが更新されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]); // isLoading中もスクロールするように追加

  // チャットが開いたらフォーカス
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // プロジェクト情報をコンテキストとして取得（拡張版）
  const getProjectContext = (): string => {
    if (!currentProject) return '';

    let context = `現在のプロジェクト: ${currentProject.title}\n`;
    context += `テーマ: ${currentProject.theme || currentProject.projectTheme || '未設定'}\n`;
    context += `メインジャンル: ${currentProject.mainGenre || currentProject.genre || '未設定'}\n`;
    context += `サブジャンル: ${currentProject.subGenre || '未設定'}\n\n`;

    if (currentProject.characters && currentProject.characters.length > 0) {
      context += 'キャラクター:\n';
      currentProject.characters.forEach(char => {
        let charInfo = `- ${char.name} (${char.role})`;
        if (char.personality) {
          charInfo += `\n  性格: ${char.personality}`;
        }
        if (char.background) {
          charInfo += `\n  背景: ${char.background}`;
        }
        // 口調設定は簡潔に（最大100文字）
        if (char.speechStyle) {
          const speechStyle = char.speechStyle.trim();
          const truncatedSpeechStyle = speechStyle.length > 100 
            ? speechStyle.substring(0, 100) + '...' 
            : speechStyle;
          charInfo += `\n  口調: ${truncatedSpeechStyle}`;
        }
        context += charInfo + '\n';
      });
      context += '\n';
    }

    if (currentProject.plot) {
      context += `プロット設定:\n`;
      context += `- テーマ: ${currentProject.plot.theme || '未設定'}\n`;
      context += `- 舞台: ${currentProject.plot.setting || '未設定'}\n`;
      context += `- 主人公の目標: ${currentProject.plot.protagonistGoal || '未設定'}\n`;
      context += `- 主要な障害: ${currentProject.plot.mainObstacle || '未設定'}\n\n`;
    }

    if (currentProject.synopsis) {
      context += `あらすじ: ${currentProject.synopsis}\n\n`;
    }

    // 用語集の情報を追加
    if (currentProject.glossary && currentProject.glossary.length > 0) {
      context += `用語集 (${currentProject.glossary.length}件):\n`;
      currentProject.glossary.slice(0, 20).forEach(term => {
        context += `- ${term.term}${term.reading ? ` (${term.reading})` : ''}: ${term.definition}\n`;
      });
      if (currentProject.glossary.length > 20) {
        context += `...他${currentProject.glossary.length - 20}件\n`;
      }
      context += '\n';
    }

    // タイムラインの情報を追加
    if (currentProject.timeline && currentProject.timeline.length > 0) {
      context += `タイムライン (${currentProject.timeline.length}件):\n`;
      const sortedTimeline = [...currentProject.timeline].sort((a, b) => a.order - b.order);
      sortedTimeline.slice(0, 10).forEach(event => {
        context += `- ${event.title}${event.date ? ` (${event.date})` : ''}: ${event.description.substring(0, 100)}...\n`;
      });
      if (sortedTimeline.length > 10) {
        context += `...他${sortedTimeline.length - 10}件\n`;
      }
      context += '\n';
    }

    // 相関図の情報を追加
    if (currentProject.relationships && currentProject.relationships.length > 0) {
      context += `人物相関図 (${currentProject.relationships.length}件):\n`;
      currentProject.relationships.slice(0, 10).forEach(rel => {
        const fromChar = currentProject.characters.find(c => c.id === rel.from);
        const toChar = currentProject.characters.find(c => c.id === rel.to);
        const typeLabels: Record<CharacterRelationship['type'], string> = {
          friend: '友人',
          enemy: '敵対',
          family: '家族',
          romantic: '恋愛',
          mentor: '師弟',
          rival: 'ライバル',
          other: 'その他',
        };
        context += `- ${fromChar?.name || '不明'} → ${toChar?.name || '不明'}: ${typeLabels[rel.type]} (強度: ${rel.strength}/5)\n`;
      });
      if (currentProject.relationships.length > 10) {
        context += `...他${currentProject.relationships.length - 10}件\n`;
      }
      context += '\n';
    }

    return context;
  };

  // コマンドを解析してアクションを実行
  const parseCommand = async (userInput: string): Promise<{ action: string; result?: string } | null> => {
    const input = userInput.toLowerCase().trim();

    // 用語集関連のコマンド
    if (input.includes('用語集') || input.includes('用語')) {
      // 用語の検索
      const termMatch = input.match(/(?:用語集|用語).*?[「『"](.+?)[」』"]|(?:用語集|用語).*?から(.+?)(?:の|を|について)/);
      if (termMatch) {
        const searchTerm = (termMatch[1] || termMatch[2] || '').trim();
        if (searchTerm && currentProject?.glossary) {
          const term = currentProject.glossary.find(
            t => t.term.toLowerCase().includes(searchTerm) || t.term === searchTerm
          );
          if (term) {
            return {
              action: 'info',
              result: `【用語集】\n用語: ${term.term}\n${term.reading ? `読み方: ${term.reading}\n` : ''}説明: ${term.definition}\nカテゴリ: ${term.category}${term.notes ? `\n備考: ${term.notes}` : ''}`,
            };
          }
        }
      }
    }

    // タイムライン関連のコマンド
    if (input.includes('タイムライン') || input.includes('イベント')) {
      if (currentProject?.timeline && currentProject.timeline.length > 0) {
        const sortedTimeline = [...currentProject.timeline].sort((a, b) => a.order - b.order);
        let result = `【タイムライン】\n`;
        sortedTimeline.slice(0, 5).forEach((event, idx) => {
          result += `${idx + 1}. ${event.title}${event.date ? ` (${event.date})` : ''}\n   ${event.description.substring(0, 100)}...\n\n`;
        });
        if (sortedTimeline.length > 5) {
          result += `...他${sortedTimeline.length - 5}件`;
        }
        return { action: 'info', result };
      }
    }

    // 相関図関連のコマンド
    if (input.includes('相関図') || input.includes('関係')) {
      const charMatch = input.match(/(?:相関図|関係).*?[「『"](.+?)[」』"]|(?:相関図|関係).*?から(.+?)(?:の|を|について)/);
      if (charMatch && currentProject?.relationships) {
        const searchChar = (charMatch[1] || charMatch[2] || '').trim();
        if (searchChar) {
          const char = currentProject.characters.find(
            c => c.name.toLowerCase().includes(searchChar) || c.name === searchChar
          );
          if (char) {
            const relationships = currentProject.relationships.filter(
              r => r.from === char.id || r.to === char.id
            );
            if (relationships.length > 0) {
              let result = `【${char.name}の関係性】\n`;
              relationships.forEach(rel => {
                const otherChar = currentProject.characters.find(
                  c => c.id === (rel.from === char.id ? rel.to : rel.from)
                );
                const typeLabels: Record<CharacterRelationship['type'], string> = {
                  friend: '友人',
                  enemy: '敵対',
                  family: '家族',
                  romantic: '恋愛',
                  mentor: '師弟',
                  rival: 'ライバル',
                  other: 'その他',
                };
                const direction = rel.from === char.id ? '→' : '←';
                result += `${otherChar?.name || '不明'} ${direction} ${typeLabels[rel.type]} (強度: ${rel.strength}/5)\n`;
              });
              return { action: 'info', result };
            }
          }
        }
      }
    }

    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !isConfigured) return;

    const userInput = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // AbortControllerのセットアップ
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // アシスタントのメッセージ用プレースホルダーを作成
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '', // 初期状態は空
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      // コマンドを解析
      const commandResult = await parseCommand(userInput);

      if (commandResult && commandResult.result) {
        // コマンド結果を直接更新
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: commandResult.result! }
            : msg
        ));
        setIsLoading(false);
        abortControllerRef.current = null;
        inputRef.current?.focus();
        return;
      }

      // 会話履歴を構築
      const conversationHistory = messages
        .map(msg => `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}`)
        .join('\n\n');

      const projectContext = getProjectContext();

      // 拡張システムプロンプト
      let systemPrompt = `あなたは小説創作を支援するAIアシスタントです。ユーザーの質問に親切に答えてください。

【利用可能な機能】
1. 用語集の参照: 「用語集から『魔王』の説明を教えて」など
2. タイムラインの参照: 「タイムラインを教えて」「イベント一覧を表示して」など
3. 相関図の参照: 「相関図で『主人公』の関係性を教えて」など
4. プロジェクト分析: 「プロジェクトの整合性をチェックして」「ストーリーの構造を分析して」など
5. 創作支援: プロット、キャラクター、ストーリー展開などのアドバイス

【重要な注意事項】
- 用語集、タイムライン、相関図の情報は上記のプロジェクト情報に含まれています
- ユーザーが特定の情報を求めている場合は、プロジェクト情報から該当する情報を探して提供してください
- 創作に関する質問には、プロジェクトの設定や世界観を考慮した回答をしてください`;

      if (projectContext) {
        systemPrompt += `\n\n【現在のプロジェクト情報】\n${projectContext}`;
      }
      if (conversationHistory) {
        systemPrompt += `\n\n【会話履歴】\n${conversationHistory}`;
      }

      // ユーザーの質問を追加
      const fullPrompt = `${systemPrompt}\n\nユーザー: ${userMessage.content}\nアシスタント:`;

      let accumulatedContent = '';

      const response = await aiService.generateContent({
        prompt: fullPrompt,
        type: 'draft',
        settings,
        context: projectContext || undefined,
        signal: abortController.signal,
        onStream: (chunk) => {
          accumulatedContent += chunk;
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedContent }
              : msg
          ));
        }
      });

      if (response.error) {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `エラーが発生しました: ${response.error}` }
            : msg
        ));
      } else if (!accumulatedContent && response.content) {
        // ストリーミングが機能しなかった場合のフォールバック
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: response.content }
            : msg
        ));
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('生成が中断されました');
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + '\n(生成を中断しました)' }
            : msg
        ));
      } else {
        console.error('Chat error:', error);
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` }
            : msg
        ));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // クイックアクション
  const handleQuickAction = (action: string) => {
    const actions: Record<string, string> = {
      'check-consistency': 'プロジェクトの整合性をチェックしてください。用語集、タイムライン、相関図、キャラクター設定の一貫性を確認して、矛盾や問題点があれば指摘してください。',
      'analyze-structure': 'ストーリーの構造を分析してください。プロット構成、章立て、キャラクターの成長、物語の流れについて評価と改善提案をお願いします。',
      'suggest-terms': 'プロジェクトの内容から、用語集に追加すべき重要な用語を提案してください。',
      'timeline-summary': 'タイムラインの要約を教えてください。主要なイベントを時系列で整理してください。',
      'character-relations': '主要キャラクター間の関係性をまとめてください。',
      'story-suggestions': 'ストーリー展開のアイデアや改善提案をしてください。',
    };

    if (actions[action]) {
      setInput(actions[action]);
      setShowQuickActions(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setShowQuickActions(true); // クリア時にテンプレートを再表示
  };

  // テンプレートを再表示する関数
  const handleShowTemplates = () => {
    setShowQuickActions(true);
    // テンプレート表示エリアまでスクロール
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (!isOpen) return null;

  return (

    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            AIアシスタント
          </span>
        </div>
      }
      size="md"
      ref={modalRef}
    >
      <div className="flex flex-col h-[70vh]">
        {/* ヘッダーアクション */}
        {messages.length > 0 && (
          <div className="flex items-center justify-end space-x-2 mb-2 px-2">
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
              title="クイックアクション"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              onClick={handleClear}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              クリア
            </button>
          </div>
        )}

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
              <Bot className="h-12 w-12 mb-4 text-indigo-600 dark:text-indigo-400" />
              <p className="font-['Noto_Sans_JP'] mb-4">
                AIアシスタントに質問してください
              </p>
              {!isConfigured && (
                <p className="text-sm mt-2 text-yellow-600 dark:text-yellow-400 font-['Noto_Sans_JP'] mb-4">
                  AI設定が必要です
                </p>
              )}

              {/* クイックアクション */}
              {isConfigured && showQuickActions && (
                <div className="w-full max-w-2xl mt-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      クイックアクション
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <button
                      onClick={() => handleQuickAction('check-consistency')}
                      className="flex items-center space-x-2 px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-['Noto_Sans_JP']"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span>整合性チェック</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction('analyze-structure')}
                      className="flex items-center space-x-2 px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-['Noto_Sans_JP']"
                    >
                      <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                      <span>構造分析</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction('suggest-terms')}
                      className="flex items-center space-x-2 px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-['Noto_Sans_JP']"
                    >
                      <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span>用語提案</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction('timeline-summary')}
                      className="flex items-center space-x-2 px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-['Noto_Sans_JP']"
                    >
                      <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <span>タイムライン要約</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction('character-relations')}
                      className="flex items-center space-x-2 px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-['Noto_Sans_JP']"
                    >
                      <Network className="h-4 w-4 text-pink-600 dark:text-pink-400 flex-shrink-0" />
                      <span>関係性まとめ</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction('story-suggestions')}
                      className="flex items-center space-x-2 px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-['Noto_Sans_JP']"
                    >
                      <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                      <span>展開アイデア</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setShowQuickActions(false)}
                    className="mt-3 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-['Noto_Sans_JP']"
                  >
                    非表示にする
                  </button>
                </div>
              )}

              {/* 使用例 */}
              {isConfigured && (
                <div className="w-full max-w-2xl mt-6 text-left">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-['Noto_Sans_JP']">
                    使用例:
                  </p>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    <p>• 「用語集から『魔王』の説明を教えて」</p>
                    <p>• 「タイムラインを教えて」</p>
                    <p>• 「相関図で『主人公』の関係性を教えて」</p>
                    <p>• 「プロジェクトの整合性をチェックして」</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user'
                    ? 'bg-indigo-600 dark:bg-indigo-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
                <div
                  className={`rounded-lg px-4 py-2 ${message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                >
                  {/* メッセージ内容が空の場合はローディング表示（ストリーミング開始前） */}
                  {message.content === '' && isLoading ? (
                    <div className="flex space-x-1 h-5 items-center">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap font-['Noto_Sans_JP']">
                      {message.content}
                    </p>
                  )}
                  <p
                    className={`text-xs mt-1 ${message.role === 'user'
                      ? 'text-indigo-200'
                      : 'text-gray-500 dark:text-gray-400'
                      }`}
                  >
                    {message.timestamp.toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* クイックアクション（メッセージがある場合） */}
          {messages.length > 0 && showQuickActions && isConfigured && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    クイックアクション
                  </p>
                </div>
                <button
                  onClick={() => setShowQuickActions(false)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-['Noto_Sans_JP']"
                >
                  非表示
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <button
                  onClick={() => handleQuickAction('check-consistency')}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left font-['Noto_Sans_JP']"
                >
                  <CheckCircle className="h-3 w-3 inline mr-1 text-green-600" />
                  整合性チェック
                </button>
                <button
                  onClick={() => handleQuickAction('analyze-structure')}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left font-['Noto_Sans_JP']"
                >
                  <Lightbulb className="h-3 w-3 inline mr-1 text-yellow-600" />
                  構造分析
                </button>
                <button
                  onClick={() => handleQuickAction('suggest-terms')}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left font-['Noto_Sans_JP']"
                >
                  <BookOpen className="h-3 w-3 inline mr-1 text-blue-600" />
                  用語提案
                </button>
                <button
                  onClick={() => handleQuickAction('timeline-summary')}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left font-['Noto_Sans_JP']"
                >
                  <Calendar className="h-3 w-3 inline mr-1 text-purple-600" />
                  タイムライン
                </button>
                <button
                  onClick={() => handleQuickAction('character-relations')}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left font-['Noto_Sans_JP']"
                >
                  <Network className="h-3 w-3 inline mr-1 text-pink-600" />
                  関係性
                </button>
                <button
                  onClick={() => handleQuickAction('story-suggestions')}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left font-['Noto_Sans_JP']"
                >
                  <Zap className="h-3 w-3 inline mr-1 text-orange-600" />
                  展開アイデア
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {/* テンプレート再表示ボタン（メッセージがある場合のみ表示） */}
          {messages.length > 0 && !showQuickActions && isConfigured && (
            <div className="mb-3 flex items-center justify-center">
              <button
                onClick={handleShowTemplates}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors font-['Noto_Sans_JP']"
                title="操作テンプレートを表示"
              >
                <Sparkles className="h-4 w-4" />
                <span>テンプレートを表示</span>
              </button>
            </div>
          )}
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConfigured ? "メッセージを入力..." : "AI設定が必要です"}
              disabled={isLoading || !isConfigured}
              rows={2}
              className="flex-1 resize-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
            />
            {isLoading ? (
              <button
                onClick={handleStop}
                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="停止"
              >
                <StopCircle className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !isConfigured}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="送信"
              >
                <Send className="h-5 w-5" />
              </button>
            )}
          </div>
          {!isConfigured && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-['Noto_Sans_JP']">
              AI設定画面でAPIキーを設定してください
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
