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
const ENCRYPTION_VERSION = 'v2'; // バージョン管理用

/**
 * デバイス固有のシードを取得（暗号化キー生成用）
 * ブラウザのフィンガープリント要素を組み合わせて生成
 */
const getDeviceSeed = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
    // 追加の安定した要素
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
 * PBKDF2を使用して暗号化キーを導出
 */
const deriveKey = async (salt: Uint8Array): Promise<CryptoKey> => {
  const seed = getDeviceSeed();
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
export const decryptApiKeyAsync = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';

  try {
    const encryptionEnabled = isEncryptionEnabled();
    if (!encryptionEnabled) {
      return encryptedKey;
    }

    // バージョンをチェック
    if (encryptedKey.startsWith(`${ENCRYPTION_VERSION}:`)) {
      // 新しいAES-GCM形式
      if (!isWebCryptoAvailable()) {
        console.error('Web Crypto API is required to decrypt this key');
        return encryptedKey;
      }

      const base64Data = encryptedKey.substring(ENCRYPTION_VERSION.length + 1);
      const combined = base64ToUint8Array(base64Data);

      // salt, iv, encryptedDataを分離
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 16 + AES_IV_LENGTH);
      const encryptedData = combined.slice(16 + AES_IV_LENGTH);

      // 暗号化キーを導出
      const cryptoKey = await deriveKey(salt);

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
    } else {
      // レガシー形式（後方互換性のため）
      return decryptApiKeyLegacy(encryptedKey);
    }
  } catch (error) {
    console.error('API key decryption error:', error);
    // 復号化に失敗した場合、レガシー形式を試みる
    try {
      return decryptApiKeyLegacy(encryptedKey);
    } catch {
      return encryptedKey;
    }
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

    return atob(decrypted);
  } catch (error) {
    console.error('Legacy API key decryption error:', error);
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
 * プロンプトインジェクション攻撃のパターンを検出
 */
const detectPromptInjection = (input: string): {
  detected: boolean;
  patterns: string[];
} => {
  const patterns: string[] = [];

  // プロンプトインジェクションの一般的なパターン
  const injectionPatterns = [
    // システムプロンプトの上書き試行
    /(?:ignore|forget|disregard)\s+(?:previous|prior|all|above|earlier)\s+(?:instructions?|prompts?|commands?|rules?)/gi,
    /(?:system|assistant|user):\s*(?:ignore|forget|disregard)/gi,
    /(?:you are|you're|act as|pretend to be|roleplay as)/gi,
    /(?:new instructions?|override|replace)\s+(?:previous|prior|all|above|earlier)/gi,

    // プロンプトの終了と新しい指示の挿入
    /(?:end of prompt|stop here|ignore above|forget everything)/gi,
    /(?:now|next|then|after this)\s+(?:you|assistant|system)\s+(?:should|must|will|need to)/gi,

    // 特殊な区切り文字の使用
    /(?:---|===|###|```)\s*(?:new|override|ignore|system|assistant)/gi,
    /(?:\[|\(|\{)\s*(?:system|assistant|user|ignore|override)/gi,

    // エスケープシーケンスの使用
    /(?:\\n|\\r|\\t)\s*(?:system|assistant|ignore|override)/gi,

    // 指示の強制
    /(?:must|should|will|need to|required to)\s+(?:ignore|forget|disregard|override)/gi,
    /(?:important|critical|urgent)\s*:\s*(?:ignore|forget|disregard|override)/gi,

    // プロンプトの構造を壊す試行
    /(?:<|\[|\{)\s*(?:system|assistant|user|prompt|instruction)/gi,
    /(?:system|assistant|user)\s*(?:>|\]|\})/gi,

    // 多言語でのインジェクション試行
    /(?:無視|忘れる|上書き|置き換え|新しい指示)/gi,
    /(?:前の|以前の|すべての)\s*(?:指示|プロンプト|コマンド|ルール)\s*(?:を|を無視|を忘れる)/gi,
  ];

  injectionPatterns.forEach((pattern, index) => {
    if (pattern.test(input)) {
      patterns.push(`パターン${index + 1}`);
    }
  });

  return {
    detected: patterns.length > 0,
    patterns
  };
};

/**
 * プロンプトインジェクション対策を含む強化された入力値のサニタイゼーション
 * AIプロンプトに使用する前に必ずこの関数を使用してください
 */
export const sanitizeInputForPrompt = (input: string, maxLength: number = 10000): string => {
  if (typeof input !== 'string') {
    return '';
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

  // プロンプトインジェクション対策: 危険なパターンの除去
  sanitized = sanitized
    // システムプロンプトの上書き試行を除去
    .replace(/(?:ignore|forget|disregard)\s+(?:previous|prior|all|above|earlier)\s+(?:instructions?|prompts?|commands?|rules?)/gi, '')
    .replace(/(?:system|assistant|user):\s*(?:ignore|forget|disregard)/gi, '')
    .replace(/(?:you are|you're|act as|pretend to be|roleplay as)\s+[^\n]{0,100}/gi, '')
    .replace(/(?:new instructions?|override|replace)\s+(?:previous|prior|all|above|earlier)/gi, '')

    // プロンプトの終了と新しい指示の挿入を除去
    .replace(/(?:end of prompt|stop here|ignore above|forget everything)/gi, '')
    .replace(/(?:now|next|then|after this)\s+(?:you|assistant|system)\s+(?:should|must|will|need to)/gi, '')

    // 特殊な区切り文字の使用を除去
    .replace(/(?:---|===|###|```)\s*(?:new|override|ignore|system|assistant)/gi, '')
    .replace(/(?:\[|\(|\{)\s*(?:system|assistant|user|ignore|override)/gi, '')

    // エスケープシーケンスの使用を除去
    .replace(/(?:\\n|\\r|\\t)\s*(?:system|assistant|ignore|override)/gi, '')

    // 指示の強制を除去
    .replace(/(?:must|should|will|need to|required to)\s+(?:ignore|forget|disregard|override)/gi, '')
    .replace(/(?:important|critical|urgent)\s*:\s*(?:ignore|forget|disregard|override)/gi, '')

    // プロンプトの構造を壊す試行を除去
    .replace(/(?:<|\[|\{)\s*(?:system|assistant|user|prompt|instruction)/gi, '')
    .replace(/(?:system|assistant|user)\s*(?:>|\]|\})/gi, '')

    // 多言語でのインジェクション試行を除去
    .replace(/(?:無視|忘れる|上書き|置き換え|新しい指示)/gi, '')
    .replace(/(?:前の|以前の|すべての)\s*(?:指示|プロンプト|コマンド|ルール)\s*(?:を|を無視|を忘れる)/gi, '')

    // 制御文字の除去（改行とタブ以外）
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

    // 連続する改行の制限（3つ以上を2つに）
    .replace(/\n{3,}/g, '\n\n')

    // 連続する空白の制限（5つ以上を1つに）
    .replace(/ {5,}/g, ' ')

    // 先頭・末尾の特殊文字の除去
    .replace(/^[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/, '')
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/, '');

  // 長さ制限
  sanitized = sanitized.slice(0, maxLength);

  // 最終的な検証: プロンプトインジェクションの検出
  const injectionCheck = detectPromptInjection(sanitized);
  if (injectionCheck.detected) {
    // 検出された場合は、さらに厳格なサニタイゼーションを適用
    console.warn('プロンプトインジェクションの可能性が検出されました:', injectionCheck.patterns);
    // 危険なパターンを含む行を除去
    const lines = sanitized.split('\n');
    const safeLines = lines.filter(line => {
      const lineCheck = detectPromptInjection(line);
      return !lineCheck.detected;
    });
    sanitized = safeLines.join('\n').slice(0, maxLength);
  }

  return sanitized;
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
 * 画像ファイルの検証
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'ファイルが選択されていません' };
  }

  // ファイルタイプの検証
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'サポートされていないファイル形式です' };
  }

  // ファイルサイズの検証（10MB制限）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'ファイルサイズが大きすぎます（最大10MB）' };
  }

  // ファイル名の検証
  if (file.name.length > 100) {
    return { valid: false, error: 'ファイル名が長すぎます' };
  }

  return { valid: true };
};

/**
 * JSONの検証とサニタイゼーション
 */
export const sanitizeJson = (jsonString: string): { valid: boolean; data?: unknown; error?: string } => {
  if (typeof jsonString !== 'string') {
    return { valid: false, error: '無効な入力です' };
  }

  try {
    const parsed = JSON.parse(jsonString);

    // 再帰的に文字列値をサニタイズ
    const sanitized = sanitizeObject(parsed);

    return { valid: true, data: sanitized };
  } catch (error) {
    return {
      valid: false,
      error: `JSON解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
    };
  }
};

/**
 * オブジェクトの再帰的サニタイゼーション
 */
const sanitizeObject = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeInput(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
};

/**
 * パスワード強度の検証
 */
export const validatePasswordStrength = (password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} => {
  if (typeof password !== 'string') {
    return { valid: false, score: 0, feedback: ['パスワードを入力してください'] };
  }

  const feedback: string[] = [];
  let score = 0;

  // 長さの検証
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('8文字以上にしてください');
  }

  // 大文字の検証
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('大文字を含めてください');
  }

  // 小文字の検証
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('小文字を含めてください');
  }

  // 数字の検証
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('数字を含めてください');
  }

  // 特殊文字の検証
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('特殊文字を含めてください');
  }

  return {
    valid: score >= 3,
    score,
    feedback
  };
};

/**
 * セキュアなランダム文字列の生成
 */
export const generateSecureRandomString = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
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
 * トークンの検証
 */
export const validateToken = (token: string): boolean => {
  if (typeof token !== 'string' || token.length < 10) {
    return false;
  }

  // 基本的な形式チェック
  const tokenPattern = /^[A-Za-z0-9+/=]+$/;
  return tokenPattern.test(token);
};

/**
 * 危険な文字列の検出
 */
export const detectDangerousContent = (content: string): {
  dangerous: boolean;
  threats: string[];
} => {
  if (typeof content !== 'string') {
    return { dangerous: false, threats: [] };
  }

  const threats: string[] = [];

  // XSS攻撃のパターン
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*onload/gi,
    /<img[^>]*onerror/gi,
    /<svg[^>]*onload/gi,
    /<style[^>]*>.*?<\/style>/gi
  ];

  xssPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      threats.push(`XSS攻撃の可能性 (パターン ${index + 1})`);
    }
  });

  // SQLインジェクションのパターン
  const sqlPatterns = [
    /union\s+select/gi,
    /drop\s+table/gi,
    /delete\s+from/gi,
    /insert\s+into/gi,
    /update\s+set/gi,
    /or\s+1\s*=\s*1/gi,
    /'\s*or\s*'1'\s*=\s*'1/gi,
    /;\s*drop\s+table/gi,
    /'\s*;\s*drop\s+table/gi
  ];

  sqlPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      threats.push(`SQLインジェクションの可能性 (パターン ${index + 1})`);
    }
  });

  // コマンドインジェクションのパターン
  const commandPatterns = [
    /;\s*rm\s+-rf/gi,
    /;\s*cat\s+\/etc\/passwd/gi,
    /;\s*ls\s+-la/gi,
    /`[^`]*`/g,
    /\$\([^)]*\)/g,
    /\|\s*sh/gi,
    /\|\s*bash/gi,
    /&&\s*rm/gi,
    /\|\|\s*rm/gi
  ];

  commandPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      threats.push(`コマンドインジェクションの可能性 (パターン ${index + 1})`);
    }
  });

  // パストラバーサル攻撃のパターン
  const pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
    /\.\.%252f/gi,
    /\.\.%255c/gi
  ];

  pathTraversalPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      threats.push(`パストラバーサル攻撃の可能性 (パターン ${index + 1})`);
    }
  });

  return {
    dangerous: threats.length > 0,
    threats
  };
};

/**
 * レート制限の実装
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) { // 1分間に100リクエスト
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];

    // 古いリクエストを削除
    const validRequests = requests.filter(time => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // 新しいリクエストを追加
    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);

    return Math.max(0, this.maxRequests - validRequests.length);
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  clear(): void {
    this.requests.clear();
  }
}

/**
 * CSRFトークンの生成と検証
 */
export const generateCSRFToken = (): string => {
  return generateSecureRandomString(32);
};

export const validateCSRFToken = (token: string, expectedToken: string): boolean => {
  if (!token || !expectedToken) {
    return false;
  }

  // タイミング攻撃を防ぐため、定数時間比較を使用
  if (token.length !== expectedToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }

  return result === 0;
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
    "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://10.0.2.2:* ws://10.0.2.2:* http://192.168.*:* ws://192.168.*:* http://172.*.*.*:* ws://172.*.*.*:*",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ') : [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com http://localhost:* https://localhost:*",
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
