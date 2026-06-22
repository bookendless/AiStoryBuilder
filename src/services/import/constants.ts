/**
 * インポートパイプラインの定数
 */

/**
 * インポート/要約時のプロンプトのサニタイズ上限（文字数）。
 *
 * 通常のAI呼び出しは securityUtils の既定 10000 文字で切り詰められるが、
 * ユーザーが明示的に開始するインポート処理では、クラウドモデルの広いコンテキストを
 * 活かして1回あたりの入力を増やし、AI呼び出し回数と待ち時間を削減する。
 * aiService.generateContent に request.maxPromptLength として渡すと同時に、
 * getInputCharBudget(settings, IMPORT_PROMPT_HARD_CAP) にも渡して予算計算と整合させる。
 *
 * 注: ローカルLLMは別途 settings.localContextLength で切り詰められるため、
 * この値はローカルでは実質的に localContextLength が上限となる。
 */
export const IMPORT_PROMPT_HARD_CAP = 30000;

/** 処理ウィンドウ分割時のオーバーラップ文字数（境界で人物紹介などが割れるのを緩和） */
export const IMPORT_CHUNK_OVERLAP = 200;

/**
 * キャラ抽出プロンプトに注入する「既知の登場人物」リストの上限文字数。
 * 本文チャンクの予算からこの分を先取りして差し引き、サニタイズによる
 * 黙った切り詰め（プロンプト末尾の欠落）を防ぐ。
 */
export const IMPORT_KNOWN_CHARS_MAX_CHARS = 600;

/** 既知の登場人物リストで1人あたりに併記する別名の上限数 */
export const IMPORT_KNOWN_CHAR_ALIAS_LIMIT = 3;

/**
 * 文体のAI分類を実行する最小本文文字数。
 * これ未満の短い断片は判定材料が足りず幻覚リスクが高いため、
 * AI呼び出しをスキップして機械計測（analyzeStyleMetrics）の結果のみを使う。
 */
export const STYLE_MIN_CHARS = 500;

/** 文体分類プロンプトに渡す抜粋1箇所あたりの文字数（冒頭・中間・終盤の3箇所） */
export const STYLE_EXCERPT_CHARS = 1000;
