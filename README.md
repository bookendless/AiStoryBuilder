# AI Story Builder

<div align="center">

![AI Story Builder Logo](https://img.shields.io/badge/AI-Story%20Builder-6366f1?style=for-the-badge&logo=openai&logoColor=white)

**AIを活用した小説創作支援アプリケーション**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square)](https://github.com/your-username/ai-story-builder)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

[デモを見る](https://your-demo-url.com) • [問題を報告](https://github.com/your-username/ai-story-builder/issues)

</div>

## 📖 概要

AI Story Builderは、AI技術を活用して小説創作を支援するアプリケーションです。キャラクター設定から物語の執筆まで、AIが一貫してサポートします。初心者から上級者まで、誰でも簡単に魅力的な小説を作成できます。

## ✨ 主な機能

### 🤖 AI支援創作
- **キャラクター生成**: テーマに基づいた魅力的なキャラクターを自動作成
- **プロット構築**: 起承転結から三幕構成まで、物語の骨格をAIが提案
- **あらすじ作成**: 設定した情報を基に魅力的なあらすじを自動生成
- **執筆支援**: 章ごとの詳細な執筆をAIがサポート

### 🎨 使いやすいインターフェース
- **直感的な操作**: ステップバイステップで物語を構築
- **ダークモード対応**: 目に優しいテーマで長時間の作業も快適
- **レスポンシブデザイン**: デスクトップからモバイルまで完全対応
- **リアルタイム保存**: 作業内容が自動的に保存される

### 🔒 プライバシー重視
- **完全オフライン動作**: インターネット接続不要で動作
- **データ保護**: あなたの作品はすべてローカルに保存
- **APIキー不要**: ローカルAIを使用するため外部サービスへの送信なし
- **セキュア**: データが外部に送信されることは一切ありません

## 🚀 簡単スタート

### 1. 必要なソフトウェアをインストール

**Node.js**（必須）
- [Node.js公式サイト](https://nodejs.org/)からダウンロード
- バージョン18以上を選択

**LM Studio**（AI用）
- [LM Studio公式サイト](https://lmstudio.ai/)からダウンロード
- Windows、macOS、Linux対応

### 2. アプリケーションをダウンロード・セットアップ

```bash
# このリポジトリをダウンロード
git clone https://github.com/bookendless/aistorybuilder.git
cd ai-story-builder

# 自動セットアップ（推奨）
npm run quick-start
```

### 3. ローカルAIを設定

1. **LM Studio を起動**
2. **モデルをダウンロード**（推奨：Llama 3.1 8B）
3. **APIサーバーを開始**（「Local Server」タブで「Start Server」）

### 4. アプリケーションを起動

```bash
# アプリケーションを起動
npm run dev:local
```

ブラウザで `http://localhost:5173` にアクセスして使用開始！


## 📚 使い方

### 基本的な流れ

1. **プロジェクト作成**
   - テーマ、ジャンル、ターゲット読者を設定

2. **キャラクター設定**
   - 主要キャラクターをAI支援で作成
   - 外見、性格、背景を詳細に設定

3. **プロット構築**
   - 物語の構造を選択（起承転結、三幕構成等）
   - AIが魅力的なプロットを提案

4. **あらすじ作成**
   - 設定した情報を基にAIがあらすじを生成
   - 必要に応じて手動で調整

5. **章立て構成**
   - 物語の長さに応じた章構成を提案
   - 各章の概要を設定

6. **執筆支援**
   - 章ごとにAIが執筆をサポート
   - 文体の統一と一貫性を維持

## 🛠️ トラブルシューティング

### よくある問題

**Q: アプリケーションが起動しない**
A: Node.jsが正しくインストールされているか確認してください

**Q: AIが応答しない**
A: LM StudioのAPIサーバーが起動しているか確認してください

**Q: 日本語の応答が不自然**
A: より高性能なモデル（Llama 3.1 70B等）の使用を検討してください

**Q: 動作が遅い**
A: より軽量なモデル（Mistral 7B等）の使用を検討してください


## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

- [LM Studio](https://lmstudio.ai/) - ローカルLLM環境
- [Ollama](https://ollama.ai/) - ローカルLLM環境
- [React](https://reactjs.org/) - UIライブラリ
- [Vite](https://vitejs.dev/) - ビルドツール

---

<div align="center">

**AI Story Builder** で、あなたの創造性を解き放ちましょう！

[![Star](https://img.shields.io/github/stars/your-username/ai-story-builder?style=social)](https://github.com/your-username/ai-story-builder)
[![Fork](https://img.shields.io/github/forks/your-username/ai-story-builder?style=social)](https://github.com/your-username/ai-story-builder/fork)

</div>
