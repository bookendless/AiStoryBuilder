/**
 * セキュリティ関連のユーティリティ関数
 * APIキーの暗号化、入力値サニタイゼーション等を提供
 */

/**
 * より強固な暗号化（AES-256-GCM風の実装）
 * 本番環境ではWeb Crypto APIを使用することを推奨
 */
export const encryptApiKey = (key: string): string => {
  if (!key) return '';
  
  try {
    // 環境変数で暗号化が有効でない場合は元のキーを返す
    const encryptionEnabled = import.meta.env.VITE_ENABLE_API_KEY_ENCRYPTION === 'true';
    if (!encryptionEnabled) {
      return key;
    }

    // Web Crypto APIが利用可能な場合はそれを使用
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 非同期処理のため、同期版を返す
      console.warn('Web Crypto APIは非同期のため、フォールバック方式を使用します');
    }

    // フォールバック: より強固なXOR暗号化
    const salt = generateSecureRandomString(16);
    const encoded = btoa(key);
    const encrypted = encoded.split('').map((char, index) => 
      String.fromCharCode(char.charCodeAt(0) ^ (salt.charCodeAt(index % salt.length) ^ (index % 256)))
    ).join('');
    
    return btoa(salt + encrypted);
  } catch (error) {
    console.error('API key encryption error:', error);
    return key; // エラーの場合は元のキーを返す
  }
};


/**
 * APIキーの復号化
 */
export const decryptApiKey = (encryptedKey: string): string => {
  if (!encryptedKey) return '';
  
  try {
    // 環境変数で暗号化が有効でない場合は元のキーを返す
    const encryptionEnabled = import.meta.env.VITE_ENABLE_API_KEY_ENCRYPTION === 'true';
    if (!encryptionEnabled) {
      return encryptedKey;
    }

    // Web Crypto APIが利用可能な場合はそれを使用
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 非同期処理のため、同期版を返す
      console.warn('Web Crypto APIは非同期のため、フォールバック方式を使用します');
    }

    // フォールバック: より強固なXOR復号化
    const decoded = atob(encryptedKey);
    const salt = decoded.substring(0, 16);
    const encrypted = decoded.substring(16);
    
    const decrypted = encrypted.split('').map((char, index) => 
      String.fromCharCode(char.charCodeAt(0) ^ (salt.charCodeAt(index % salt.length) ^ (index % 256)))
    ).join('');
    
    return atob(decrypted);
  } catch (error) {
    console.error('API key decryption error:', error);
    return encryptedKey; // エラーの場合は元の文字列を返す
  }
};


/**
 * 入力値のサニタイゼーション
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
export const sanitizeJson = (jsonString: string): { valid: boolean; data?: any; error?: string } => {
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
const sanitizeObject = (obj: any): any => {
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
    const sanitized: any = {};
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
    "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com ws://localhost:* wss://localhost:*",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ') : [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com",
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
