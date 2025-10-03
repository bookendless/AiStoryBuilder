# AI Story Builder

<div align="center">

![AI Story Builder Logo](https://img.shields.io/badge/AI-Story%20Builder-6366f1?style=for-the-badge&logo=openai&logoColor=white)

**AIを活用した小説創作支援デスクトップアプリケーション**


[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white)](https://github.com/bookendless/aistorybuilder/releases)



</div>

## 📖 概要

AI Story Builderは、AI技術を活用して小説創作を支援するデスクトップアプリケーションです。キャラクター設定から物語の執筆まで、AIが一貫してサポートします。初心者から上級者まで、誰でも簡単に魅力的な小説を作成できます。

**🎯 デスクトップアプリとしての利点**
- **依存関係のインストール不要**: ダウンロードしてすぐに使用可能
- **高性能**: ネイティブアプリとして高速動作
- **プライバシー**: データはローカルに保存
- **オフライン対応**: ローカルLLMで完全オフライン利用可能
- **使いやすさ**: ブラウザ不要、直感的な操作

> **⚠️ 重要なご注意**
> 
> このアプリケーションはAI技術を活用した開発手法（AI協働開発）により作成されています。そのため、制作者が意図しない挙動や仕様が生じる可能性がございます。ご利用の際は、予期せぬ動作が発生する場合があることをご理解いただき、ご容赦ください。

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
- **ローカル基盤**: 基本機能はローカル環境で動作
- **データ保護**: あなたの作品はすべてローカルに保存
- **柔軟なAI選択**: ローカルLLMとクラウドAIを用途に応じて使い分け
- **セキュア**: データの管理を完全にコントロール

## 🚀 簡単スタート

### 📱 デスクトップアプリの使用（推奨）

**1. アプリケーションのダウンロード**
1. [リリースページ](https://github.com/bookendless/aistorybuilder/releases)から最新版をダウンロード
2. **Windows**での利用が可能です：
   - `ai-story-builder_*.exe`
   - その他のプラットフォームは開発中

**2. アプリケーションの起動**
- ダウンロードしたファイルを実行
- 初回起動時にセキュリティ警告が表示される場合がありますが、問題ありません

**3. ローカルAIの設定（オプション）**
AI補助機能を使用する場合は、ローカルAIを設定してください：

**LM Studio を使用する場合:**
1. [LM Studio](https://lmstudio.ai/)をダウンロード・インストール
2. モデルをダウンロード（推奨：Llama 3.1 8B）
3. 「Developer」タブで「Start Server(Status:Running)」をクリック

**4. クラウドAIの設定（オプション）**
高度な処理（草案執筆等）にはクラウドAIの使用を推奨します：
1. アプリケーションの「設定」メニューを開く
2. APIキーを入力：
   - OpenAI API Key
   - Claude API Key
   - Gemini API Key

## 📚 使い方

### 基本的な流れ

1. **プロジェクト作成**
   - テーマ、ジャンル、ターゲット読者を設定

2. **キャラクター設定**
   - 主要キャラクターを作成
   - AIにキャラクターを提案してもらう
   - 外見、性格、背景を詳細に設定

3. **プロット構築**
   - 物語の構造を選択（起承転結、三幕構成等）
   - AIが魅力的なプロットを提案

4. **あらすじ作成**
   - 設定した情報を基にAIがあらすじを生成

5. **章立て構成**
   - 物語の長さに応じた章構成を提案
   - 各章の概要を設定

6. **執筆支援**
   - 章ごとにAIが執筆をサポート
   - ローカルLLM：基本的な執筆支援
   - クラウドAI：高度な草案生成（推奨）
   - 文体の統一と一貫性を維持

## 🛠️ トラブルシューティング

### よくある問題

**Q: デスクトップアプリが起動しない**
A: 以下の点を確認してください：
- セキュリティソフトがブロックしていないか確認
- Windows Defenderで許可設定を行う
- 管理者権限で実行してみる
- 再ダウンロード・再インストールを試す

**Q: AIが応答しない**
A: 設定を確認してください：
- ローカルLLMの場合はLM StudioのAPIサーバーが起動しているか
- クラウドAIの場合はAPIキーが正しく設定されているか
- インターネット接続があるか（クラウドAI使用時）

**Q: データが保存されない**
A: 以下の点を確認してください：
- アプリケーションのデータ保存先に書き込み権限があるか
- ディスク容量が十分あるか
- アプリケーションを正常に終了しているか

**Q: 日本語の応答が不自然**
A: より高性能なモデルの使用を検討してください：
- ローカルLLM: Llama 3.1 70B等の高品質モデル
- クラウドAI: GPT-4、Claude 3.5 Sonnet等

**Q: 動作が遅い**
A: 以下の方法を試してください：
- ローカルLLM: より軽量なモデル（Mistral 7B等）を使用
- クラウドAI: ネットワーク状況を確認
- システムリソース: 他のアプリケーションを終了

**Q: どのAIを使えばいいですか？**
A: 用途に応じて使い分けてください：
- **基本機能**: ローカルLLM（キャラクター生成、プロット構築等）
- **高度な処理**: クラウドAI（草案執筆、詳細な文章作成等）


## 📄 ライセンス

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
