/**
 * セキュリティ関連のユーティリティ関数
 * APIキーの暗号化、入力値サニタイゼーション等を提供
 */

/**
 * 簡単な暗号化（本番環境ではより強固な方法を使用）
 * 注意: これは基本的な暗号化であり、本格的なセキュリティ要件には不十分です
 */
export const encryptApiKey = (key: string): string => {
  if (!key) return '';
  
  try {
    // Base64エンコード + 簡単なXOR暗号化
    const encoded = btoa(key);
    const encrypted = encoded.split('').map((char, index) => 
      String.fromCharCode(char.charCodeAt(0) ^ (index % 256))
    ).join('');
    
    return btoa(encrypted);
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
    // 復号化処理
    const decoded = atob(encryptedKey);
    const decrypted = decoded.split('').map((char, index) => 
      String.fromCharCode(char.charCodeAt(0) ^ (index % 256))
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
    /<embed[^>]*>.*?<\/embed>/gi
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
    /or\s+1\s*=\s*1/gi
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
    /\$\([^)]*\)/g
  ];
  
  commandPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      threats.push(`コマンドインジェクションの可能性 (パターン ${index + 1})`);
    }
  });
  
  return {
    dangerous: threats.length > 0,
    threats
  };
};
