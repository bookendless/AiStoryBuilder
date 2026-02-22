# AI Story Builder

<div align="center">

![AI Story Builder Logo](https://img.shields.io/badge/AI-Story%20Builder-6366f1?style=for-the-badge&logo=openai&logoColor=white)

**AIを活用した小説創作支援デスクトップアプリケーション**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white)](https://github.com/bookendless/aistorybuilder/releases)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FEC131?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app)

</div>

## 📖 概要

**AI Story Builder**は、最新のAI技術を活用して小説創作プロセス全体を支援する、作家のための統合環境です。
Windowsのデスクトップ環境に加え、Androidでも動作するクロスプラットフォーム設計を採用しています。

👉 **[📖 漫画でわかるAiStoryBuilder はこちら](漫画でわかるAiStoryBuilder.md)**

キャラクター設定、世界観構築、プロット作成から本文の執筆、校正に至るまで、AIがあなたの専属編集者として寄り添います。
プライバシーを重視したローカルファーストな設計により、大切な作品データはすべてあなたのデバイス内に安全に保存されます。

### 🎯 特徴

- **マルチモーダル創作**: テキストだけでなく、画像や音声からインスピレーションを得て物語を構築（Cloud AI使用時）
- **強力なAIモデル対応**: GPT-5.2, Grok 4.1, Gemini 3.0 Pro, Claude Opus 4 など、2026年最新の高性能モデルをサポート
- **プライバシー重視**: 作品データはローカル（IndexedDB）に保存され、設定により完全オフライン（Ollama等）でも動作可能
- **執筆特化UI**: 縦書き表示、集中力を高めるZenモード、ダークモードを完備
- **豊富なツール群**: 相関図、年表、用語集、伏線管理など、長編執筆に必要なツールを再度バーに集約

---

> **⚠️ 重要なご注意**
>
> このアプリケーションはAI技術を活用した開発手法（AI協働開発）により作成されています。そのため、制作者が意図しない挙動や仕様が生じる可能性がございます。ご利用の際は、予期せぬ動作が発生する場合があることをご理解いただき、ご容赦ください。

## ✨ 主な機能

### 🤖 AI支援と生成機能

| 機能カテゴリー | 詳細 |
| --- | --- |
| **物語生成** | **画像から物語**: 画像をアップロードして、視覚情報からストーリーを着想<br>**音声から物語**: 音声メモや録音データから物語の種を生成<br>**自動プロット**: 「四幕構成」「英雄の旅」等のフレームワークに基づいたプロット構築 |
| **キャラクター** | **自動生成**: テーマや役割から詳細なプロフィールを作成<br>**画像分析**: キャラクター立ち絵から外見描写文を生成<br>**憑依チャット**: 作成したキャラになりきったAIと対話し、口調や性格をシミュレーション |
| **執筆アシスト** | **続きを書く**: 文脈を理解して物語の続きを提案<br>**リライト**: 指定範囲の文体変更、描写強化、修正提案<br>**壁打ちチャット**: 創作上の悩みや設定の矛盾点をAI編集者に相談 |

### 🛠 創作管理ツール

- **クイックメモ**: アイデア、タスク、断片的なノートをタブ管理（自動保存）
- **ツールサイドバー**:
  - **用語集**: 固有名詞や独自設定のデータベース
  - **相関図**: キャラクター間の関係性を視覚化
  - **タイムライン**: 年表形式での出来事管理
  - **イメージボード**: 参考画像や生成画像のギャラリー
  - **伏線トラッカー**: 未回収の伏線をリスト管理
  - **感情マップ**: シーンごとの感情曲線をグラフ化

### 🖥 快適な執筆環境

- **縦書きエディタ**: 日本語小説ならではの縦書き表示に完全対応
- **Zenモード**: UI要素を隠し、執筆のみに没頭できるフルスクリーンモード
- **ダークモード**: 目に優しい配色で、長時間の執筆作業を軽減
- **レスポンシブデザイン**: デスクトップの大画面からモバイルまで最適化

## 🧠 対応AIプロバイダー (2026)

最新のLLM APIに対応し、用途に応じてモデルを切り替え可能です。

### クラウドAI (要APIキー)

| プロバイダー | 推奨モデル | 特徴 |
| --- | --- | --- |
| **OpenAI** | **GPT-5.2 (Thinking)**<br>**GPT-5.1 / Mini**<br>**o3/o4 Series** | 汎用性が高く、特に指示追従性能に優れています。<br>GPT-5.2は高度な推論と思考プロセスを持ち、複雑な設定の整合性チェックに最適です。 |
| **xAI (Grok)** | **Grok 4.1 Fast Reasoning**<br>**Grok 4 / 3**<br>**Grok Code Fast** | **[NEW]** 高速な推論と200万トークンの長文コンテキストが特徴。<br>エージェント挙動に優れ、プロット構築や長編の文脈維持に強力な威力を発揮します。 |
| **Anthropic** | **Claude Opus 4**<br>**Claude Sonnet 4.5** | 自然で文学的な日本語表現と、長文入力時の高い安定性を誇ります。<br>小説の文体模写や繊細な感情描写に定評があります。 |
| **Google** | **Gemini 3.0 Pro**<br>**Gemini 2.5 Pro / Flash** | マルチモーダル（画像・音声・動画）処理能力が最強。<br>大量の資料読み込みや、メディアミックス的な創作活動に適しています。 |

### ローカルAI (オフライン)

- **Ollama / LM Studio**: OpenAI互換のローカルサーバーを指定することで、インターネット接続なしでAI支援を利用可能。
  - プライバシーを最優先したい場合や、通信環境がない場所に最適です。

> 各モデルのAPIキー設定やモデル選択は、アプリ内の「設定」アイコンからいつでも変更可能です。

## 🚀 インストールと起動

### 一般ユーザーの方

1. [リリースページ](https://github.com/bookendless/aistorybuilder/releases)にアクセスします。
2. 最新のインストーラー（Windowsの場合は `.exe`）をダウンロードします。
3. インストーラーを実行し、画面の指示に従ってインストールしてください。
4. アプリ起動後、設定画面からお好みのAIプロバイダーのAPIキーを入力して利用開始します。

### 開発者の方（ソースコードからの実行）

#### 前提条件

- Node.js (v20以上推奨)
- Rust (Tauriのビルドに必要)

```bash
# リポジトリのクローン
git clone https://github.com/bookendless/aistorybuilder.git
cd aistorybuilder

# 依存関係のインストール
npm install

# 開発サーバーの起動（ブラウザモード - Rust不要でUI開発可能）
npm run dev

# デスクトップアプリとして開発モード起動（Tauri）
npm run tauri:dev
```

## 🛠 技術スタック

本プロジェクトは以下の技術で構築されています：

- **Core**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Desktop Framework**: [Tauri v2](https://tauri.app/) (Rust backend)
- **Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Integration**: OpenAI SDK, Google Generative AI SDK, Anthropic SDK (Axios)

## 🤝 貢献について

バグ報告、機能要望、プルリクエストを歓迎します！
開発の詳細については [DEV_GUIDE.md](DEV_GUIDE.md) をご覧ください。

## 📄 ライセンス

[MIT License](LICENSE)

---

## Author's Intention / 作者の意図

本ソフトウェアは MITライセンスの下で公開しています。  
ただし作者の意図としては、教育・研究・趣味などの **非営利利用** を主な目的としています。  
**再配布は歓迎しますが、有料での販売はご遠慮ください。**

This software is released under the MIT License.  
However, the author intends this project to be used mainly for **non-commercial purposes** such as education, research, and personal hobbies.  
**Redistribution is welcome, but please refrain from selling it for a fee.**
