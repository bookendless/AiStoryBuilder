# AI Story Builder

<div align="center">

![AI Story Builder Logo](https://img.shields.io/badge/AI-Story%20Builder-6366f1?style=for-the-badge&logo=openai&logoColor=white)

**AIを活用した小説創作支援デスクトップアプリケーション**


[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white)](https://github.com/bookendless/aistorybuilder/releases)

</div>

## 📖 概要

AI Story Builderは、AI技術を活用して小説創作を支援するアプリケーションです。デスクトップ（Windows/macOS/Linux）とAndroidで動作します。キャラクター設定から物語の執筆まで、AIが一貫してサポートします。初心者から上級者まで、誰でも簡単に魅力的な小説を作成できます。

**🎯 アプリとしての利点**
- **依存関係のインストール不要**: ダウンロードしてすぐに使用可能（デスクトップ版）
- **高性能**: ネイティブアプリとして高速動作
- **プライバシー**: データはローカルに保存
- **オフライン対応**: ローカルLLMで完全オフライン利用可能
- **使いやすさ**: ブラウザ不要、直感的な操作
- **クロスプラットフォーム**: デスクトップとAndroidで同じ機能を利用可能

> **⚠️ 重要なご注意**
> 
> このアプリケーションはAI技術を活用した開発手法（AI協働開発）により作成されています。そのため、制作者が意図しない挙動や仕様が生じる可能性がございます。ご利用の際は、予期せぬ動作が発生する場合があることをご理解いただき、ご容赦ください。

## ✨ 主な機能

### 🤖 AI支援創作
- **画像から物語を作る**: 画像をアップロードすると、AIが画像を分析して物語の提案を生成（Cloud AI対応）
- **音声から物語を作る**: 音声ファイルをアップロードすると、AIが音声を文字起こしして物語の提案を生成（Cloud AI対応）
- **キャラクター生成**: テーマに基づいた魅力的なキャラクターを自動作成
- **画像分析 (Cloud AI)**: キャラクター画像を分析して描写を生成
- **プロット構築**: 起承転結から三幕構成まで、物語の骨格をAIが提案
- **あらすじ作成**: 設定した情報を基に魅力的なあらすじを自動生成
- **執筆支援**: 続きを書く、リライト、トーン変更など、執筆を強力にサポート
- **キャラクター憑依チャット**: 作成したキャラクターになりきったAIと会話して、性格や口調をシミュレーション
- **AIアシスタント**: チャット形式で創作の相談や設定の整合性チェックが可能

### 🎨 使いやすいインターフェース
- **直感的な操作**: ステップバイステップで物語を構築
- **縦書きモード**: 日本語小説に最適な縦書き表示に対応
- **Zenモード**: 執筆に集中できる没入型モード
- **ツールサイドバー**: 右側のツールサイドバーから、ステップごとのAI支援や各種ツール（用語集、相関図、タイムライン、イメージボード、伏線トラッカー、感情マップなど）に素早くアクセス
- **クイックメモ**: アイデア、タスク、ノートを3つのタブで分けて記録（自動保存）
- **ダークモード対応**: 目に優しいテーマで長時間の作業も快適

### 🔒 プライバシー重視
- **ローカル基盤**: 基本機能はローカル環境で動作
- **データ保護**: あなたの作品はすべてローカルに保存
- **柔軟なAI選択**: ローカルLLM (Ollama) とクラウドAI (OpenAI/Claude/Gemini) を用途に応じて使い分け

## ☁️ クラウドAI API対応状況

| プロバイダー | 推奨モデル | 特徴 |
| --- | --- | --- |
| **OpenAI GPT** | GPT-5.1 / GPT-5.1 Mini / GPT-4.1 / GPT-4.1 Mini / GPT-4o / o4-mini / o3-pro / o1 | 最新のResponses APIに対応。GPT-5.1系、マルチモーダル（画像・音声）、Reasoning系（o1/o3/o4）をサポート。最大20万トークン。 |
| **Anthropic Claude** | Claude Opus 4 / Claude Sonnet 4.5 / Claude Haiku 4.5 / Claude 3.5 Haiku | Claude 4/4.5ファミリー。長文処理（最大20万トークン）と整合性チェックに強み。Messages API対応。 |
| **Google Gemini** | Gemini 3.0 Pro (Preview) / Gemini 2.5 Pro / Gemini 2.5 Flash | 最大200万トークンの超長文コンテキスト。画像・音声・動画・PDF入力に対応。思考モード・コード実行も可能。 |
| **ローカルLLM** | 任意のOpenAI互換モデル | LM Studio や Ollama を経由して完全オフラインで利用可能。 |

### 主要モデルの詳細

#### OpenAI GPT
- **GPT-5.1 / GPT-5.1 Mini**: 最新世代の汎用マルチモーダルモデル（2025年リリース）。画像・音声入力、ツール呼び出し、高度推論に対応。
- **GPT-4.1 / GPT-4.1 Mini**: 高速マルチモーダルモデル。日常的な生成タスクに最適。
- **o4-mini / o3-pro / o3-mini / o1 / o1-mini**: Reasoning系モデル。推論タスクや整合性チェックに特化。

#### Anthropic Claude
- **Claude Opus 4**: 2025年11月リリース。Anthropic史上最も賢いモデル。高度推論・エージェント機能に対応。
- **Claude Sonnet 4.5**: 2025年9月リリース。日常的な執筆の主力モデル。
- **Claude Haiku 4.5**: 2025年10月リリース。高速でコスト効率に優れたモデル。

#### Google Gemini
- **Gemini 3.0 Pro (Preview)**: 2025年11月リリース。最高性能のマルチモーダルモデル。動画・音声・PDF・思考モード・コード実行に対応。
- **Gemini 2.5 Pro**: 最大200万トークン対応。長期プロジェクトの統合管理に最適。
- **Gemini 2.5 Flash**: 高速でコスト効率に優れたモデル。画像分析付きキャラクター補完に最適。

> 各モデルの詳細な機能、最大トークン数、推奨ユースケースは、アプリ内「AI設定」モーダルで確認できます。

## 📚 ドキュメント

詳細な情報は以下のドキュメントをご覧ください：

- **[ユーザーガイド (USER_GUIDE.md)](USER_GUIDE.md)** - 詳しい使い方や機能説明
- **[機能一覧 (FEATURES.md)](FEATURES.md)** - 全機能の詳細なリスト
- **[よくある質問 (FAQ.md)](FAQ.md)** - Q&Aとトラブルシューティング

## 🚀 簡単スタート

### 📱 デスクトップアプリの使用（推奨）

**1. アプリケーションのダウンロード**
1. [リリースページ](https://github.com/bookendless/aistorybuilder/releases)から最新版をダウンロード
2. **Windows**での利用が可能です：
   - `ai-story-builder_*.exe`

**2. アプリケーションの起動**
- ダウンロードしたファイルを実行
- 初回起動時にセキュリティ警告が表示される場合がありますが、問題ありません

**3. AIの設定**
- **ローカルAI (Ollama)**: プライバシー重視、オフライン利用
- **クラウドAI (OpenAI/Claude/Gemini)**: 高度な推論、画像分析、音声認識機能

**4. プロジェクトの作成**
ホーム画面から以下の方法でプロジェクトを作成できます：
- **画像から物語を作る**: 画像をアップロードしてAIが物語提案を生成（クラウドAI必要）
- **音声から物語を作る**: 音声ファイルをアップロードしてAIが物語提案を生成（クラウドAI必要）
- **新規プロジェクトを作成**: 手動でプロジェクト情報を入力

## 👨‍💻 開発者向け情報

### 📚 開発ガイド

- **[🚀 クイックスタート (QUICKSTART.md)](QUICKSTART.md)** - すぐに開発を始めたい方向け
- **[開発環境ガイド (DEV_GUIDE.md)](DEV_GUIDE.md)** - 開発環境でのセットアップと動作について
- **[Tauriセットアップガイド (TAURI_SETUP.md)](TAURI_SETUP.md)** - Tauriアプリケーションのビルドとデプロイ

**開発モードの起動:**
```bash
# ブラウザ環境での開発（推奨 - Rust不要）
npm run dev

# Tauri環境での開発（デスクトップ、Rustインストール必要）
npm run tauri:dev

# Android環境での開発（Android SDK、NDKが必要）
npm run tauri:dev:android
```

##  ライセンス

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author's Intention / 作者の意図
本ソフトウェアは MITライセンスの下で公開しています。  
ただし作者の意図としては、教育・研究・趣味などの **非営利利用** を主な目的としています。  
**再配布は歓迎しますが、有料での販売はご遠慮ください。**

This software is released under the MIT License.  
However, the author intends this project to be used mainly for **non-commercial purposes** such as education, research, and personal hobbies.  
**Redistribution is welcome, but please refrain from selling it for a fee.**

## 🙏 謝辞

- [OpenAI](https://openai.com/) - GPT API
- [Anthropic](https://anthropic.com/) - Claude API
- [Google](https://ai.google.dev/) - Gemini API
- [Ollama](https://ollama.ai/) - ローカルLLM環境
- [React](https://reactjs.org/) - UIライブラリ
- [Vite](https://vitejs.dev/) - ビルドツール
- [Tauri](https://tauri.app/) - デスクトップアプリフレームワーク

---

<div align="center">

**AI Story Builder** で、あなたの創造性を解き放ちましょう！

[![Star](https://img.shields.io/github/stars/bookendless/aistorybuilder?style=social)](https://github.com/bookendless/aistorybuilder)
[![Fork](https://img.shields.io/github/forks/bookendless/aistorybuilder?style=social)](https://github.com/bookendless/aistorybuilder/fork)

</div>
