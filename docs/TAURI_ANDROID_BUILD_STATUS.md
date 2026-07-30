# Tauri Android ビルド手順

Android 版 AI Story Builder（Tauri 2 系）のビルド手順・前提環境・トラブルシューティングをまとめたドキュメントです。

## ⚠️ 最初に：コマンドの語順に注意

Tauri CLI のモバイル系コマンドは **`android` が先、`build` / `dev` が後** です。

```bash
# ❌ 誤り（デスクトップビルド扱いになり、android が cargo に渡されて失敗する）
npm run tauri build android
#   → error: unexpected argument 'android' found
#   → failed to build app: failed to build app

# ✅ 正しい（npm スクリプト経由）
npm run tauri:build:android

# ✅ 正しい（tauri パススルー経由。npm に引数を渡すため `--` が必須）
npm run tauri -- android build
```

`npm run tauri` は `tauri` への単純なパススルーです。`npm run tauri build android` は `tauri build android` に展開され、`tauri build`（= デスクトップビルド）が余分な位置引数 `android` を cargo へ渡すため、`vite build` が成功した後の cargo 実行時に失敗します。

## 前提環境

| 項目 | 要件 | 確認コマンド |
|---|---|---|
| JDK | 17 以上（Android Studio 同梱の JBR 21 で動作確認済み） | `java -version` |
| `JAVA_HOME` | JDK のパス | `echo $JAVA_HOME` |
| Android SDK | `ANDROID_HOME` を設定し、`compileSdk`/`targetSdk` に合わせて **Platform 36** をインストール | `ls $ANDROID_HOME/platforms` |
| Android NDK | `NDK_HOME` を設定（NDK 29 系で動作確認済み） | `echo $NDK_HOME` |
| Rust ターゲット | 下記4種 | `rustup target list --installed` |
| Node.js | 20 以上 | `node -v` |

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```

## 初回セットアップ

### 1. Android プロジェクトの生成

```bash
npm run tauri:android:init
```

`src-tauri/gen/android/` に Gradle プロジェクトが生成されます。

> **注意**: `src-tauri/gen/` は `.gitignore` 対象です。`tauri android init` は `src-tauri/gen/android/app/build.gradle.kts` を**再生成（上書き）**するため、署名設定・ABI フィルタ・R8 設定などの手を入れた内容は init のたびに失われます。init を再実行する場合は事前に退避してください。

### 2. 署名設定（リリースビルドのみ必要）

キーストアを作成します（未作成の場合）。

```bash
npm run android:create-keystore
```

続いて設定ファイルを用意します。

```bash
cp src-tauri/gen/android/keystore.properties.example src-tauri/gen/android/keystore.properties
```

`keystore.properties` を実際の値で埋めます。

```properties
storeFile=release.keystore   # 絶対パス、または gen/android からの相対パス
password=<キーストアのパスワード>
keyAlias=<キーエイリアス>
```

> `keystore.properties` と `*.keystore` は機密情報のため `.gitignore` 済みです。**絶対にコミットしないでください。**
>
> `keystore.properties` が無い、または記載されたキーストアファイルが存在しない場合、`app/build.gradle.kts` の `signingConfigs` は何も設定されず、リリース APK は**未署名**になります（ビルド自体はエラーになりません）。

## ビルドコマンド

### デバッグビルド

```bash
npm run tauri:build:android -- --debug
```

出力: `src-tauri/gen/android/app/build/outputs/apk/universal/debug/*.apk`

### リリースビルド（署名付き）

```bash
npm run tauri:build:android
```

`tauri android build` は**デフォルトがリリースモード**です（`npm run tauri:build:android:release` も等価）。

出力:
- APK: `src-tauri/gen/android/app/build/outputs/apk/universal/release/AI Story Builder_<version>.apk`
- AAB: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### 実機・エミュレーターでの開発

```bash
npm run tauri:dev:android
```

### よく使うオプション

以下の例の `--` は **npm がスクリプトへ引数を渡すための区切り**であり、Tauri CLI の「runner へ引数を渡す `--`」ではありません。そのため `--debug` や `--target` はこの `--` の後ろに書きます（`npm run tauri:build:android -- --debug` = `tauri android build --debug`）。

```bash
npm run tauri:build:android -- --debug                    # デバッグビルド
npm run tauri:build:android -- --target aarch64           # ABI を絞る
npm run tauri:build:android -- --split-per-abi            # ABI ごとに APK を分割
npm run tauri:build:android -- --apk true --aab false     # APK のみ生成
```

## Windows でシンボリックリンクが使えない環境向けフォールバック

`tauri android build` は Rust の `.so` を `app/src/main/jniLibs/<abi>/` へシンボリックリンクで配置します。Windows で**開発者モードが OFF** かつ管理者権限が無い場合、このリンク作成に失敗します。

その場合は Gradle の `-Ptauri.android.copyLibs=true` でコピー方式に切り替えるスクリプトを使ってください。

```bash
npm run tauri:build:android:windows   # scripts/android-build-windows.js
```

このスクリプトは以下を順に実行します。

1. `npm run build`（フロントエンド）
2. 4つの Android ターゲットへ `cargo build --release`
3. `gradlew.bat assembleUniversalRelease -Ptauri.android.copyLibs=true`

出力は `app/build/outputs/apk/universal/release/app-universal-release.apk`（Gradle 直叩きのため tauri CLI によるリネームは行われません）。

> 恒久対策としては Windows の「開発者モード」を有効化してください。有効なら通常の `npm run tauri:build:android` が使えます。

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `error: unexpected argument 'android' found` | コマンドの語順ミス（`tauri build android`） | `npm run tauri:build:android` を使う |
| `failed to create symlink` / jniLibs 関連のエラー（Windows） | シンボリックリンク権限が無い | 開発者モードを有効化、または `npm run tauri:build:android:windows` |
| NDK が見つからない | `NDK_HOME` 未設定 | Android Studio の SDK Manager で NDK を導入し `NDK_HOME` を設定 |
| `gen/android が見つかりません` | Android プロジェクト未生成 | `npm run tauri:android:init` |
| リリース APK が未署名 | `keystore.properties` 不在、またはキーストアのパスが不正 | 上記「署名設定」を実施 |
| `compileSdk 36` 関連のエラー | Platform 36 未インストール | SDK Manager で Android API 36 を導入 |
| リンクしたはずの `.so` が APK に入らない | 対象 ABI の cargo ビルドが未実施 | `rustup target add` 済みか確認し、ターゲットを絞らずビルド |

## CI（GitHub Actions）

- [`.github/workflows/android-build.yml`](../.github/workflows/android-build.yml): `main` への push / PR でデバッグ APK をビルドしてアーティファクト化
- [`.github/workflows/release-android.yml`](../.github/workflows/release-android.yml): `v*` タグ push でリリース APK をビルドし GitHub Release へアップロード

`src-tauri/gen/` は `.gitignore` 対象のため、どちらのワークフローも `npm run tauri:android:init` で Gradle プロジェクトを生成してからビルドします。

> **未検証**: ローカルの `app/build.gradle.kts` に手を入れたカスタマイズ（署名設定・ABI フィルタ等）が CI 側でどう扱われるかは、実際の CI 実行ログで確認していません。CI のリリース APK の署名有無を検証する場合は、`gh run list --workflow=release-android.yml` からログを確認してください。
