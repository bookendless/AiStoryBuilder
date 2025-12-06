import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, StopCircle, Sparkles, X } from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { useProject, Character } from '../../contexts/ProjectContext';
import { aiService } from '../../services/aiService';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { Modal } from '../common/Modal';
import { PossessionMessage } from '../../types/characterPossession';
import { generateUUID } from '../../utils/securityUtils';

interface CharacterPossessionChatProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
}

export const CharacterPossessionChat: React.FC<CharacterPossessionChatProps> = ({
  isOpen,
  onClose,
  characterId,
}) => {
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });
  const { settings, isConfigured } = useAI();
  const { currentProject } = useProject();
  const [messages, setMessages] = useState<PossessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>(generateUUID());

  // 選択されたキャラクターを取得
  const character = currentProject?.characters.find(c => c.id === characterId);

  // メッセージが更新されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // チャットが開いたらフォーカス
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // 会話履歴をローカルストレージから復元
      loadConversationHistory();
    }
  }, [isOpen, characterId]);

  // キャラクターが変更されたら会話履歴をクリア
  useEffect(() => {
    if (characterId) {
      setMessages([]);
      sessionIdRef.current = generateUUID();
      loadConversationHistory();
    }
  }, [characterId]);

  // 会話履歴をローカルストレージから読み込み
  const loadConversationHistory = useCallback(() => {
    if (!currentProject || !characterId) return;
    try {
      const key = `possession_chat_${currentProject.id}_${characterId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed.messages || []);
        sessionIdRef.current = parsed.sessionId || generateUUID();
      }
    } catch (error) {
      console.error('会話履歴の読み込みに失敗しました:', error);
    }
  }, [currentProject, characterId]);

  // 会話履歴をローカルストレージに保存
  const saveConversationHistory = useCallback((msgs: PossessionMessage[]) => {
    if (!currentProject || !characterId) return;
    try {
      const key = `possession_chat_${currentProject.id}_${characterId}`;
      const data = {
        sessionId: sessionIdRef.current,
        messages: msgs,
        lastActiveAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('会話履歴の保存に失敗しました:', error);
    }
  }, [currentProject, characterId]);

  // キャラクター関係性を取得
  const getCharacterRelationships = (): string => {
    if (!currentProject || !character) return 'なし';

    const relationships = currentProject.relationships?.filter(
      rel => rel.from === character.id || rel.to === character.id
    ) || [];

    if (relationships.length === 0) return 'なし';

    const typeLabels: Record<string, string> = {
      friend: '友人',
      enemy: '敵対',
      family: '家族',
      romantic: '恋愛',
      mentor: '師弟',
      rival: 'ライバル',
      other: 'その他',
    };

    return relationships.map(rel => {
      const otherChar = currentProject.characters.find(
        c => c.id === (rel.from === character.id ? rel.to : rel.from)
      );
      const direction = rel.from === character.id ? '→' : '←';
      return `${otherChar?.name || '不明'} ${direction} ${typeLabels[rel.type] || 'その他'} (強度: ${rel.strength}/5)`;
    }).join('\n');
  };

  // プロジェクト情報をコンテキストとして構築
  const buildProjectContext = (): string => {
    if (!currentProject) return '';

    let context = `タイトル: ${currentProject.title}\n`;
    context += `テーマ: ${currentProject.theme || currentProject.projectTheme || '未設定'}\n`;
    if (currentProject.mainGenre || currentProject.genre) {
      context += `ジャンル: ${currentProject.mainGenre || currentProject.genre}\n`;
    }
    if (currentProject.plot) {
      if (currentProject.plot.theme) {
        context += `プロットテーマ: ${currentProject.plot.theme}\n`;
      }
      if (currentProject.plot.setting) {
        context += `舞台設定: ${currentProject.plot.setting}\n`;
      }
    }
    return context;
  };

  // 会話履歴をフォーマット
  const formatConversationHistory = (msgs: PossessionMessage[]): string => {
    if (msgs.length === 0) return 'まだ会話がありません。';
    return msgs.map(msg => {
      const role = msg.role === 'user' ? 'ユーザー' : character?.name || 'キャラクター';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  };

  // メッセージ送信
  const handleSend = async () => {
    if (!input.trim() || isLoading || !isConfigured || !character || !currentProject) return;

    const userMessage: PossessionMessage = {
      id: generateUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveConversationHistory(updatedMessages);
    setInput('');
    setIsLoading(true);

    // AbortControllerのセットアップ
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // アシスタントのメッセージ用プレースホルダーを作成
    const characterMessageId = generateUUID();
    const characterMessage: PossessionMessage = {
      id: characterMessageId,
      role: 'character',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, characterMessage]);

    try {
      // プロンプトを構築
      const characterRelationships = getCharacterRelationships();
      const conversationHistory = formatConversationHistory(messages);
      const projectContext = buildProjectContext();

      // 口調の指示を構築
      const speechStyleInstruction = character.speechStyle
        ? `「${character.speechStyle}」という口調を完全に再現してください`
        : '標準的な話し方で話してください';

      const prompt = aiService.buildPrompt('character', 'possession', {
        characterName: character.name,
        characterRole: character.role || '未設定',
        characterAppearance: character.appearance || '未設定',
        characterPersonality: character.personality || '未設定',
        characterBackground: character.background || '未設定',
        characterSpeechStyle: character.speechStyle ? `口調・話し方: ${character.speechStyle}` : '',
        projectTitle: currentProject.title || '未設定',
        projectTheme: currentProject.theme || currentProject.projectTheme || '未設定',
        projectGenre: (currentProject.mainGenre || currentProject.genre) ? `ジャンル: ${currentProject.mainGenre || currentProject.genre}` : '',
        plotTheme: currentProject.plot?.theme ? `プロットテーマ: ${currentProject.plot.theme}` : '',
        plotSetting: currentProject.plot?.setting ? `舞台設定: ${currentProject.plot.setting}` : '',
        characterRelationships: characterRelationships,
        conversationHistory: conversationHistory,
        speechStyleInstruction: speechStyleInstruction,
        userMessage: userMessage.content,
      });

      let accumulatedContent = '';

      const response = await aiService.generateContent({
        prompt,
        type: 'character',
        settings,
        signal: abortController.signal,
        onStream: (chunk) => {
          accumulatedContent += chunk;
          setMessages(prev => prev.map(msg =>
            msg.id === characterMessageId
              ? { ...msg, content: accumulatedContent }
              : msg
          ));
        }
      });

      if (response.error) {
        setMessages(prev => prev.map(msg =>
          msg.id === characterMessageId
            ? { ...msg, content: `エラーが発生しました: ${response.error}` }
            : msg
        ));
      } else if (!accumulatedContent && response.content) {
        // ストリーミングが機能しなかった場合のフォールバック
        accumulatedContent = response.content;
        setMessages(prev => prev.map(msg =>
          msg.id === characterMessageId
            ? { ...msg, content: response.content }
            : msg
        ));
      }

      // 最終的な会話履歴を保存
      const finalMessages = [...updatedMessages];
      finalMessages[finalMessages.length - 1] = {
        ...characterMessage,
        content: accumulatedContent || response.content || '',
      };
      saveConversationHistory(finalMessages);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('生成が中断されました');
        setMessages(prev => prev.map(msg =>
          msg.id === characterMessageId
            ? { ...msg, content: msg.content + '\n(生成を中断しました)' }
            : msg
        ));
      } else {
        console.error('Chat error:', error);
        setMessages(prev => prev.map(msg =>
          msg.id === characterMessageId
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

  // 生成停止
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // 会話履歴をクリア
  const handleClear = () => {
    setMessages([]);
    sessionIdRef.current = generateUUID();
    if (currentProject && characterId) {
      const key = `possession_chat_${currentProject.id}_${characterId}`;
      localStorage.removeItem(key);
    }
  };

  // キーボードショートカット
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen || !character) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              🎭 キャラクター憑依モード
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {character.image && (
              <img
                src={character.image}
                alt={character.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-purple-500"
              />
            )}
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
              {character.name}
            </span>
          </div>
        </div>
      }
      size="lg"
      ref={modalRef}
    >
      <div className="flex flex-col h-[70vh]">
        {/* ヘッダーアクション */}
        {messages.length > 0 && (
          <div className="flex items-center justify-end space-x-2 mb-2 px-2">
            <button
              onClick={handleClear}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              会話履歴をクリア
            </button>
          </div>
        )}

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
              <Sparkles className="h-12 w-12 mb-4 text-purple-600 dark:text-purple-400" />
              <p className="font-['Noto_Sans_JP'] mb-4">
                {character.name}になりきって会話できます
              </p>
              {!isConfigured && (
                <p className="text-sm mt-2 text-yellow-600 dark:text-yellow-400 font-['Noto_Sans_JP'] mb-4">
                  AI設定が必要です
                </p>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] mt-4">
                <p>💡 使用例:</p>
                <p>• 「このシーンでどう行動する？」</p>
                <p>• 「○○キャラクターについてどう思う？」</p>
                <p>• 「今の気持ちを教えて」</p>
              </div>
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
                    : 'bg-purple-500 dark:bg-purple-600'
                    }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : character.image ? (
                    <img
                      src={character.image}
                      alt={character.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <Sparkles className="h-4 w-4 text-white" />
                  )}
                </div>
                <div
                  className={`rounded-lg px-4 py-2 ${message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-purple-100 dark:bg-purple-900/30 text-gray-900 dark:text-white border border-purple-200 dark:border-purple-700'
                    }`}
                >
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

          <div ref={messagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConfigured ? `${character.name}に話しかけてください...` : "AI設定が必要です"}
              disabled={isLoading || !isConfigured}
              rows={2}
              className="flex-1 resize-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed font-['Noto_Sans_JP']"
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
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
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












