import React from 'react';
import { HelpCircle, BookOpen, Users, FileText, List, PenTool, Download, Layers, Sparkles } from 'lucide-react';
import { Step } from '../App';
import { Modal } from './common/Modal';

interface ContextHelpProps {
  step: Step;
  isOpen: boolean;
  onClose: () => void;
}

interface HelpContent {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    content: string | string[];
    icon?: React.ReactNode;
  }>;
  tips?: string[];
}

const helpContents: Record<Step, HelpContent> = {
  home: {
    title: 'ホームページ',
    description: 'プロジェクトの作成、管理、検索ができます。',
    sections: [
      {
        title: 'プロジェクトの作成',
        content: [
          '「新しいプロジェクトを作成」ボタンをクリック',
          'プロジェクトのタイトル、説明、ジャンルなどを入力',
          '表紙画像をアップロード（任意）',
        ],
        icon: <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        title: 'プロジェクトの管理',
        content: [
          'プロジェクトカードにマウスをホバーすると編集・複製・削除ボタンが表示されます',
          '検索バーでプロジェクトを検索',
          'ジャンルや更新日時でフィルタリング・ソート',
        ],
        icon: <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      },
    ],
    tips: [
      'Ctrl+N で新規プロジェクトを素早く作成できます',
      '最近使用したプロジェクトは上部に表示されます',
    ],
  },
  character: {
    title: 'キャラクター設計',
    description: '物語に登場するキャラクターの設定を行います。',
    sections: [
      {
        title: 'キャラクターの追加',
        content: [
          '「キャラクターを追加」ボタンをクリック',
          '名前、役割、外見、性格、背景を入力',
          'AI生成ボタンで自動生成も可能',
          '画像をアップロードして視覚的に管理',
        ],
        icon: <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />,
      },
      {
        title: 'AI生成機能',
        content: [
          'キャラクターの基本情報を入力後、「AIで補完」ボタンをクリック',
          'AIが背景や性格を自動生成します',
          '生成結果を確認して、必要に応じて編集',
        ],
        icon: <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
    ],
    tips: [
      '主要キャラクターは3〜5人程度が推奨です',
      'キャラクターの関係性は「ツール」サイドバーで管理できます',
    ],
  },
  plot1: {
    title: 'プロット基本設定',
    description: '物語の基本構造を設定します。',
    sections: [
      {
        title: '基本設定項目',
        content: [
          'テーマ: 物語の中心となるテーマ',
          '設定: 物語が展開される世界観や時代背景',
          'フック: 読者を引き込む導入部分',
          '主人公の目標: 主人公が達成したいこと',
          '主要な障害: 主人公が直面する困難',
        ],
        icon: <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      },
    ],
    tips: [
      '各項目を具体的に記入すると、後のステップでAIがより適切な提案を生成できます',
    ],
  },
  plot2: {
    title: 'プロット構成詳細',
    description: '物語の構造を詳細に設定します。',
    sections: [
      {
        title: '構成パターン',
        content: [
          '起承転結: 日本の伝統的な4部構成',
          '3幕構成: 導入・展開・結末の3部構成',
          '4幕構成: 秩序・混沌・秩序・混沌の4部構成',
        ],
        icon: <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        title: '各構成の入力',
        content: [
          '選択した構成パターンに応じて、各セクションの内容を入力',
          'AI生成ボタンで自動生成も可能',
        ],
        icon: <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      },
    ],
    tips: [
      '物語のジャンルに応じて適切な構成パターンを選択しましょう',
    ],
  },
  synopsis: {
    title: 'あらすじ作成',
    description: '物語全体のあらすじを作成します。',
    sections: [
      {
        title: 'あらすじの作成',
        content: [
          'これまでに設定したキャラクターとプロットを基に、物語全体のあらすじを作成',
          'AI生成ボタンで自動生成も可能',
          '500〜1000文字程度が推奨',
        ],
        icon: <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      },
    ],
    tips: [
      'あらすじは後で章立てや草案執筆の際に参照されます',
      '主要な展開や結末を含めると、一貫性のある物語になります',
    ],
  },
  chapter: {
    title: '章立て',
    description: '物語を章に分割し、各章の構成を設定します。',
    sections: [
      {
        title: '章の追加',
        content: [
          '「章を追加」ボタンをクリック',
          '章のタイトル、あらすじ、登場キャラクターなどを入力',
          '章の順序をドラッグ&ドロップで変更可能',
        ],
        icon: <List className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />,
      },
      {
        title: '章の詳細設定',
        content: [
          '各章に設定・雰囲気・重要な出来事を記入',
          'AI生成ボタンで章のあらすじを自動生成',
        ],
        icon: <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
    ],
    tips: [
      '章の数は物語の長さに応じて調整してください',
      '各章のあらすじを詳細に記入すると、草案執筆時にAIがより適切な内容を生成します',
    ],
  },
  draft: {
    title: '草案執筆',
    description: 'AI支援により、各章の草案を執筆します。',
    sections: [
      {
        title: '草案の生成',
        content: [
          '左側のタブから章を選択',
          '「AIで生成」ボタンをクリックして草案を生成',
          '生成された草案を確認し、必要に応じて編集',
        ],
        icon: <PenTool className="h-5 w-5 text-green-600 dark:text-green-400" />,
      },
      {
        title: 'AI機能',
        content: [
          '文章の改善提案',
          '選択したテキストの書き直し',
          '続きの生成',
          'カスタムプロンプトによる生成',
        ],
        icon: <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
    ],
    tips: [
      '生成された草案はあくまで参考です。自分の言葉で編集・改善してください',
      'Ctrl+Enter でAI生成を実行できます（エディタ内）',
      '履歴機能で過去のバージョンに戻れます',
    ],
  },
  export: {
    title: 'エクスポート',
    description: '完成した作品をエクスポートします。',
    sections: [
      {
        title: 'エクスポート形式',
        content: [
          'テキストファイル（.txt）',
          'Markdown形式（.md）',
          'プロジェクト全体のエクスポート（JSON）',
        ],
        icon: <Download className="h-5 w-5 text-orange-600 dark:text-orange-400" />,
      },
    ],
    tips: [
      'エクスポート前に必ず保存してください',
      'プロジェクト全体のエクスポートは、バックアップとしても使用できます',
    ],
  },
};

export const ContextHelp: React.FC<ContextHelpProps> = ({ step, isOpen, onClose }) => {

  if (!isOpen) return null;

  const content = helpContents[step];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
            <HelpCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="block text-xl font-bold">{content.title} - ヘルプ</span>
            <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">
              {content.description}
            </span>
          </div>
        </div>
      }
      size="lg"
    >
      {/* コンテンツ */}
      <div className="space-y-6">
        {content.sections.map((section, index) => (
          <div
            key={index}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5 border border-gray-200 dark:border-gray-600"
          >
            <div className="flex items-center space-x-3 mb-3">
              {section.icon}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                {section.title}
              </h3>
            </div>
            {Array.isArray(section.content) ? (
              <ul className="space-y-2 ml-8">
                {section.content.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] list-disc"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] ml-8">
                {section.content}
              </p>
            )}
          </div>
        ))}

        {content.tips && content.tips.length > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-5 border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200 font-['Noto_Sans_JP']">
                ヒント
              </h3>
            </div>
            <ul className="space-y-2 ml-7">
              {content.tips.map((tip, tipIndex) => (
                <li
                  key={tipIndex}
                  className="text-indigo-800 dark:text-indigo-200 font-['Noto_Sans_JP'] list-disc"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};
