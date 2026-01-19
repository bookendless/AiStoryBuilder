import React from 'react';
import { HelpCircle, BookOpen, Users, FileText, List, PenTool, Download, Layers, Sparkles } from 'lucide-react';
import { Step } from '../App';
import { Modal } from './common/Modal';
import { useOverlayBackHandler } from '../contexts/BackButtonContext';

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
        title: 'AI機能によるプロジェクト作成',
        content: [
          '「画像から物語を作る」ボタンで画像をアップロードすると、AIが画像を分析して物語の提案（タイトル、あらすじ、キャラクター、プロットなど）を生成します',
          '「音声から物語を作る」ボタンで音声ファイルをアップロードすると、AIが音声を文字起こしして物語の提案を生成します',
          '生成された提案を確認し、必要に応じて編集してからプロジェクトを作成できます',
          '※ これらの機能はクラウドAI（OpenAI/Claude/Gemini）設定時のみ利用可能です',
        ],
        icon: <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
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
          '名前、役割、外見、性格、背景、口調をモーダルに入力',
          'キャラクターカード上で直接編集も可能',
          '画像をアップロードして視覚的に管理',
        ],
        icon: <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />,
      },
      {
        title: 'AI生成機能',
        content: [
          'キャラクターの基本情報（名前、役割など）を入力後、「AIで補完」ボタンをクリック',
          'AIが背景や性格を自動生成します',
          '画像をアップロードすると、AIが画像を分析してキャラクターの外見描写や性格を推測し、プロフィールに反映します（クラウドAI設定時のみ）',
          '右側のツールサイドバー「支援」タブから、キャラクターアシスタントパネルを利用してキャラクターを自動生成できます',
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
          '結末: 物語の最後の局面',
        ],
        icon: <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      },
      {
        title: 'AI生成機能',
        content: [
          '各フィールド（テーマ、設定、フック、主人公の目標、主要な障害、結末）の横にあるAI生成ボタンをクリック',
          'AIが各項目の内容を自動生成します',
          '既に入力済みの内容を参考に、関連性のある提案を生成します',
          '右側のツールサイドバー「支援」タブから、プロット基本設定アシスタントパネルを利用して一括生成できます',
          '生成結果を確認して、必要に応じて編集',
        ],
        icon: <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
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
          'ヒーローズ・ジャーニー: 主人公の成長と冒険を12段階で描く構成（日常世界→試練→変容→帰還）',
          'ビートシート: 15のビート（拍）で物語のリズムと転換点を明確にする構成',
          'ミステリー・サスペンス構成: 謎の提示→調査→手がかりの発見→真実の暴露という構成',
        ],
        icon: <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        title: '各構成の入力',
        content: [
          '選択した構成パターンに応じて、各セクションの内容を入力',
          '各セクションの横にあるAI生成ボタンをクリックすると、そのセクションの内容を自動生成します',
          '右側のツールサイドバー「支援」タブから、プロット構成詳細アシスタントパネルを利用して構成の一括が生成できます',
          '生成結果を確認して、必要に応じて編集',
        ],
        icon: <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      },
    ],
    tips: [
      '物語のジャンルに応じて適切な構成パターンを選択しましょう',
      '冒険・ファンタジー系にはヒーローズ・ジャーニーが適しています',
      '映画脚本や商業小説にはビートシートが効果的です',
      '推理小説やサスペンスにはミステリー・サスペンス構成が最適です',
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
          '「AIで生成」ボタンをクリックすると、設定済みの情報から物語全体のあらすじを自動生成します',
          '右側のツールサイドバー「支援」タブから、あらすじアシスタントパネルを利用してあらすじの生成・改善ができます',
          '500〜1000文字程度が推奨',
          '生成結果を確認して、必要に応じて編集',
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
          '章の編集画面で「AIで生成」ボタンをクリックすると、章のあらすじを自動生成します',
          '右側のツールサイドバー「支援」タブから、章アシスタントパネルを利用して章の詳細設定やあらすじの生成・改善ができます',
          '生成結果を確認して、必要に応じて編集',
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
          '草案の生成: 「AIで生成」ボタンで章の草案を一括生成',
          '文章の改善提案: 選択したテキストを改善する提案を受けられます',
          '選択したテキストの書き直し: 選択範囲を指定して書き直しを生成',
          '続きの生成: 現在の文章の続きを自動生成',
          'カスタムプロンプトによる生成: 独自の指示を入力して生成',
          '右側のツールサイドバー「支援」タブから、草案アシスタントパネルを利用して様々なAI機能にアクセスできます',
          '全章一括生成機能で、すべての章の草案を一度に生成することも可能です',
        ],
        icon: <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
    ],
    tips: [
      '生成された草案はあくまで参考です。自分の言葉で編集・改善してください',
      '履歴機能で過去のバージョンに戻れます',
    ],
  },
  review: {
    title: '作品評価',
    description: 'AIを使って作品を多角的に分析・評価し、改善点を見つけます。',
    sections: [
      {
        title: '評価モード',
        content: [
          '構造・プロット: AIが物語の構成、一貫性、ペース配分を分析します',
          'キャラクター: AIがキャラクターの動機、成長、独自性を評価します',
          '文体・表現: AIが文章の読みやすさ、描写力、五感表現をチェックします',
          '読者ペルソナ: AIが想定読者になりきって感想と市場性を評価します',
          '評価対象（あらすじ、章、カスタムテキスト）を選択して、各モードで評価を実行',
          '評価結果は詳細な分析レポートとして表示され、改善提案も含まれます',
        ],
        icon: <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        title: '評価対象の選択',
        content: [
          'あらすじ: プロジェクトのあらすじを評価',
          '章: 特定の章の草案を評価',
          'カスタム: 任意のテキストを評価',
        ],
        icon: <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      },
      {
        title: '評価結果の活用',
        content: [
          '評価結果をプロジェクトに保存して履歴として管理',
          'Markdown形式でエクスポートして外部で参照',
          '改善提案を参考に作品をブラッシュアップ',
        ],
        icon: <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />,
      },
    ],
    tips: [
      '複数のモードで評価することで、より多角的な分析ができます',
      '評価履歴を保存しておくと、改善の進捗を確認できます',
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
  // Android戻るボタン対応
  useOverlayBackHandler(isOpen, onClose, 'context-help-modal', 80);

  if (!isOpen) return null;

  const content = helpContents[step];

  // ヘルプコンテンツが存在しない場合のフォールバック
  if (!content) {
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
              <span className="block text-xl font-bold">ヘルプ</span>
              <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">
                このステップのヘルプ情報は準備中です
              </span>
            </div>
          </div>
        }
        size="lg"
      >
        <div className="p-6 text-center text-gray-600 dark:text-gray-400">
          <p>このステップ（{step}）のヘルプ情報はまだ利用できません。</p>
        </div>
      </Modal>
    );
  }

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
