# ローカル環境セットアップガイド

AI Story BuilderをローカルLLM環境で動作させるための詳細な手順を説明します。

## 📋 目次

- [前提条件](#前提条件)
- [ローカルLLM環境の選択](#ローカルllm環境の選択)
- [LM Studio を使用する場合](#lm-studio-を使用する場合)
- [Ollama を使用する場合](#ollama-を使用する場合)
- [その他のローカルLLM](#その他のローカルllm)
- [アプリケーションの起動](#アプリケーションの起動)
- [トラブルシューティング](#トラブルシューティング)
- [パフォーマンス最適化](#パフォーマンス最適化)

## 前提条件

- **Node.js**: 18.0.0以上
- **npm**: 8.0.0以上
- **Git**: 2.0.0以上
- **メモリ**: 8GB以上（推奨16GB以上）
- **ストレージ**: 10GB以上の空き容量

## ローカルLLM環境の選択

以下のローカルLLM環境から選択できます：

| 環境 | 難易度 | メモリ使用量 | 推奨度 | 特徴 |
|------|--------|--------------|--------|------|
| **LM Studio** | ⭐ | 4-8GB | ⭐⭐⭐⭐⭐ | GUI、簡単設定、Windows/macOS/Linux対応 |
| **Ollama** | ⭐⭐ | 4-8GB | ⭐⭐⭐⭐ | コマンドライン、軽量、クロスプラットフォーム |
| **Text Generation WebUI** | ⭐⭐⭐ | 6-12GB | ⭐⭐⭐ | 高機能、カスタマイズ性高 |
| **LocalAI** | ⭐⭐⭐⭐ | 4-8GB | ⭐⭐ | Docker、複数モデル対応 |

## LM Studio を使用する場合

### 1. LM Studio のインストール

1. [LM Studio公式サイト](https://lmstudio.ai/)にアクセス
2. お使いのOSに合わせてダウンロード
3. インストーラーを実行してインストール

### 2. モデルのダウンロード

1. LM Studio を起動
2. 「Discover」タブでモデルを検索
3. 推奨モデルをダウンロード：

**推奨モデル（日本語対応）:**
- **Llama 3.1 8B Instruct** - バランス型、8GB RAM
- **CodeLlama 7B Instruct** - コード生成特化
- **Mistral 7B Instruct** - 軽量で高性能
- **Qwen2 7B Instruct** - 多言語対応

**高品質モデル（16GB+ RAM推奨）:**
- **Llama 3.1 70B Instruct** - 最高品質
- **Mixtral 8x7B Instruct** - 高性能

### 3. APIサーバーの起動

1. ダウンロードしたモデルを選択
2. 「Local Server」タブを開く
3. 設定を確認：
   - **Port**: 1234（デフォルト）
   - **Context Length**: 4096以上
   - **GPU Acceleration**: 利用可能な場合ON
4. 「Start Server」をクリック
5. サーバーが起動したら「Server is running」と表示される

### 4. 接続テスト

```bash
# アプリケーションのディレクトリで実行
npm run check:local
```

## Ollama を使用する場合

### 1. Ollama のインストール

#### Windows
1. [Ollama公式サイト](https://ollama.ai/download)からダウンロード
2. インストーラーを実行

#### macOS/Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. モデルのダウンロード

```bash
# 推奨モデル（8GB RAM）
ollama pull llama3.1:8b
ollama pull codellama:7b
ollama pull mistral:7b

# 高品質モデル（16GB+ RAM）
ollama pull llama3.1:70b
ollama pull mixtral:8x7b
```

### 3. APIサーバーの起動

```bash
# バックグラウンドで起動
ollama serve

# または、特定のモデルで起動
ollama run llama3.1:8b
```

### 4. 環境変数の設定

`.env.local`ファイルでエンドポイントを設定：

```env
VITE_LOCAL_LLM_ENDPOINT=http://localhost:11434/v1/chat/completions
```

## その他のローカルLLM

### Text Generation WebUI

1. [Text Generation WebUI](https://github.com/oobabooga/text-generation-webui)をクローン
2. セットアップスクリプトを実行
3. モデルをダウンロード・ロード
4. APIモードで起動

### LocalAI

1. Dockerをインストール
2. LocalAIコンテナを起動
3. モデルを設定

## アプリケーションの起動

### 1. プロジェクトのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/your-username/ai-story-builder.git
cd ai-story-builder

# 依存関係をインストール
npm install

# ローカル環境をセットアップ
npm run setup:local
```

### 2. ローカルLLMサーバーの起動

選択したローカルLLM環境でサーバーを起動

### 3. 接続確認

```bash
# ローカルLLMサーバーへの接続をテスト
npm run check:local
```

### 4. アプリケーションの起動

```bash
# ローカルモードで起動
npm run dev:local
```

ブラウザで `http://localhost:5173` にアクセス

## トラブルシューティング

### よくある問題と解決方法

#### 1. 接続エラー（ECONNREFUSED）

**原因**: ローカルLLMサーバーが起動していない

**解決方法**:
```bash
# LM Studioの場合
# GUIで「Start Server」をクリック

# Ollamaの場合
ollama serve

# プロセス確認
netstat -an | grep :1234  # LM Studio
netstat -an | grep :11434 # Ollama
```

#### 2. CORS エラー

**原因**: ブラウザのCORS制限

**解決方法**:
- Viteの設定でCORSが有効になっているか確認
- ローカルLLMサーバーでCORS設定を確認

#### 3. メモリ不足エラー

**原因**: モデルが大きすぎる、RAM不足

**解決方法**:
- より小さなモデルを使用
- システムのメモリを増設
- 他のアプリケーションを終了

#### 4. 応答が遅い

**原因**: モデルサイズ、CPU/GPU性能

**解決方法**:
- GPU加速を有効化
- より軽量なモデルを使用
- プロンプト長を短縮

#### 5. 日本語の応答が不自然

**原因**: モデルの言語設定

**解決方法**:
- 日本語特化モデルを使用
- プロンプトに「日本語で回答してください」を追加
- システムプロンプトを調整

### ログの確認

```bash
# アプリケーションのログ
npm run dev:local

# ブラウザの開発者ツール
# Console タブでエラーメッセージを確認

# ローカルLLMサーバーのログ
# LM Studio: GUIのログ表示
# Ollama: ターミナルの出力
```

## パフォーマンス最適化

### 1. ハードウェア最適化

- **GPU使用**: CUDA対応GPUで大幅に高速化
- **メモリ**: 16GB以上推奨
- **SSD**: モデル読み込み速度向上

### 2. モデル選択

- **軽量モデル**: 4-8GB RAM、高速応答
- **高品質モデル**: 16GB+ RAM、高品質応答
- **量子化モデル**: メモリ使用量削減

### 3. 設定最適化

```env
# .env.local での最適化設定
VITE_MAX_PROMPT_LENGTH=2000  # プロンプト長制限
VITE_DEBUG_MODE=false        # 本番モード
```

### 4. アプリケーション設定

- **温度設定**: 0.7-0.9（創造性と一貫性のバランス）
- **最大トークン数**: 1000-2000（応答速度と品質のバランス）
- **プロンプト最適化**: 簡潔で明確な指示

## サポート

問題が解決しない場合は：

1. [GitHub Issues](https://github.com/bookendless/ai-story-builder/issues)で報告
2. ログファイルとエラーメッセージを添付
3. 使用しているローカルLLM環境とモデルを明記

---

**注意**: ローカルLLMの性能は使用するモデルとハードウェアに大きく依存します。初回使用時は軽量モデルから始めることをお勧めします。
