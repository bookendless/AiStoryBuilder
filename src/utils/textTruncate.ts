/**
 * 文境界を保った切り詰め
 *
 * プロンプトのコンテキスト整形と、あらすじの機械抽出の両方で使う。
 * どちらの利用側にも依存しない葉のモジュールとして置く
 * （RAG側に置くと、あらすじ鮮度のような純粋なサービスが React コンテキストまで引きずる）。
 */

/** 文境界（。！？改行）で maxLength 以内に切り詰める */
export const truncateAtSentence = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    const window = text.slice(0, maxLength);
    const cut = Math.max(
        window.lastIndexOf('。'),
        window.lastIndexOf('！'),
        window.lastIndexOf('？'),
        window.lastIndexOf('\n')
    );
    // 文境界が前半すぎる場合はそのまま切る（情報量を優先）
    return cut >= maxLength * 0.5 ? window.slice(0, cut + 1) : window + '…';
};
