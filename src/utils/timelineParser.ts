/**
 * タイムラインAI出力のパーサーユーティリティ
 * JSON形式とテキスト形式の両方を解析できるようにする
 */

import { TimelineEvent } from '../contexts/ProjectContext';

export interface ParsedTimelineEvent {
    title: string;
    description: string;
    date?: string;
    category: TimelineEvent['category'];
    chapterTitle?: string;
    characterNames?: string[];
}

export interface TimelineParseResult {
    success: boolean;
    events: ParsedTimelineEvent[];
    format: 'json' | 'text' | 'markdown' | 'unknown';
    warning?: string;
}

/**
 * AIからのレスポンスを解析してタイムラインイベントを抽出する
 * JSON形式を優先し、失敗した場合はテキスト形式での解析を試みる
 */
export function parseTimelineAIResponse(content: string): TimelineParseResult {
    // 空のコンテンツの場合
    if (!content || content.trim() === '') {
        return {
            success: false,
            events: [],
            format: 'unknown',
            warning: 'AIからの応答が空です',
        };
    }

    // 1. まずJSON形式での解析を試みる
    const jsonResult = tryParseJSON(content);
    if (jsonResult.success) {
        return jsonResult;
    }

    // 2. Gemini特有の構造化Markdown形式を試みる（#### 【カテゴリ】 + **タイトル** パターン）
    const geminiMarkdownResult = tryParseGeminiMarkdown(content);
    if (geminiMarkdownResult.success && geminiMarkdownResult.events.length > 0) {
        return geminiMarkdownResult;
    }

    // 3. 通常のMarkdown形式での解析を試みる
    const markdownResult = tryParseMarkdown(content);
    if (markdownResult.success && markdownResult.events.length > 0) {
        return markdownResult;
    }

    // 4. 構造化テキスト形式での解析を試みる
    const textResult = tryParseTextFormat(content);
    if (textResult.success && textResult.events.length > 0) {
        return textResult;
    }

    return {
        success: false,
        events: [],
        format: 'unknown',
        warning: 'AIからの応答を解析できませんでした',
    };
}

/**
 * Gemini AIの構造化Markdown形式を解析する
 * パターン: #### 【カテゴリ名】 + 番号付き/箇条書きリスト + **タイトル** + サブリスト説明
 */
function tryParseGeminiMarkdown(content: string): TimelineParseResult {
    const events: ParsedTimelineEvent[] = [];

    // #### 【カテゴリ】セクションを検出
    const sectionPattern = /####\s*【([^】]+)】/g;
    const sections = [...content.matchAll(sectionPattern)];

    // セクションがない場合、全体を一つのセクションとして処理
    if (sections.length === 0) {
        const eventsFromContent = extractEventsFromGeminiContent(content, 'plot');
        events.push(...eventsFromContent);
    } else {
        // 各セクションを処理
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sectionCategory = inferCategoryFromSectionName(section[1]);
            const startIndex = section.index! + section[0].length;
            const endIndex = i < sections.length - 1 ? sections[i + 1].index! : content.length;
            const sectionContent = content.slice(startIndex, endIndex);

            const eventsFromSection = extractEventsFromGeminiContent(sectionContent, sectionCategory);
            events.push(...eventsFromSection);
        }
    }

    return {
        success: events.length > 0,
        events,
        format: 'markdown',
        warning: events.length > 0 ? 'Markdown形式で解析しました（JSON形式を推奨）' : undefined,
    };
}

/**
 * Gemini形式のコンテンツからイベントを抽出
 */
function extractEventsFromGeminiContent(content: string, defaultCategory: TimelineEvent['category']): ParsedTimelineEvent[] {
    const events: ParsedTimelineEvent[] = [];

    // パターン1: 番号付き + **太字タイトル** パターン
    // 例: 1.  **運命の最悪な出会い**
    // 例: *   **イベント1：タイトル**（第X章）
    const boldTitlePattern = /(?:^\s*(?:\d+[.）]|\*|-|・)\s*)\*\*([^*]+)\*\*/gm;
    const matches = [...content.matchAll(boldTitlePattern)];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        let title = match[1].trim();

        // タイトルから「イベントN：」を除去
        title = title.replace(/^(?:イベント\d+[：:]\s*)?/, '');

        // タイトルから（第X章）などを抽出
        const chapterMatch = title.match(/（([^）]+)）$/);
        const chapterTitle = chapterMatch ? chapterMatch[1] : undefined;
        if (chapterMatch) {
            title = title.replace(/（[^）]+）$/, '').trim();
        }

        // 説明を取得：この行の後から次のイベントまでの内容
        const startIndex = match.index! + match[0].length;
        const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
        const descriptionBlock = content.slice(startIndex, endIndex);

        // サブリスト（*   で始まる）から説明を抽出
        const description = extractDescriptionFromBlock(descriptionBlock);

        // 日付を抽出
        const date = extractDateFromContent(title + ' ' + descriptionBlock);

        // キャラクター名を抽出（本文中から）
        const characterNames = extractCharacterNamesFromContent(descriptionBlock);

        if (title.length > 2 && description.length > 5) {
            events.push({
                title: title.substring(0, 100),
                description: description.substring(0, 500),
                date,
                category: defaultCategory,
                chapterTitle,
                characterNames,
            });
        }
    }

    return events;
}

/**
 * 説明ブロックから説明文を抽出
 */
function extractDescriptionFromBlock(block: string): string {
    // サブリスト項目を収集（*   で始まる行）
    const sublistPattern = /^\s*\*\s+(.+?)$/gm;
    const sublistMatches = [...block.matchAll(sublistPattern)];

    if (sublistMatches.length > 0) {
        // サブリストの内容を連結（太字マークを除去）
        const descriptions = sublistMatches
            .map(m => m[1].replace(/\*\*/g, '').trim())
            .filter(d => d.length > 0);
        return descriptions.join(' ');
    }

    // サブリストがない場合は最初の行を使用
    const lines = block.split('\n')
        .map(line => line.replace(/\*\*/g, '').trim())
        .filter(line => line.length > 5 && !line.startsWith('#') && !line.match(/^\d+[.）]/));

    return lines.slice(0, 3).join(' ').trim();
}

/**
 * セクション名からカテゴリを推測
 */
function inferCategoryFromSectionName(sectionName: string): TimelineEvent['category'] {
    const name = sectionName.toLowerCase();

    // 導入、展開、転換、佳境、クライマックス、見せ場 → plot
    if (name.includes('導入') || name.includes('展開') || name.includes('転換') ||
        name.includes('佳境') || name.includes('クライマックス') || name.includes('見せ場') ||
        name.includes('決戦') || name.includes('危機') || name.includes('葛藤')) {
        return 'plot';
    }

    // キャラクター関連
    if (name.includes('キャラクター') || name.includes('人物') || name.includes('成長')) {
        return 'character';
    }

    // 世界観関連
    if (name.includes('世界') || name.includes('設定') || name.includes('背景')) {
        return 'world';
    }

    return 'plot';
}

/**
 * コンテンツから日付/時期を抽出
 */
function extractDateFromContent(text: string): string | undefined {
    const patterns = [
        /（(第\d+章[^）]*)）/,
        /（(第\d+[〜~-]+\d*章)）/,
        /第(\d+)章/,
        /(序盤|中盤|終盤|前半|後半|冒頭|クライマックス)/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1] || match[0];
        }
    }

    return undefined;
}

/**
 * コンテンツからキャラクター名を抽出
 */
function extractCharacterNamesFromContent(text: string): string[] | undefined {
    // 日本語の名前らしいパターンを検出（カタカナ2-6文字）
    const katakanaPattern = /[ァ-ヶー]{2,6}/g;
    const katakanaMatches = text.match(katakanaPattern);

    if (katakanaMatches && katakanaMatches.length > 0) {
        // 重複を除去してユニークな名前のみ
        const uniqueNames = [...new Set(katakanaMatches)]
            .filter(name => !['パターン', 'プロット', 'イベント', 'タイトル', 'カテゴリ', 'キャラクター'].includes(name));
        if (uniqueNames.length > 0 && uniqueNames.length <= 5) {
            return uniqueNames;
        }
    }

    return undefined;
}

/**
 * JSON形式での解析を試みる
 */
function tryParseJSON(content: string): TimelineParseResult {
    try {
        let jsonText = content.trim();

        // JSON配列を抽出する試み
        const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            jsonText = arrayMatch[0];
        } else {
            // 単一オブジェクトの場合
            const objectMatch = jsonText.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                jsonText = `[${objectMatch[0]}]`;
            } else {
                return {
                    success: false,
                    events: [],
                    format: 'unknown',
                };
            }
        }

        const parsed = JSON.parse(jsonText);

        if (!Array.isArray(parsed)) {
            return {
                success: false,
                events: [],
                format: 'unknown',
            };
        }

        const events = parsed
            .filter((item): item is Record<string, unknown> =>
                item !== null && typeof item === 'object' && 'title' in item
            )
            .map(item => normalizeEvent(item));

        if (events.length === 0) {
            return {
                success: false,
                events: [],
                format: 'json',
                warning: 'JSON形式ですがイベントが見つかりませんでした',
            };
        }

        return {
            success: true,
            events,
            format: 'json',
        };
    } catch {
        return {
            success: false,
            events: [],
            format: 'unknown',
        };
    }
}

/**
 * Markdown形式での解析を試みる
 * 見出しベースでイベントを抽出
 */
function tryParseMarkdown(content: string): TimelineParseResult {
    const events: ParsedTimelineEvent[] = [];

    // Markdown見出しパターン（## または ### で始まる）
    const headingPattern = /^#{2,3}\s+(.+)$/gm;
    const matches = [...content.matchAll(headingPattern)];

    if (matches.length === 0) {
        return {
            success: false,
            events: [],
            format: 'markdown',
        };
    }

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const title = match[1].trim();
        const startIndex = match.index! + match[0].length;
        const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
        const sectionContent = content.slice(startIndex, endIndex).trim();

        // セクションの内容から説明を抽出
        const description = extractDescription(sectionContent);
        const category = inferCategory(title, description);
        const date = extractDate(sectionContent);
        const characterNames = extractCharacterNames(sectionContent);

        if (title && description) {
            events.push({
                title,
                description,
                date,
                category,
                characterNames,
            });
        }
    }

    return {
        success: events.length > 0,
        events,
        format: 'markdown',
        warning: events.length > 0 ? 'Markdown形式で解析しました（JSON形式を推奨）' : undefined,
    };
}

/**
 * 構造化テキスト形式での解析を試みる
 * 番号付きリストや箇条書きからイベントを抽出
 */
function tryParseTextFormat(content: string): TimelineParseResult {
    const events: ParsedTimelineEvent[] = [];

    // 番号付きリストパターン（1. 2. など）
    const numberedListPattern = /^\s*(\d+)[.）]\s*(.+?)(?:\n|$)/gm;

    // 箇条書きパターン（- * ・ など）
    const bulletPattern = /^\s*[-*・]\s*(.+?)(?:\n|$)/gm;

    // キーバリュー形式パターン（タイトル: ..., 説明: ... など）
    const keyValuePattern = /(?:タイトル|title)[：:]\s*(.+?)(?:\n|$)/gi;

    // 番号付きリストの処理
    let matches = [...content.matchAll(numberedListPattern)];
    if (matches.length > 0) {
        for (const match of matches) {
            const line = match[2].trim();
            // タイトルと説明を分離（ - や : で区切られている場合）
            const [title, ...descParts] = line.split(/\s*[-–:：]\s*/);
            const description = descParts.join(' ').trim() || title;

            if (title.length > 2) {
                events.push({
                    title: title.trim().substring(0, 100),
                    description: description.substring(0, 500) || title,
                    category: inferCategory(title, description),
                    date: extractDate(line),
                    characterNames: extractCharacterNames(line),
                });
            }
        }
    }

    // キーバリュー形式の処理
    if (events.length === 0) {
        matches = [...content.matchAll(keyValuePattern)];
        const descriptionPattern = /(?:説明|description)[：:]\s*(.+?)(?:\n|$)/gi;
        const descMatches = [...content.matchAll(descriptionPattern)];

        for (let i = 0; i < matches.length; i++) {
            const title = matches[i][1].trim();
            const description = descMatches[i]?.[1]?.trim() || title;

            if (title.length > 2) {
                events.push({
                    title: title.substring(0, 100),
                    description: description.substring(0, 500),
                    category: inferCategory(title, description),
                });
            }
        }
    }

    // 箇条書きの処理（他のパターンで見つからなかった場合）
    if (events.length === 0) {
        matches = [...content.matchAll(bulletPattern)];
        for (const match of matches) {
            const line = match[1].trim();
            if (line.length > 5) {
                const [title, ...descParts] = line.split(/\s*[-–:：]\s*/);
                const description = descParts.join(' ').trim() || title;

                events.push({
                    title: title.trim().substring(0, 100),
                    description: description.substring(0, 500) || title,
                    category: inferCategory(title, description),
                });
            }
        }
    }

    return {
        success: events.length > 0,
        events,
        format: 'text',
        warning: events.length > 0 ? 'テキスト形式で解析しました（JSON形式を推奨）' : undefined,
    };
}

/**
 * イベントオブジェクトを正規化する
 */
function normalizeEvent(item: Record<string, unknown>): ParsedTimelineEvent {
    return {
        title: String(item.title || '').trim(),
        description: String(item.description || item.desc || '').trim(),
        date: item.date ? String(item.date).trim() : undefined,
        category: normalizeCategory(item.category),
        chapterTitle: item.chapterTitle ? String(item.chapterTitle).trim() : undefined,
        characterNames: Array.isArray(item.characterNames)
            ? item.characterNames.map(n => String(n))
            : undefined,
    };
}

/**
 * カテゴリを正規化する
 */
function normalizeCategory(category: unknown): TimelineEvent['category'] {
    const categoryStr = String(category || 'plot').toLowerCase();

    if (categoryStr.includes('character') || categoryStr.includes('キャラ')) {
        return 'character';
    }
    if (categoryStr.includes('world') || categoryStr.includes('世界')) {
        return 'world';
    }
    if (categoryStr.includes('other') || categoryStr.includes('その他')) {
        return 'other';
    }
    return 'plot';
}

/**
 * テキストからカテゴリを推測する
 */
function inferCategory(title: string, description: string): TimelineEvent['category'] {
    const text = (title + ' ' + description).toLowerCase();

    // キャラクター関連のキーワード
    const characterKeywords = ['出会い', '別れ', '成長', '覚醒', '決意', '対立', '和解', '関係', 'キャラクター'];
    if (characterKeywords.some(k => text.includes(k))) {
        return 'character';
    }

    // 世界観関連のキーワード
    const worldKeywords = ['世界', '発見', '歴史', '秘密', '設定', '環境', '場所', '国', '王国'];
    if (worldKeywords.some(k => text.includes(k))) {
        return 'world';
    }

    // プロット関連のキーワード
    const plotKeywords = ['開始', '終結', '戦い', '事件', '転換', 'クライマックス'];
    if (plotKeywords.some(k => text.includes(k))) {
        return 'plot';
    }

    return 'plot';
}

/**
 * テキストから日付/時期を抽出する
 */
function extractDate(text: string): string | undefined {
    // 様々な日付/時期パターンを検出
    const patterns = [
        /(?:日付|時期|date)[：:]\s*(.+?)(?:\n|$)/i,
        /第(\d+)章/,
        /(\d+)年(?:目|後)?/,
        /(\d+)日(?:目|後)?/,
        /(\d+)ヶ月(?:目|後)?/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0].trim();
        }
    }

    return undefined;
}

/**
 * テキストから説明を抽出する
 */
function extractDescription(text: string): string {
    // 最初の段落または最初の100-300文字を説明として使用
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    let description = lines.slice(0, 3).join(' ').trim();

    if (description.length > 500) {
        description = description.substring(0, 497) + '...';
    }

    return description || text.substring(0, 200).trim();
}

/**
 * テキストからキャラクター名を抽出する
 */
function extractCharacterNames(text: string): string[] | undefined {
    // キャラクター/関連キャラ パターンを検出
    const pattern = /(?:キャラクター|関連キャラ|characters?)[：:]\s*(.+?)(?:\n|$)/i;
    const match = text.match(pattern);

    if (match) {
        return match[1].split(/[,、]/).map(name => name.trim()).filter(name => name.length > 0);
    }

    return undefined;
}

/**
 * 整合性チェックの結果を解析する
 */
export interface ConsistencyCheckResult {
    hasIssues: boolean;
    issues: string[];
    suggestions: string[];
}

export function parseConsistencyCheckResponse(content: string): ConsistencyCheckResult {
    // まずJSON形式での解析を試みる
    try {
        let jsonText = content.trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonText);
        return {
            hasIssues: Boolean(parsed.hasIssues),
            issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
        };
    } catch {
        // テキスト形式での解析を試みる
        return parseConsistencyCheckText(content);
    }
}

function parseConsistencyCheckText(content: string): ConsistencyCheckResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 問題点セクションを抽出
    const issuePatterns = [
        /問題[点]?[：:]\s*\n?([\s\S]*?)(?=改善|提案|$)/i,
        /issues?[：:]\s*\n?([\s\S]*?)(?=suggestion|$)/i,
    ];

    for (const pattern of issuePatterns) {
        const match = content.match(pattern);
        if (match) {
            const issueText = match[1];
            const lines = issueText.split('\n')
                .map(line => line.replace(/^\s*[-*\d.）]\s*/, '').trim())
                .filter(line => line.length > 5);
            issues.push(...lines);
            break;
        }
    }

    // 改善提案セクションを抽出
    const suggestionPatterns = [
        /(?:改善|提案)[：:]\s*\n?([\s\S]*?)$/i,
        /suggestions?[：:]\s*\n?([\s\S]*?)$/i,
    ];

    for (const pattern of suggestionPatterns) {
        const match = content.match(pattern);
        if (match) {
            const suggestionText = match[1];
            const lines = suggestionText.split('\n')
                .map(line => line.replace(/^\s*[-*\d.）]\s*/, '').trim())
                .filter(line => line.length > 5);
            suggestions.push(...lines);
            break;
        }
    }

    // 問題がなかった場合の判定
    const noIssueKeywords = ['問題なし', '整合性', '問題は見つかり', 'no issues', '✅'];
    const hasNoIssues = noIssueKeywords.some(k => content.toLowerCase().includes(k.toLowerCase())) && issues.length === 0;

    return {
        hasIssues: !hasNoIssues && (issues.length > 0 || content.includes('問題') || content.includes('矛盾')),
        issues,
        suggestions,
    };
}
