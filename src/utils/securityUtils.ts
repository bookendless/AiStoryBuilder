/**
 * セキュリティ関連のユーティリティ関数
 * APIキーの暗号化、入力値サニタイゼーション等を提供
 */

const isEncryptionEnabled = (): boolean => {
  const flag = import.meta.env.VITE_ENABLE_API_KEY_ENCRYPTION;
  return flag === undefined || flag === '' || flag === 'true';
};

// AES-GCM暗号化の定数
const AES_KEY_LENGTH = 256;
const AES_IV_LENGTH = 12; // 96 bits
const AES_TAG_LENGTH = 128; // bits
const PBKDF2_ITERATIONS = 100000;
const ENCRYPTION_VERSION = 'v3'; // バージョン管理用
const ENCRYPTION_VERSION_V2 = 'v2'; // 後方互換用
const PERSISTENT_SEED_KEY = '_enc_seed_v1'; // localStorageのキー

/**
 * 永続ランダムシードを取得または生成
 * localStorageに保存することでデバイス設定変更後も復号可能にする
 * フォールバックはデバイスフィンガープリント
 *
 * 脅威モデルの限界: シードは暗号文（IndexedDB / Tauri Store）と同じ端末の localStorage にある。
 * そのため保護されるのは「DBファイル単体を覗かれた場合」までで、端末上でコードを実行できる
 * 攻撃者（マルウェア、XSS）に対しては保護にならない。恒久対策はOSキーチェーン統合。
 */
const getOrCreatePersistentSeed = (): string => {
  try {
    const existing = localStorage.getItem(PERSISTENT_SEED_KEY);
    if (existing) return existing;

    // 初回: 256ビットのランダムシードを生成して保存
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    randomBytes.forEach(b => { binary += String.fromCharCode(b); });
    const seed = btoa(binary);
    localStorage.setItem(PERSISTENT_SEED_KEY, seed);
    return seed;
  } catch {
    // localStorageが利用不可の場合はデバイスフィンガープリントにフォールバック
    return getDeviceSeedLegacy();
  }
};

/**
 * デバイスフィンガープリントシード（v2後方互換用）
 * OSアップデートや画面解像度変更で変化する可能性があるため、新規暗号化には使用しない
 */
const getDeviceSeedLegacy = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '0',
    navigator.maxTouchPoints?.toString() || '0',
  ];
  return components.join('|');
};

/**
 * 文字列をUint8Arrayに変換
 */
const stringToUint8Array = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

/**
 * Uint8Arrayを文字列に変換
 */
const uint8ArrayToString = (arr: Uint8Array): string => {
  return new TextDecoder().decode(arr);
};

/**
 * ArrayBufferをBase64文字列に変換
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Base64文字列をUint8Arrayに変換
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * PBKDF2を使用して暗号化キーを導出（共通処理）
 */
const deriveKeyFromSeed = async (seed: string, salt: Uint8Array): Promise<CryptoKey> => {
  const seedData = stringToUint8Array(seed);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    seedData.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

/** v3: 永続ランダムシードを使用してキーを導出 */
const deriveKey = async (salt: Uint8Array): Promise<CryptoKey> => {
  return deriveKeyFromSeed(getOrCreatePersistentSeed(), salt);
};

/** v2後方互換: デバイスフィンガープリントを使用してキーを導出 */
const deriveKeyV2 = async (salt: Uint8Array): Promise<CryptoKey> => {
  return deriveKeyFromSeed(getDeviceSeedLegacy(), salt);
};

/**
 * Web Crypto APIが利用可能かチェック
 */
const isWebCryptoAvailable = (): boolean => {
  return typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle !== undefined;
};

/**
 * AES-GCM暗号化（非同期版）
 * Web Crypto APIを使用した強固な暗号化
 */
export const encryptApiKeyAsync = async (key: string): Promise<string> => {
  if (!key) return '';

  try {
    const encryptionEnabled = isEncryptionEnabled();
    if (!encryptionEnabled) {
      return key;
    }

    if (!isWebCryptoAvailable()) {
      console.warn('Web Crypto API is not available, falling back to legacy encryption');
      return encryptApiKeyLegacy(key);
    }

    // ランダムなソルトとIVを生成
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(AES_IV_LENGTH));

    // 暗号化キーを導出
    const cryptoKey = await deriveKey(salt);

    // データを暗号化
    const encodedData = stringToUint8Array(key);
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: AES_TAG_LENGTH
      },
      cryptoKey,
      encodedData.buffer as ArrayBuffer
    );

    // フォーマット: version + ':' + base64(salt + iv + encryptedData)
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

    return `${ENCRYPTION_VERSION}:${arrayBufferToBase64(combined.buffer)}`;
  } catch (error) {
    console.error('API key encryption error:', error);
    return key;
  }
};

/**
 * AES-GCM復号化（非同期版）
 * Web Crypto APIを使用した復号化
 */
export const isEncryptedApiKey = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith(`${ENCRYPTION_VERSION}:`) || value.startsWith(`${ENCRYPTION_VERSION_V2}:`);
};

/**
 * 復号結果がAPIキーとして送信できる見た目かを検証する。
 * 復号に失敗したバイト列は制御文字や非ASCIIを含むため、それを検出して弾く。
 */
const looksLikeApiKey = (value: string): boolean => {
  return value.length >= 8 && value.length <= 1024 && /^[\x21-\x7E]+$/.test(value);
};

export const decryptApiKeyAsync = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';

  const isV3 = encryptedKey.startsWith(`${ENCRYPTION_VERSION}:`);
  const isV2 = encryptedKey.startsWith(`${ENCRYPTION_VERSION_V2}:`);

  // 暗号文ではない値（平文で保存された鍵、またはレガシーXOR形式）
  if (!isV3 && !isV2) {
    if (!isEncryptionEnabled()) {
      return encryptedKey;
    }
    return decryptApiKeyLegacy(encryptedKey);
  }

  // ここから先は保存値が暗号文であることが確定している。
  // 復号できない場合に暗号文をそのまま返してはならない（後述のコメント参照）。
  if (!isWebCryptoAvailable()) {
    console.error('Web Crypto API is required to decrypt this key');
    return '';
  }

  try {
    const prefix = isV3 ? ENCRYPTION_VERSION : ENCRYPTION_VERSION_V2;
    const base64Data = encryptedKey.substring(prefix.length + 1);
    const combined = base64ToUint8Array(base64Data);

    // salt, iv, encryptedDataを分離
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 16 + AES_IV_LENGTH);
    const encryptedData = combined.slice(16 + AES_IV_LENGTH);

    // バージョンに応じたキー導出関数を使用
    const cryptoKey = isV3 ? await deriveKey(salt) : await deriveKeyV2(salt);

    // データを復号化
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: AES_TAG_LENGTH
      },
      cryptoKey,
      encryptedData
    );

    return uint8ArrayToString(new Uint8Array(decryptedData));
  } catch (error) {
    // OperationError は認証タグの不一致、すなわち鍵導出の種が保存時と変わったことを意味する
    // （localStorage の _enc_seed_v1 が消えた、v2はデバイス情報が変化した等）。この鍵は復元できない。
    //
    // 以前はここで暗号文をそのまま返していたため、復号できない鍵が「復号済みの鍵」として
    // 設定画面に入り、Authorization ヘッダーで外部APIへ送信されていた（400/401の原因）。
    // さらにその状態で保存すると暗号文が再暗号化され、元の鍵が失われていた。
    console.error('保存されたAPIキーを復号できませんでした。設定画面で再入力してください:', error);
    return '';
  }
};

/**
 * レガシーXOR暗号化（後方互換性のため維持）
 * @deprecated 新しいコードではencryptApiKeyAsyncを使用してください
 */
const encryptApiKeyLegacy = (key: string): string => {
  if (!key) return '';

  try {
    const salt = generateSecureRandomString(16);
    const encoded = btoa(key);
    const encrypted = encoded.split('').map((char, index) =>
      String.fromCharCode(char.charCodeAt(0) ^ (salt.charCodeAt(index % salt.length) ^ (index % 256)))
    ).join('');

    return btoa(salt + encrypted);
  } catch (error) {
    console.error('Legacy API key encryption error:', error);
    return key;
  }
};

/**
 * レガシーXOR復号化（後方互換性のため維持）
 * @deprecated 新しいコードではdecryptApiKeyAsyncを使用してください
 */
const decryptApiKeyLegacy = (encryptedKey: string): string => {
  if (!encryptedKey) return '';

  try {
    const decoded = atob(encryptedKey);
    const salt = decoded.substring(0, 16);
    const encrypted = decoded.substring(16);

    const decrypted = encrypted.split('').map((char, index) =>
      String.fromCharCode(char.charCodeAt(0) ^ (salt.charCodeAt(index % salt.length) ^ (index % 256)))
    ).join('');

    const result = atob(decrypted);

    // XOR形式として辻褄が合わない場合は、そもそも暗号文ではなく平文の鍵だったと判断する
    return looksLikeApiKey(result) ? result : encryptedKey;
  } catch {
    // base64として読めない = XOR暗号文ではなく平文で保存された鍵。
    // これは正常な経路なのでエラーログは出さない（従来はここで大量のログが出ていた）。
    return encryptedKey;
  }
};

/**
 * 同期版の暗号化（後方互換性のため）
 * 内部でPromiseを使用するため、即座に暗号化が必要な場合はレガシー方式を使用
 * 可能な限りencryptApiKeyAsyncを使用することを推奨
 */
export const encryptApiKey = (key: string): string => {
  if (!key) return '';

  try {
    const encryptionEnabled = isEncryptionEnabled();
    if (!encryptionEnabled) {
      return key;
    }

    // 同期版ではレガシー暗号化を使用
    // 非同期版（encryptApiKeyAsync）の使用を推奨
    return encryptApiKeyLegacy(key);
  } catch (error) {
    console.error('API key encryption error:', error);
    return key;
  }
};

/**
 * 同期版の復号化（後方互換性のため）
 * 新しいAES-GCM形式の復号化には対応していません
 * 可能な限りdecryptApiKeyAsyncを使用することを推奨
 */
export const decryptApiKey = (encryptedKey: string): string => {
  if (!encryptedKey) return '';

  try {
    const encryptionEnabled = isEncryptionEnabled();
    if (!encryptionEnabled) {
      return encryptedKey;
    }

    // 新しいAES-GCM形式の場合は警告
    if (encryptedKey.startsWith(`${ENCRYPTION_VERSION}:`)) {
      console.warn('AES-GCM encrypted key detected. Use decryptApiKeyAsync for proper decryption.');
      return encryptedKey;
    }

    // レガシー形式の復号化
    return decryptApiKeyLegacy(encryptedKey);
  } catch (error) {
    console.error('API key decryption error:', error);
    return encryptedKey;
  }
};


/**
 * sanitizeInputForPrompt の既定の長さ上限。
 * 呼び出し側が maxPromptLength を明示しない場合に適用される。
 */
export const DEFAULT_PROMPT_MAX_LENGTH = 10000;

/**
 * 長さ超過プロンプトの切り詰めマーカー。
 * 注意: sanitize は `<>` を除去するため、マーカーには `【】` を使う（`<中略>` は不可）。
 */
const PROMPT_TRUNCATION_MARKER = '\n\n【中略：プロンプトが長すぎるため中間部分を省略しました】\n\n';

/**
 * 末尾に確保する割合。多くのプロンプトは末尾に【指示】【出力形式】(JSONスキーマ)を置くため、
 * 単純な末尾切りだと出力形式指示が黙って消える。中抜き方式で先頭と末尾の双方を残し、
 * 末尾の指示ブロックを死守する。
 */
const PROMPT_TRUNCATION_TAIL_RATIO = 0.35;

/**
 * プロンプトを上限内に収める。単純な `slice(0, maxLength)`（末尾切り）ではなく、
 * 先頭（役割・データ前半）＋マーカー＋末尾（指示・出力形式ブロック）を保持する中抜きにする。
 * これにより上限を超えても末尾のJSON出力形式指示が失われない。
 */
const truncatePromptPreservingTail = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }

  if (typeof console !== 'undefined') {
    console.warn(
      `[securityUtils] プロンプトが上限を超えたため中抜きしました（元: ${text.length} / 上限: ${maxLength}）`
    );
  }

  // 上限が極端に小さくマーカーすら入らない場合は、末尾（指示ブロック）を優先して残す
  const budget = maxLength - PROMPT_TRUNCATION_MARKER.length;
  if (budget <= 0) {
    return text.slice(text.length - maxLength);
  }

  const tailLength = Math.floor(budget * PROMPT_TRUNCATION_TAIL_RATIO);
  const headLength = budget - tailLength;
  const head = text.slice(0, headLength);
  const tail = text.slice(text.length - tailLength);
  return head + PROMPT_TRUNCATION_MARKER + tail;
};

/**
 * sanitizeInputForPrompt の結果に切り詰めメタ情報を付けたもの。
 * UI通知（トースト）は「実際に切り詰めが起きたか」を正確に判定する必要があるため、
 * サニタイズ後・切り詰め前の実コンテンツ長（contentLength）と truncated フラグを返す。
 */
export interface PromptSanitizeResult {
  /** サニタイズ・切り詰め済みの最終文字列 */
  text: string;
  /** 中抜き切り詰めが実際に発生したか（生の入力長ではなくサニタイズ後の長さで判定） */
  truncated: boolean;
  /** サニタイズ後・切り詰め前のコンテンツ長（トースト表示用の「元の長さ」） */
  contentLength: number;
}

/**
 * プロンプトインジェクション対策を含む強化された入力値のサニタイゼーション（メタ情報付き）。
 * 切り詰めが実際に発生したかを呼び出し側（UI通知など）が正確に判断できるよう、truncated を返す。
 */
export const sanitizeInputForPromptWithMeta = (
  input: string,
  maxLength: number = DEFAULT_PROMPT_MAX_LENGTH
): PromptSanitizeResult => {
  if (typeof input !== 'string') {
    return { text: '', truncated: false, contentLength: 0 };
  }

  let sanitized = input.trim();

  // 基本的なXSS対策
  sanitized = sanitized
    .replace(/[<>]/g, '') // HTMLタグの除去
    .replace(/javascript:/gi, '') // JavaScriptの除去
    .replace(/on\w+\s*=/gi, '') // イベントハンドラーの除去
    .replace(/data:text\/html/gi, '') // data URIの除去
    .replace(/vbscript:/gi, '') // VBScriptの除去
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // scriptタグの除去
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // iframeタグの除去
    .replace(/<object[^>]*>.*?<\/object>/gi, '') // objectタグの除去
    .replace(/<embed[^>]*>.*?<\/embed>/gi, ''); // embedタグの除去

  // 制御文字と過剰な空白の正規化のみを行う。
  //
  // かつてここでプロンプトインジェクション対策として「無視」「忘れる」「上書き」や
  // "you are 〜"（以降100文字）などを削除していたが、これらは日本語の小説本文に
  // 日常的に現れる語であり、著者の原稿を無断で書き換えていた。ユーザー自身の原稿を
  // ユーザー自身のAPIキーで送るローカル専用アプリという構造上、この種の語句削除は
  // 防御として機能せず原稿品質だけを損なうため撤廃した。
  sanitized = sanitized
    // 制御文字の除去（改行とタブ以外）
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

    // 連続する改行の制限（3つ以上を2つに）
    .replace(/\n{3,}/g, '\n\n')

    // 連続する空白の制限（5つ以上を1つに）
    .replace(/ {5,}/g, ' ');

  // サニタイズ後・切り詰め前のコンテンツ長。切り詰め判定と「元の長さ」表示に使う
  // （生の input.length ではなくここを使うことで、サニタイズで縮んだ分の誤検知を防ぐ）。
  const contentLength = sanitized.length;
  const truncated = contentLength > maxLength;

  // 長さ制限（末尾の指示・出力形式ブロックを死守する中抜き方式）
  sanitized = truncatePromptPreservingTail(sanitized, maxLength);

  // 注意: ここでインジェクション語句を含む「行」を丸ごと削除する処理があったが、
  // 「無視」「忘れる」等を含む地の文が1行単位で消えるため原稿破壊の原因になっていた。
  // 上記の語句削除と同じ理由で撤廃している。

  return { text: sanitized, truncated, contentLength };
};

/**
 * プロンプトインジェクション対策を含む強化された入力値のサニタイゼーション
 * AIプロンプトに使用する前に必ずこの関数を使用してください
 */
export const sanitizeInputForPrompt = (input: string, maxLength: number = DEFAULT_PROMPT_MAX_LENGTH): string => {
  return sanitizeInputForPromptWithMeta(input, maxLength).text;
};

/**
 * 入力値のサニタイゼーション（汎用版）
 * プロンプトに使用する場合はsanitizeInputForPromptを使用してください
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // HTMLタグの除去
    .replace(/javascript:/gi, '') // JavaScriptの除去
    .replace(/on\w+\s*=/gi, '') // イベントハンドラーの除去
    .replace(/data:text\/html/gi, '') // data URIの除去
    .replace(/vbscript:/gi, '') // VBScriptの除去
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // scriptタグの除去
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // iframeタグの除去
    .replace(/<object[^>]*>.*?<\/object>/gi, '') // objectタグの除去
    .replace(/<embed[^>]*>.*?<\/embed>/gi, '') // embedタグの除去
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // 制御文字の除去（改行とタブ以外）
    .replace(/\n{3,}/g, '\n\n') // 連続する改行の制限
    .replace(/ {5,}/g, ' ') // 連続する空白の制限
    .slice(0, 10000); // 長さ制限
};

/**
 * HTMLエスケープ
 */
export const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') {
    return '';
  }

  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, (s) => map[s]);
};

/**
 * URLの検証
 */
export const isValidUrl = (url: string): boolean => {
  if (typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    // 許可されたプロトコルのみ
    const allowedProtocols = ['http:', 'https:'];
    return allowedProtocols.includes(urlObj.protocol);
  } catch {
    return false;
  }
};

/**
 * ファイル名のサニタイゼーション
 */
export const sanitizeFileName = (fileName: string): string => {
  if (typeof fileName !== 'string') {
    return 'file';
  }

  return fileName
    .replace(/[<>:"/\\|?*]/g, '_') // 無効な文字を置換
    .replace(/\s+/g, '_') // スペースをアンダースコアに置換
    .slice(0, 100) // 長さ制限
    || 'file'; // 空文字列の場合はデフォルト名
};

/**
 * セキュアなランダム文字列の生成
 */
export const generateSecureRandomString = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // 剰余バイアスを避けるため、文字数の整数倍（62 * 4 = 248）を超えたバイトは捨てて引き直す
  const limit = Math.floor(256 / chars.length) * chars.length;
  let result = '';

  while (result.length < length) {
    const buffer = new Uint8Array(length - result.length);
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= limit) continue;
      result += chars.charAt(byte % chars.length);
    }
  }

  return result;
};

/**
 * セッションIDの生成
 */
export const generateSessionId = (): string => {
  return generateSecureRandomString(64);
};

/**
 * 永続化・書き出しするテキストからAPIキー等の機密情報をマスクする。
 *
 * ログ本文は後からファイルへ書き出せる（AIログのダウンロード、データエクスポート）ため、
 * 保存前に必ず通す。プロンプト本文は残したいので切り詰めは行わない。
 */
export const maskSecretsInText = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, 'sk-ant-***')
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, 'sk-***')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, 'AIza***')
    .replace(/xai-[A-Za-z0-9_-]{16,}/g, 'xai-***')
    .replace(/((?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*)\S+/gi, '$1***');
};

/**
 * ホスト名を厳密なIPv4として解析する。IPv4でなければ null。
 *
 * WHATWG URL は host を正規化するため（例: `http://010.0.0.1` → `8.0.0.1`、
 * `http://2130706433` → `127.0.0.1`）、url.hostname は既に十進ドット表記になっている。
 */
const parseIPv4 = (hostname: string): [number, number, number, number] | null => {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }

  return octets as [number, number, number, number];
};

/**
 * ローカルLLM（LM Studio / Ollama など）の接続先として許可するエンドポイントか判定する。
 *
 * 重要: hostname はIPアドレスではなく文字列であるため、前方一致（例 /^10\./）で判定すると
 * `10.evil.com` や `192.168.attacker.tld` のような公開ホストが通過してしまう。
 * これらはDNSで外部に解決されるため、原稿全文の送信先として悪用されうる。
 * そのため必ずIPv4として解析し、オクテット単位で私的アドレス範囲を判定する。
 *
 * 許可: ループバック表記（localhost / ::1）、127.0.0.0/8、10.0.0.0/8（Androidエミュレータの
 * 10.0.2.2 を含む）、172.16.0.0/12、192.168.0.0/16、および 0.0.0.0。
 * 上記以外のホスト名は、たとえ私的アドレスに見える文字列でも拒否する。
 */
export const isAllowedLocalEndpoint = (endpoint: string): boolean => {
  if (!endpoint || typeof endpoint !== 'string') {
    return false;
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    // URL解析に失敗した場合は無効
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  // ポート番号の検証（1-65535）。URL側で正規化されるため空の場合は既定ポート扱い。
  if (url.port) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return false;
    }
  }

  const hostname = url.hostname.toLowerCase();

  // ループバックのホスト名・IPv6表記
  if (hostname === 'localhost' || hostname === '[::1]' || hostname === '::1') {
    return true;
  }

  const octets = parseIPv4(hostname);
  if (!octets) {
    // ホスト名形式・IPv6・不正な数値はすべて拒否
    return false;
  }

  const [a, b] = octets;

  if (a === 0 && b === 0 && octets[2] === 0 && octets[3] === 0) return true; // 0.0.0.0
  if (a === 127) return true;                        // 127.0.0.0/8
  if (a === 10) return true;                         // 10.0.0.0/8（10.0.2.2 を含む）
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16

  return false;
};

/**
 * セキュリティヘッダーの設定
 */
export const setSecurityHeaders = (): void => {
  if (typeof document === 'undefined') return;

  // 開発環境ではCSPを緩和
  const isDevelopment = import.meta.env.DEV;

  // Content Security Policy
  const csp = isDevelopment ? [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    // CSP の connect-src はホスト中間の '*'（例 192.168.*）を許可しない（無効として無視される）。
    // Tauri の IPC は scheme-source 'ipc:' と http(s)://ipc.localhost で許可する。
    "connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* http://10.0.2.2:* ws://10.0.2.2:* https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.x.ai",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ') : [
    "default-src 'self'",
    // 本番ビルドでは eval を許可しない（Worker/WebAssembly を使っていないため不要）
    "script-src 'self' 'unsafe-inline' blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    // CSP の connect-src はホスト中間の '*' を許可しない。Tauri IPC は 'ipc:' と ipc.localhost で許可。
    "connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* http://10.0.2.2:* ws://10.0.2.2:* https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.x.ai",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  // メタタグでCSPを設定
  let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!cspMeta) {
    cspMeta = document.createElement('meta');
    cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    document.head.appendChild(cspMeta);
  }
  cspMeta.setAttribute('content', csp);
};

/**
 * UUID生成（crypto.randomUUID()のフォールバック付き）
 */
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // フォールバック: 簡易的なUUID v4の実装
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * セッション管理
 */
export class SessionManager {
  private sessionId: string;
  private lastActivity: number;
  private timeout: number;

  constructor(timeout: number = 30 * 60 * 1000) { // 30分
    this.sessionId = generateSessionId();
    this.lastActivity = Date.now();
    this.timeout = timeout;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  updateActivity(): void {
    this.lastActivity = Date.now();
  }

  isExpired(): boolean {
    return Date.now() - this.lastActivity > this.timeout;
  }

  reset(): void {
    this.sessionId = generateSessionId();
    this.lastActivity = Date.now();
  }

  getTimeUntilExpiry(): number {
    return Math.max(0, this.timeout - (Date.now() - this.lastActivity));
  }
}
