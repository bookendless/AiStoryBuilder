import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Download, FileText, File, Globe, Check, Copy, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../Toast';
import { escapeHtml, sanitizeFileName } from '../../utils/securityUtils';
import { isTauriEnvironment } from '../../utils/platformUtils';
import { StepNavigation } from '../common/StepNavigation';
import { Step } from '../../contexts/ProjectContext';

interface ExportStepProps {
  onNavigateToStep?: (step: Step) => void;
}

export const ExportStep: React.FC<ExportStepProps> = ({ onNavigateToStep }) => {
  const { currentProject } = useProject();
  const { showSuccess, showError } = useToast();
  const [selectedFormat, setSelectedFormat] = useState('txt');
  const [isExporting, setIsExporting] = useState(false);

  // エクスポート内容の選択
  const [exportOptions, setExportOptions] = useState({
    basicInfo: true,
    characters: true,
    plot: true,
    synopsis: true,
    chapters: true,
    imageBoard: true,
    draft: true,
    glossary: true,
    relationships: true,
    timeline: true,
    worldSettings: true,
    foreshadowings: true,
    memo: true,
  });

  // プリセット定義
  const exportPresets = {
    full: {
      name: '完全版',
      description: 'すべての項目を含む',
      options: {
        basicInfo: true,
        characters: true,
        plot: true,
        synopsis: true,
        chapters: true,
        imageBoard: true,
        draft: true,
        glossary: true,
        relationships: true,
        timeline: true,
        worldSettings: true,
        foreshadowings: true,
        memo: true,
      },
    },
    draftOnly: {
      name: '草案のみ',
      description: '草案のみをエクスポート',
      options: {
        basicInfo: false,
        characters: false,
        plot: false,
        synopsis: false,
        chapters: false,
        imageBoard: false,
        draft: true,
        glossary: false,
        relationships: false,
        timeline: false,
        worldSettings: false,
        foreshadowings: false,
        memo: false,
      },
    },
    settingsOnly: {
      name: '設定資料のみ',
      description: '設定資料のみをエクスポート（草案・メモを除く）',
      options: {
        basicInfo: true,
        characters: true,
        plot: true,
        synopsis: true,
        chapters: true,
        imageBoard: true,
        draft: false,
        glossary: true,
        relationships: true,
        timeline: true,
        worldSettings: true,
        foreshadowings: true,
        memo: false,
      },
    },
  };

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // プリセットを適用する関数
  const applyPreset = (presetKey: keyof typeof exportPresets) => {
    const preset = exportPresets[presetKey];
    setExportOptions(preset.options);
    setSelectedPreset(presetKey);
  };

  // ファイル名のカスタマイズ
  const [customFileName, setCustomFileName] = useState('');
  const [addTimestamp, setAddTimestamp] = useState(false);
  const [addVersion, setAddVersion] = useState(false);
  const [versionNumber, setVersionNumber] = useState(1);

  const [lastExportPath, setLastExportPath] = useState<string | null>(null);

  // プレビュー機能の強化
  const PREVIEW_HEIGHT_DEFAULT = 384;
  const PREVIEW_HEIGHT_MIN = 200;
  const PREVIEW_HEIGHT_MAX = 800;
  const PREVIEW_HEIGHT_STEP = 100;
  const [previewHeight, setPreviewHeight] = useState(PREVIEW_HEIGHT_DEFAULT);
  const [previewSearch, setPreviewSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLPreElement | HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  // セクション名と検索文字列のマッピング
  const sectionSearchMap: Record<string, string | string[]> = {
    title: currentProject?.title || '',
    // '基本情報' はジャンル等が設定済みの場合のみ出力。'概要' にフォールバック
    basicInfo: ['基本情報', '概要'],
    characters: 'キャラクター一覧',
    plot: 'プロット',
    synopsis: 'あらすじ',
    chapters: '章立て',
    imageBoard: 'イメージボード',
    draft: '草案',
    glossary: '用語集',
    relationships: 'キャラクター相関図',
    timeline: 'タイムライン',
    worldSettings: '世界観設定',
    foreshadowings: '伏線トラッカー',
    memo: 'クイックメモ',
  };

  // 正規表現エスケープ関数
  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // セクションまでスクロールする関数
  const scrollToSection = (sectionId: string) => {
    setSelectedSection(sectionId);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    if (!previewRef.current || !previewContentRef.current) return;

    const candidateEntry = sectionSearchMap[sectionId];
    if (!candidateEntry) return;

    const candidates = Array.isArray(candidateEntry) ? candidateEntry : [candidateEntry];

    scrollTimeoutRef.current = window.setTimeout(() => {
      if (!previewContentRef.current || !previewRef.current) return;

      const contentEl = previewContentRef.current;
      const container = previewRef.current;
      let scrolled = false;

      for (const searchText of candidates) {
        if (!searchText || scrolled) break;

        // Range API でテキストノードの実際のピクセル位置を取得
        const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        let found = false;

        while ((node = walker.nextNode() as Text | null) && !found) {
          const nodeText = node.textContent || '';
          const idx = nodeText.indexOf(searchText);
          if (idx !== -1) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + searchText.length);

            const rangeRect = range.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            const scrollTop = container.scrollTop + rangeRect.top - containerRect.top - 20;
            container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
            found = true;
            scrolled = true;
          }
        }

        // フォールバック: previewSearch でテキストノードが分断された場合のみ使用
        if (!found) {
          const fullText = contentEl.textContent || '';
          const matchIdx = fullText.indexOf(searchText);
          if (matchIdx !== -1) {
            const scrollPosition = (matchIdx / fullText.length) * container.scrollHeight;
            container.scrollTo({
              top: Math.max(0, scrollPosition - 20),
              behavior: 'smooth',
            });
            scrolled = true;
          }
        }
      }

      scrollTimeoutRef.current = null;
    }, 100);
  };

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 草案の文字数を計算する
  const draftTotalLength = useMemo(() => {
    if (!currentProject) return 0;
    // すべての章の草案文字数を合計
    const chapterDraftLength = currentProject.chapters.reduce((sum, chapter) => {
      return sum + (chapter.draft?.length || 0);
    }, 0);

    // プロジェクト全体の草案文字数を追加（重複を避ける）
    const projectDraft = currentProject.draft?.trim() || '';
    const projectDraftLength = projectDraft.length;

    // プロジェクト全体の草案が章の草案に含まれていない場合のみ追加
    const isProjectDraftInChapters = currentProject.chapters.some(
      chapter => chapter.draft?.includes(projectDraft)
    );

    return chapterDraftLength + (isProjectDraftInChapters ? 0 : projectDraftLength);
  }, [currentProject]);

  const exportFormats = [
    { id: 'txt', name: 'テキスト (.txt)', icon: FileText, description: 'シンプルなテキスト形式' },
    { id: 'md', name: 'マークダウン (.md)', icon: File, description: '構造化されたマークダウン形式' },
    { id: 'html', name: 'HTML (.html)', icon: Globe, description: 'Webブラウザで表示可能なHTML形式' },
  ];

  // ファイル名を生成する関数
  const generateFileName = (): string => {
    let fileName = customFileName || currentProject?.title || 'export';

    if (addVersion) {
      fileName += `_v${versionNumber}`;
    }

    if (addTimestamp) {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      fileName += `_${timestamp}`;
    }

    return fileName;
  };

  const handleExport = async () => {
    if (!currentProject) return;

    setIsExporting(true);

    try {
      let content = '';

      if (selectedFormat === 'txt') {
        content = generateTxtContent();
      } else if (selectedFormat === 'md') {
        content = generateMarkdownContent();
      } else if (selectedFormat === 'html') {
        content = generateHtmlContent();
      }

      const rawFileName = generateFileName();
      const fileName = sanitizeFileName(rawFileName);

      // Tauri環境かどうかを確認（Tauri 2対応）
      const isTauri = isTauriEnvironment();

      // Tauri環境（デスクトップまたはAndroid/iOS）
      if (isTauri) {
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');

          const filePath = await save({
            title: 'ファイルを保存',
            defaultPath: lastExportPath ? `${lastExportPath}/${fileName}.${selectedFormat}` : `${fileName}.${selectedFormat}`,
            filters: [
              {
                name: 'Files',
                extensions: [selectedFormat]
              }
            ]
          });

          if (filePath) {
            await writeTextFile(filePath, content);
            setLastExportPath(filePath);

            try {
              await navigator.clipboard.writeText(content);
            } catch (e) {
              console.warn('クリップボードへのコピーに失敗', e);
            }

            showSuccess('ファイルを指定の場所に保存しました');
            setIsExporting(false);
            return;
          }

          if (filePath === null) {
            setIsExporting(false);
            return;
          }
        } catch (pluginError) {
          console.warn('Tauri plugin error, falling back to share/download:', pluginError);
        }
      }

      let exported = false;

      // Share APIを試行
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          const mimeType = selectedFormat === 'html' ? 'text/html' : selectedFormat === 'md' ? 'text/markdown' : 'text/plain';
          const file = new (window.File || File)([content], `${fileName}.${selectedFormat}`, { type: mimeType }) as File;

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: fileName,
              files: [file]
            });
            showSuccess('共有メニューを開きました');
            exported = true;
          } else {
            await navigator.share({
              title: fileName,
              text: content
            });
            showSuccess('テキストとして共有しました');
            exported = true;
          }
        } catch (shareError: unknown) {
          if (shareError instanceof Error && shareError.name !== 'AbortError') {
            console.warn('Share API failed:', shareError.message);
          }
        }
      }

      // ブラウザダウンロード
      if (!exported) {
        const blob = new Blob([content], {
          type: selectedFormat === 'html' ? 'text/html' : selectedFormat === 'md' ? 'text/markdown' : 'text/plain'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.${selectedFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        try {
          await navigator.clipboard.writeText(content);
        } catch (e) {
          console.warn('クリップボードへのコピーに失敗', e);
        }

        showSuccess('ブラウザ経由でダウンロードを開始しました');
      }

    } catch (error) {
      console.error('Export error:', error);
      showError('エクスポートに失敗しました: ' + (error as Error).message, 7000, {
        title: 'エクスポートエラー',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // クリップボードにコピーする関数
  const handleCopyToClipboard = async () => {
    if (!currentProject) return;

    let content = '';
    if (selectedFormat === 'txt') {
      content = generateTxtContent();
    } else if (selectedFormat === 'md') {
      content = generateMarkdownContent();
    } else if (selectedFormat === 'html') {
      content = generateHtmlContent();
    }

    try {
      await navigator.clipboard.writeText(content);
      showSuccess('クリップボードにコピーしました');
    } catch (error) {
      console.error('Copy error:', error);
      showError('クリップボードへのコピーに失敗しました', 5000, {
        title: 'コピーエラー',
      });
    }
  };


  const STRUCTURE_LABELS: Record<string, string> = {
    'kishotenketsu': '起承転結',
    'three-act': '三幕構成',
    'four-act': '四幕構成',
    'heroes-journey': 'ヒーローズ・ジャーニー',
    'beat-sheet': 'ビートシート',
    'mystery-suspense': 'ミステリー・サスペンス',
  };

  const generateTxtContent = useCallback(() => {
    if (!currentProject) return '';

    let content = `${currentProject.title}\n`;
    content += '='.repeat(currentProject.title.length) + '\n\n';

    if (exportOptions.basicInfo) {
      if (currentProject.description) {
        content += `概要: ${currentProject.description}\n\n`;
      }

      // ジャンル・読者層・テーマ情報の追加
      if (currentProject.mainGenre || currentProject.subGenre || currentProject.targetReader || currentProject.projectTheme) {
        content += '基本情報\n';
        content += '-'.repeat(20) + '\n';
        if (currentProject.mainGenre) content += `メインジャンル: ${currentProject.mainGenre}\n`;
        if (currentProject.subGenre) content += `サブジャンル: ${currentProject.subGenre}\n`;
        if (currentProject.targetReader) content += `読者層: ${currentProject.targetReader}\n`;
        if (currentProject.projectTheme) content += `プロジェクトテーマ: ${currentProject.projectTheme}\n`;
        content += '\n';
      }
    }

    if (exportOptions.characters && currentProject.characters.length > 0) {
      content += 'キャラクター一覧\n';
      content += '-'.repeat(20) + '\n';
      currentProject.characters.forEach(char => {
        content += `${char.name} (${char.role})\n`;
        if (char.appearance) content += `外見: ${char.appearance}\n`;
        if (char.personality) content += `性格: ${char.personality}\n`;
        if (char.background) content += `背景: ${char.background}\n`;
        content += '\n';
      });
    }

    if (exportOptions.plot && (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.hook || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle || currentProject.plot.ending)) {
      content += 'プロット\n';
      content += '-'.repeat(20) + '\n';
      if (currentProject.plot.theme) content += `テーマ: ${currentProject.plot.theme}\n\n`;
      if (currentProject.plot.setting) content += `舞台: ${currentProject.plot.setting}\n\n`;
      if (currentProject.plot.hook) content += `フック: ${currentProject.plot.hook}\n\n`;
      if (currentProject.plot.protagonistGoal) content += `主人公の目標: ${currentProject.plot.protagonistGoal}\n\n`;
      if (currentProject.plot.mainObstacle) content += `主要な障害: ${currentProject.plot.mainObstacle}\n\n`;
      if (currentProject.plot.ending) content += `物語の結末: ${currentProject.plot.ending}\n\n`;

      // 構成詳細の追加
      if (currentProject.plot.structure) {
        const structureLabel = STRUCTURE_LABELS[currentProject.plot.structure] || currentProject.plot.structure;
        content += `プロット構成形式: ${structureLabel}\n\n`;
      }
      if (currentProject.plot.structure === 'kishotenketsu') {
        if (currentProject.plot.ki) content += `起（導入）: ${currentProject.plot.ki}\n\n`;
        if (currentProject.plot.sho) content += `承（展開）: ${currentProject.plot.sho}\n\n`;
        if (currentProject.plot.ten) content += `転（転換）: ${currentProject.plot.ten}\n\n`;
        if (currentProject.plot.ketsu) content += `結（結末）: ${currentProject.plot.ketsu}\n\n`;
      } else if (currentProject.plot.structure === 'three-act') {
        if (currentProject.plot.act1) content += `第1幕（導入）: ${currentProject.plot.act1}\n\n`;
        if (currentProject.plot.act2) content += `第2幕（展開）: ${currentProject.plot.act2}\n\n`;
        if (currentProject.plot.act3) content += `第3幕（結末）: ${currentProject.plot.act3}\n\n`;
      } else if (currentProject.plot.structure === 'four-act') {
        if (currentProject.plot.fourAct1) content += `第1幕（秩序）: ${currentProject.plot.fourAct1}\n\n`;
        if (currentProject.plot.fourAct2) content += `第2幕（混沌）: ${currentProject.plot.fourAct2}\n\n`;
        if (currentProject.plot.fourAct3) content += `第3幕（秩序）: ${currentProject.plot.fourAct3}\n\n`;
        if (currentProject.plot.fourAct4) content += `第4幕（混沌）: ${currentProject.plot.fourAct4}\n\n`;
      } else if (currentProject.plot.structure === 'heroes-journey') {
        if (currentProject.plot.hj1) content += `日常の世界: ${currentProject.plot.hj1}\n\n`;
        if (currentProject.plot.hj2) content += `冒険への誘い: ${currentProject.plot.hj2}\n\n`;
        if (currentProject.plot.hj3) content += `境界越え: ${currentProject.plot.hj3}\n\n`;
        if (currentProject.plot.hj4) content += `試練と仲間: ${currentProject.plot.hj4}\n\n`;
        if (currentProject.plot.hj5) content += `最大の試練: ${currentProject.plot.hj5}\n\n`;
        if (currentProject.plot.hj6) content += `報酬: ${currentProject.plot.hj6}\n\n`;
        if (currentProject.plot.hj7) content += `帰路: ${currentProject.plot.hj7}\n\n`;
        if (currentProject.plot.hj8) content += `復活と帰還: ${currentProject.plot.hj8}\n\n`;
      } else if (currentProject.plot.structure === 'beat-sheet') {
        if (currentProject.plot.bs1) content += `導入 (Setup): ${currentProject.plot.bs1}\n\n`;
        if (currentProject.plot.bs2) content += `決断 (Break into Two): ${currentProject.plot.bs2}\n\n`;
        if (currentProject.plot.bs3) content += `試練 (Fun and Games): ${currentProject.plot.bs3}\n\n`;
        if (currentProject.plot.bs4) content += `転換点 (Midpoint): ${currentProject.plot.bs4}\n\n`;
        if (currentProject.plot.bs5) content += `危機 (All Is Lost): ${currentProject.plot.bs5}\n\n`;
        if (currentProject.plot.bs6) content += `クライマックス (Finale): ${currentProject.plot.bs6}\n\n`;
        if (currentProject.plot.bs7) content += `結末 (Final Image): ${currentProject.plot.bs7}\n\n`;
      } else if (currentProject.plot.structure === 'mystery-suspense') {
        if (currentProject.plot.ms1) content += `発端（事件発生）: ${currentProject.plot.ms1}\n\n`;
        if (currentProject.plot.ms2) content += `捜査（初期）: ${currentProject.plot.ms2}\n\n`;
        if (currentProject.plot.ms3) content += `仮説とミスリード: ${currentProject.plot.ms3}\n\n`;
        if (currentProject.plot.ms4) content += `第二の事件/急展開: ${currentProject.plot.ms4}\n\n`;
        if (currentProject.plot.ms5) content += `手がかりの統合: ${currentProject.plot.ms5}\n\n`;
        if (currentProject.plot.ms6) content += `解決（真相解明）: ${currentProject.plot.ms6}\n\n`;
        if (currentProject.plot.ms7) content += `エピローグ: ${currentProject.plot.ms7}\n\n`;
      }
    }

    if (exportOptions.synopsis && currentProject.synopsis) {
      content += 'あらすじ\n';
      content += '-'.repeat(20) + '\n';
      content += `${currentProject.synopsis}\n\n`;
    }

    if (exportOptions.chapters && currentProject.chapters.length > 0) {
      content += '章立て\n';
      content += '-'.repeat(20) + '\n';
      currentProject.chapters.forEach((chapter, index) => {
        content += `第${index + 1}章: ${chapter.title}\n`;
        if (chapter.summary) content += `あらすじ: ${chapter.summary}\n`;
        if (chapter.setting) content += `設定・場所: ${chapter.setting}\n`;
        if (chapter.mood) content += `雰囲気・ムード: ${chapter.mood}\n`;
        if (chapter.keyEvents && chapter.keyEvents.length > 0) {
          content += `重要な出来事:\n`;
          chapter.keyEvents.forEach(event => {
            content += `  - ${event}\n`;
          });
        }
        content += '\n';
      });
    }

    if (exportOptions.imageBoard && currentProject.imageBoard.length > 0) {
      content += 'イメージボード\n';
      content += '-'.repeat(20) + '\n';
      currentProject.imageBoard.forEach((image, index) => {
        content += `${index + 1}. ${image.title} (${image.category})\n`;
        if (image.description) content += `   ${image.description}\n`;
        content += `   URL: ${image.url}\n\n`;
      });
    }

    if (exportOptions.draft) {
      // すべての章の草案を結合
      const allDrafts = currentProject.chapters
        .map((chapter, index) => {
          const chapterDraft = chapter.draft || '';
          if (chapterDraft.trim()) {
            return `【第${index + 1}章: ${chapter.title}】\n${chapterDraft}`;
          }
          return null;
        })
        .filter((draft): draft is string => draft !== null);

      // プロジェクト全体の草案がある場合は追加
      const projectDraft = currentProject.draft?.trim() || '';

      if (allDrafts.length > 0 || projectDraft) {
        content += '草案\n';
        content += '-'.repeat(20) + '\n';

        // 章の草案を追加
        if (allDrafts.length > 0) {
          content += allDrafts.join('\n\n') + '\n\n';
        }

        // プロジェクト全体の草案がある場合は追加
        if (projectDraft && !allDrafts.some(d => d.includes(projectDraft))) {
          content += `${projectDraft}\n\n`;
        }
      }
    }

    if (exportOptions.glossary && currentProject.glossary && currentProject.glossary.length > 0) {
      content += '用語集\n';
      content += '-'.repeat(20) + '\n';
      currentProject.glossary.forEach(term => {
        content += `${term.term}`;
        if (term.reading) content += ` (${term.reading})`;
        content += ` [${term.category}]\n`;
        content += `定義: ${term.definition}\n`;
        if (term.notes) content += `備考: ${term.notes}\n`;
        content += '\n';
      });
    }

    if (exportOptions.relationships && currentProject.relationships && currentProject.relationships.length > 0) {
      content += 'キャラクター相関図\n';
      content += '-'.repeat(20) + '\n';
      currentProject.relationships.forEach(rel => {
        const fromChar = currentProject.characters.find(c => c.id === rel.from);
        const toChar = currentProject.characters.find(c => c.id === rel.to);
        const fromName = fromChar?.name || rel.from;
        const toName = toChar?.name || rel.to;
        content += `${fromName} → ${toName} [${rel.type}] (強度: ${rel.strength}/10)\n`;
        if (rel.description) content += `説明: ${rel.description}\n`;
        if (rel.notes) content += `備考: ${rel.notes}\n`;
        content += '\n';
      });
    }

    if (exportOptions.timeline && currentProject.timeline && currentProject.timeline.length > 0) {
      content += 'タイムライン\n';
      content += '-'.repeat(20) + '\n';
      const sortedTimeline = [...currentProject.timeline].sort((a, b) => a.order - b.order);
      sortedTimeline.forEach(event => {
        content += `${event.order}. ${event.title} [${event.category}]\n`;
        if (event.date) content += `日付: ${event.date}\n`;
        content += `説明: ${event.description}\n`;
        if (event.characterIds && event.characterIds.length > 0) {
          const charNames = event.characterIds
            .map(id => currentProject.characters.find(c => c.id === id)?.name || id)
            .join(', ');
          content += `関連キャラクター: ${charNames}\n`;
        }
        if (event.chapterId) {
          const chapter = currentProject.chapters.find(c => c.id === event.chapterId);
          if (chapter) content += `関連章: ${chapter.title}\n`;
        }
        content += '\n';
      });
    }

    if (exportOptions.worldSettings && currentProject.worldSettings && currentProject.worldSettings.length > 0) {
      content += '世界観設定\n';
      content += '-'.repeat(20) + '\n';
      currentProject.worldSettings.forEach(setting => {
        content += `${setting.title} [${setting.category}]\n`;
        content += `${setting.content}\n`;
        if (setting.tags && setting.tags.length > 0) {
          content += `タグ: ${setting.tags.join(', ')}\n`;
        }
        content += '\n';
      });
    }

    if (exportOptions.foreshadowings && currentProject.foreshadowings && currentProject.foreshadowings.length > 0) {
      const statusLabels: Record<string, string> = { planted: '設置済み', hinted: '進行中', resolved: '回収済み', abandoned: '破棄' };
      const categoryLabels: Record<string, string> = { character: 'キャラクター', plot: 'プロット', world: '世界観', mystery: 'ミステリー', relationship: '人間関係', other: 'その他' };
      const importanceLabels: Record<string, string> = { high: '★★★高', medium: '★★☆中', low: '★☆☆低' };
      const pointTypeLabels: Record<string, string> = { plant: '📍設置', hint: '💡ヒント', payoff: '🎯回収' };

      content += '伏線トラッカー\n';
      content += '-'.repeat(20) + '\n';
      currentProject.foreshadowings.forEach(foreshadowing => {
        content += `${foreshadowing.title} [${categoryLabels[foreshadowing.category] || foreshadowing.category}]\n`;
        content += `ステータス: ${statusLabels[foreshadowing.status] || foreshadowing.status}\n`;
        content += `重要度: ${importanceLabels[foreshadowing.importance] || foreshadowing.importance}\n`;
        content += `説明: ${foreshadowing.description}\n`;

        if (foreshadowing.points && foreshadowing.points.length > 0) {
          content += 'ポイント:\n';
          foreshadowing.points.forEach(point => {
            const chapter = currentProject.chapters.find(c => c.id === point.chapterId);
            const chapterTitle = chapter?.title || '不明な章';
            content += `  - ${pointTypeLabels[point.type] || point.type}: ${point.description} (${chapterTitle})\n`;
            if (point.lineReference) content += `    引用: 「${point.lineReference}」\n`;
          });
        }

        if (foreshadowing.relatedCharacterIds && foreshadowing.relatedCharacterIds.length > 0) {
          const charNames = foreshadowing.relatedCharacterIds
            .map(id => currentProject.characters.find(c => c.id === id)?.name || id)
            .join(', ');
          content += `関連キャラクター: ${charNames}\n`;
        }

        if (foreshadowing.plannedPayoffChapterId) {
          const chapter = currentProject.chapters.find(c => c.id === foreshadowing.plannedPayoffChapterId);
          if (chapter) content += `回収予定章: ${chapter.title}\n`;
          if (foreshadowing.plannedPayoffDescription) content += `回収予定方法: ${foreshadowing.plannedPayoffDescription}\n`;
        }

        if (foreshadowing.tags && foreshadowing.tags.length > 0) {
          content += `タグ: ${foreshadowing.tags.join(', ')}\n`;
        }
        if (foreshadowing.notes) content += `メモ: ${foreshadowing.notes}\n`;
        content += '\n';
      });

      // 伏線サマリー
      const unresolvedCount = currentProject.foreshadowings.filter(f => f.status === 'planted' || f.status === 'hinted').length;
      const resolvedCount = currentProject.foreshadowings.filter(f => f.status === 'resolved').length;
      content += `【伏線サマリー】全${currentProject.foreshadowings.length}件 / 回収済み${resolvedCount}件 / 未回収${unresolvedCount}件\n\n`;
    }

    if (exportOptions.memo) {
      const memoStorageKey = currentProject ? `toolsSidebarMemo:${currentProject.id}` : 'toolsSidebarMemo:global';
      try {
        const savedMemo = localStorage.getItem(memoStorageKey);
        if (savedMemo) {
          const memoData = JSON.parse(savedMemo) as Record<string, string>;
          const memoLabels: Record<string, string> = {
            ideas: 'アイデア',
            tasks: 'タスク',
            notes: 'メモ',
          };
          const hasMemo = Object.values(memoData).some(v => v && v.trim().length > 0);
          if (hasMemo) {
            content += 'クイックメモ\n';
            content += '-'.repeat(20) + '\n';
            Object.entries(memoData).forEach(([key, value]) => {
              if (value && value.trim().length > 0) {
                content += `${memoLabels[key] || key}:\n${value}\n\n`;
              }
            });
          }
        }
      } catch (error) {
        console.error('メモ読み込みエラー:', error);
      }
    }

    return content;
  }, [currentProject, exportOptions]);

  const generateMarkdownContent = useCallback(() => {
    if (!currentProject) return '';

    let content = `# ${currentProject.title}\n\n`;

    if (exportOptions.basicInfo) {
      if (currentProject.description) {
        content += `## 概要\n\n${currentProject.description}\n\n`;
      }

      // ジャンル・読者層・テーマ情報の追加
      if (currentProject.mainGenre || currentProject.subGenre || currentProject.targetReader || currentProject.projectTheme) {
        content += '## 基本情報\n\n';
        if (currentProject.mainGenre) content += `**メインジャンル**: ${currentProject.mainGenre}\n\n`;
        if (currentProject.subGenre) content += `**サブジャンル**: ${currentProject.subGenre}\n\n`;
        if (currentProject.targetReader) content += `**読者層**: ${currentProject.targetReader}\n\n`;
        if (currentProject.projectTheme) content += `**プロジェクトテーマ**: ${currentProject.projectTheme}\n\n`;
      }
    }

    if (exportOptions.characters && currentProject.characters.length > 0) {
      content += '## キャラクター一覧\n\n';
      currentProject.characters.forEach(char => {
        content += `### ${char.name} (${char.role})\n\n`;
        if (char.appearance) content += `**外見**: ${char.appearance}\n\n`;
        if (char.personality) content += `**性格**: ${char.personality}\n\n`;
        if (char.background) content += `**背景**: ${char.background}\n\n`;
      });
    }

    if (exportOptions.plot && (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.hook || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle || currentProject.plot.ending)) {
      content += '## プロット\n\n';
      if (currentProject.plot.theme) content += `**テーマ**: ${currentProject.plot.theme}\n\n`;
      if (currentProject.plot.setting) content += `**舞台**: ${currentProject.plot.setting}\n\n`;
      if (currentProject.plot.hook) content += `**フック**: ${currentProject.plot.hook}\n\n`;
      if (currentProject.plot.protagonistGoal) content += `**主人公の目標**: ${currentProject.plot.protagonistGoal}\n\n`;
      if (currentProject.plot.mainObstacle) content += `**主要な障害**: ${currentProject.plot.mainObstacle}\n\n`;
      if (currentProject.plot.ending) content += `**物語の結末**: ${currentProject.plot.ending}\n\n`;

      // 構成詳細の追加
      if (currentProject.plot.structure) {
        const structureLabel = STRUCTURE_LABELS[currentProject.plot.structure] || currentProject.plot.structure;
        content += `**プロット構成形式**: ${structureLabel}\n\n`;
      }
      if (currentProject.plot.structure === 'kishotenketsu') {
        if (currentProject.plot.ki) content += `**起（導入）**: ${currentProject.plot.ki}\n\n`;
        if (currentProject.plot.sho) content += `**承（展開）**: ${currentProject.plot.sho}\n\n`;
        if (currentProject.plot.ten) content += `**転（転換）**: ${currentProject.plot.ten}\n\n`;
        if (currentProject.plot.ketsu) content += `**結（結末）**: ${currentProject.plot.ketsu}\n\n`;
      } else if (currentProject.plot.structure === 'three-act') {
        if (currentProject.plot.act1) content += `**第1幕（導入）**: ${currentProject.plot.act1}\n\n`;
        if (currentProject.plot.act2) content += `**第2幕（展開）**: ${currentProject.plot.act2}\n\n`;
        if (currentProject.plot.act3) content += `**第3幕（結末）**: ${currentProject.plot.act3}\n\n`;
      } else if (currentProject.plot.structure === 'four-act') {
        if (currentProject.plot.fourAct1) content += `**第1幕（秩序）**: ${currentProject.plot.fourAct1}\n\n`;
        if (currentProject.plot.fourAct2) content += `**第2幕（混沌）**: ${currentProject.plot.fourAct2}\n\n`;
        if (currentProject.plot.fourAct3) content += `**第3幕（秩序）**: ${currentProject.plot.fourAct3}\n\n`;
        if (currentProject.plot.fourAct4) content += `**第4幕（混沌）**: ${currentProject.plot.fourAct4}\n\n`;
      } else if (currentProject.plot.structure === 'heroes-journey') {
        if (currentProject.plot.hj1) content += `**日常の世界**: ${currentProject.plot.hj1}\n\n`;
        if (currentProject.plot.hj2) content += `**冒険への誘い**: ${currentProject.plot.hj2}\n\n`;
        if (currentProject.plot.hj3) content += `**境界越え**: ${currentProject.plot.hj3}\n\n`;
        if (currentProject.plot.hj4) content += `**試練と仲間**: ${currentProject.plot.hj4}\n\n`;
        if (currentProject.plot.hj5) content += `**最大の試練**: ${currentProject.plot.hj5}\n\n`;
        if (currentProject.plot.hj6) content += `**報酬**: ${currentProject.plot.hj6}\n\n`;
        if (currentProject.plot.hj7) content += `**帰路**: ${currentProject.plot.hj7}\n\n`;
        if (currentProject.plot.hj8) content += `**復活と帰還**: ${currentProject.plot.hj8}\n\n`;
      } else if (currentProject.plot.structure === 'beat-sheet') {
        if (currentProject.plot.bs1) content += `**導入 (Setup)**: ${currentProject.plot.bs1}\n\n`;
        if (currentProject.plot.bs2) content += `**決断 (Break into Two)**: ${currentProject.plot.bs2}\n\n`;
        if (currentProject.plot.bs3) content += `**試練 (Fun and Games)**: ${currentProject.plot.bs3}\n\n`;
        if (currentProject.plot.bs4) content += `**転換点 (Midpoint)**: ${currentProject.plot.bs4}\n\n`;
        if (currentProject.plot.bs5) content += `**危機 (All Is Lost)**: ${currentProject.plot.bs5}\n\n`;
        if (currentProject.plot.bs6) content += `**クライマックス (Finale)**: ${currentProject.plot.bs6}\n\n`;
        if (currentProject.plot.bs7) content += `**結末 (Final Image)**: ${currentProject.plot.bs7}\n\n`;
      } else if (currentProject.plot.structure === 'mystery-suspense') {
        if (currentProject.plot.ms1) content += `**発端（事件発生）**: ${currentProject.plot.ms1}\n\n`;
        if (currentProject.plot.ms2) content += `**捜査（初期）**: ${currentProject.plot.ms2}\n\n`;
        if (currentProject.plot.ms3) content += `**仮説とミスリード**: ${currentProject.plot.ms3}\n\n`;
        if (currentProject.plot.ms4) content += `**第二の事件/急展開**: ${currentProject.plot.ms4}\n\n`;
        if (currentProject.plot.ms5) content += `**手がかりの統合**: ${currentProject.plot.ms5}\n\n`;
        if (currentProject.plot.ms6) content += `**解決（真相解明）**: ${currentProject.plot.ms6}\n\n`;
        if (currentProject.plot.ms7) content += `**エピローグ**: ${currentProject.plot.ms7}\n\n`;
      }
    }

    if (exportOptions.synopsis && currentProject.synopsis) {
      content += '## あらすじ\n\n';
      content += `${currentProject.synopsis}\n\n`;
    }

    if (exportOptions.chapters && currentProject.chapters.length > 0) {
      content += '## 章立て\n\n';
      currentProject.chapters.forEach((chapter, index) => {
        content += `### 第${index + 1}章: ${chapter.title}\n\n`;
        if (chapter.summary) content += `**あらすじ:** ${chapter.summary}\n\n`;
        if (chapter.setting) content += `**設定・場所:** ${chapter.setting}\n\n`;
        if (chapter.mood) content += `**雰囲気・ムード:** ${chapter.mood}\n\n`;
        if (chapter.keyEvents && chapter.keyEvents.length > 0) {
          content += `**重要な出来事:**\n\n`;
          chapter.keyEvents.forEach(event => {
            content += `- ${event}\n`;
          });
          content += '\n';
        }
      });
    }

    if (exportOptions.imageBoard && currentProject.imageBoard.length > 0) {
      content += '## イメージボード\n\n';
      currentProject.imageBoard.forEach((image, index) => {
        content += `### ${index + 1}. ${image.title} (${image.category})\n\n`;
        if (image.description) content += `${image.description}\n\n`;
        content += `![${image.title}](${image.url})\n\n`;
      });
    }

    if (exportOptions.draft) {
      // すべての章の草案を結合
      const allDrafts = currentProject.chapters
        .map((chapter, index) => {
          const chapterDraft = chapter.draft || '';
          if (chapterDraft.trim()) {
            return `### 第${index + 1}章: ${chapter.title}\n\n${chapterDraft}`;
          }
          return null;
        })
        .filter((draft): draft is string => draft !== null);

      // プロジェクト全体の草案がある場合は追加
      const projectDraft = currentProject.draft?.trim() || '';

      if (allDrafts.length > 0 || projectDraft) {
        content += '## 草案\n\n';

        // 章の草案を追加
        if (allDrafts.length > 0) {
          content += allDrafts.join('\n\n') + '\n\n';
        }

        // プロジェクト全体の草案がある場合は追加
        if (projectDraft && !allDrafts.some(d => d.includes(projectDraft))) {
          content += `${projectDraft}\n\n`;
        }
      }
    }

    if (exportOptions.glossary && currentProject.glossary && currentProject.glossary.length > 0) {
      content += '## 用語集\n\n';
      currentProject.glossary.forEach(term => {
        content += `### ${term.term}`;
        if (term.reading) content += ` (${term.reading})`;
        content += ` [${term.category}]\n\n`;
        content += `**定義**: ${term.definition}\n\n`;
        if (term.notes) content += `**備考**: ${term.notes}\n\n`;
      });
    }

    if (exportOptions.relationships && currentProject.relationships && currentProject.relationships.length > 0) {
      content += '## キャラクター相関図\n\n';
      currentProject.relationships.forEach(rel => {
        const fromChar = currentProject.characters.find(c => c.id === rel.from);
        const toChar = currentProject.characters.find(c => c.id === rel.to);
        const fromName = fromChar?.name || rel.from;
        const toName = toChar?.name || rel.to;
        content += `### ${fromName} → ${toName}\n\n`;
        content += `**関係性**: ${rel.type} (強度: ${rel.strength}/10)\n\n`;
        if (rel.description) content += `**説明**: ${rel.description}\n\n`;
        if (rel.notes) content += `**備考**: ${rel.notes}\n\n`;
      });
    }

    if (exportOptions.timeline && currentProject.timeline && currentProject.timeline.length > 0) {
      content += '## タイムライン\n\n';
      const sortedTimeline = [...currentProject.timeline].sort((a, b) => a.order - b.order);
      sortedTimeline.forEach(event => {
        content += `### ${event.order}. ${event.title} [${event.category}]\n\n`;
        if (event.date) content += `**日付**: ${event.date}\n\n`;
        content += `${event.description}\n\n`;
        if (event.characterIds && event.characterIds.length > 0) {
          const charNames = event.characterIds
            .map(id => currentProject.characters.find(c => c.id === id)?.name || id)
            .join(', ');
          content += `**関連キャラクター**: ${charNames}\n\n`;
        }
        if (event.chapterId) {
          const chapter = currentProject.chapters.find(c => c.id === event.chapterId);
          if (chapter) content += `**関連章**: ${chapter.title}\n\n`;
        }
      });
    }

    if (exportOptions.worldSettings && currentProject.worldSettings && currentProject.worldSettings.length > 0) {
      content += '## 世界観設定\n\n';
      currentProject.worldSettings.forEach(setting => {
        content += `### ${setting.title} [${setting.category}]\n\n`;
        content += `${setting.content}\n\n`;
        if (setting.tags && setting.tags.length > 0) {
          content += `**タグ**: ${setting.tags.join(', ')}\n\n`;
        }
      });
    }

    if (exportOptions.foreshadowings && currentProject.foreshadowings && currentProject.foreshadowings.length > 0) {
      const statusLabels: Record<string, string> = { planted: '設置済み', hinted: '進行中', resolved: '回収済み', abandoned: '破棄' };
      const categoryLabels: Record<string, string> = { character: 'キャラクター', plot: 'プロット', world: '世界観', mystery: 'ミステリー', relationship: '人間関係', other: 'その他' };
      const importanceLabels: Record<string, string> = { high: '★★★高', medium: '★★☆中', low: '★☆☆低' };
      const pointTypeLabels: Record<string, string> = { plant: '📍設置', hint: '💡ヒント', payoff: '🎯回収' };

      content += '## 伏線トラッカー\n\n';
      currentProject.foreshadowings.forEach(foreshadowing => {
        content += `### ${foreshadowing.title}\n\n`;
        content += `**カテゴリ**: ${categoryLabels[foreshadowing.category] || foreshadowing.category}\n\n`;
        content += `**ステータス**: ${statusLabels[foreshadowing.status] || foreshadowing.status}\n\n`;
        content += `**重要度**: ${importanceLabels[foreshadowing.importance] || foreshadowing.importance}\n\n`;
        content += `${foreshadowing.description}\n\n`;

        if (foreshadowing.points && foreshadowing.points.length > 0) {
          content += '#### ポイント\n\n';
          foreshadowing.points.forEach(point => {
            const chapter = currentProject.chapters.find(c => c.id === point.chapterId);
            const chapterTitle = chapter?.title || '不明な章';
            content += `- **${pointTypeLabels[point.type] || point.type}**: ${point.description} (${chapterTitle})\n`;
            if (point.lineReference) content += `  - 引用: 「${point.lineReference}」\n`;
          });
          content += '\n';
        }

        if (foreshadowing.relatedCharacterIds && foreshadowing.relatedCharacterIds.length > 0) {
          const charNames = foreshadowing.relatedCharacterIds
            .map(id => currentProject.characters.find(c => c.id === id)?.name || id)
            .join(', ');
          content += `**関連キャラクター**: ${charNames}\n\n`;
        }

        if (foreshadowing.plannedPayoffChapterId) {
          const chapter = currentProject.chapters.find(c => c.id === foreshadowing.plannedPayoffChapterId);
          if (chapter) content += `**回収予定章**: ${chapter.title}\n\n`;
          if (foreshadowing.plannedPayoffDescription) content += `**回収予定方法**: ${foreshadowing.plannedPayoffDescription}\n\n`;
        }

        if (foreshadowing.tags && foreshadowing.tags.length > 0) {
          content += `**タグ**: ${foreshadowing.tags.join(', ')}\n\n`;
        }
        if (foreshadowing.notes) content += `**メモ**: ${foreshadowing.notes}\n\n`;
      });

      // 伏線サマリー
      const unresolvedCount = currentProject.foreshadowings.filter(f => f.status === 'planted' || f.status === 'hinted').length;
      const resolvedCount = currentProject.foreshadowings.filter(f => f.status === 'resolved').length;
      content += `> **伏線サマリー**: 全${currentProject.foreshadowings.length}件 / 回収済み${resolvedCount}件 / 未回収${unresolvedCount}件\n\n`;
    }

    if (exportOptions.memo) {
      const memoStorageKey = currentProject ? `toolsSidebarMemo:${currentProject.id}` : 'toolsSidebarMemo:global';
      try {
        const savedMemo = localStorage.getItem(memoStorageKey);
        if (savedMemo) {
          const memoData = JSON.parse(savedMemo) as Record<string, string>;
          const memoLabels: Record<string, string> = {
            ideas: 'アイデア',
            tasks: 'タスク',
            notes: 'メモ',
          };
          const hasMemo = Object.values(memoData).some(v => v && v.trim().length > 0);
          if (hasMemo) {
            content += '## クイックメモ\n\n';
            Object.entries(memoData).forEach(([key, value]) => {
              if (value && value.trim().length > 0) {
                content += `### ${memoLabels[key] || key}\n\n${value}\n\n`;
              }
            });
          }
        }
      } catch (error) {
        console.error('メモ読み込みエラー:', error);
      }
    }

    return content;
  }, [currentProject, exportOptions]);

  const generateHtmlContent = useCallback(() => {
    if (!currentProject) return '';

    let content = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(currentProject.title)}</title>
    <style>
        body {
            font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #e74c3c;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #34495e;
            border-bottom: 2px solid #3498db;
            padding-bottom: 5px;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h3 {
            color: #2c3e50;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .character-card {
            background-color: #f8f9fa;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin: 10px 0;
            border-radius: 0 5px 5px 0;
        }
        .plot-item {
            background-color: #ecf0f1;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
        }
        .chapter-item {
            background-color: #f1f2f6;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #3498db;
        }
        .draft-content {
            background-color: #fff5f5;
            padding: 20px;
            border-radius: 5px;
            border: 1px solid #ffebee;
            white-space: pre-wrap;
        }
        .summary {
            color: #7f8c8d;
            font-style: italic;
        }
        .metadata {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(currentProject.title)}</h1>`;

    if (exportOptions.basicInfo) {
      if (currentProject.description) {
        content += `
    <div class="summary">
        <strong>概要:</strong> ${escapeHtml(currentProject.description)}
    </div>`;
      }

      // ジャンル・読者層・テーマ情報の追加
      if (currentProject.mainGenre || currentProject.subGenre || currentProject.targetReader || currentProject.projectTheme) {
        content += `
    <h2>基本情報</h2>
    <div class="metadata">`;
        if (currentProject.mainGenre) content += `
        <p><strong>メインジャンル:</strong> ${escapeHtml(currentProject.mainGenre)}</p>`;
        if (currentProject.subGenre) content += `
        <p><strong>サブジャンル:</strong> ${escapeHtml(currentProject.subGenre)}</p>`;
        if (currentProject.targetReader) content += `
        <p><strong>読者層:</strong> ${escapeHtml(currentProject.targetReader)}</p>`;
        if (currentProject.projectTheme) content += `
        <p><strong>プロジェクトテーマ:</strong> ${escapeHtml(currentProject.projectTheme)}</p>`;
        content += `
    </div>`;
      }
    }

    if (exportOptions.characters && currentProject.characters.length > 0) {
      content += `
    <h2>キャラクター一覧</h2>`;
      currentProject.characters.forEach(char => {
        content += `
    <div class="character-card">
        <h3>${escapeHtml(char.name)} (${escapeHtml(char.role)})</h3>`;
        if (char.appearance) content += `
        <p><strong>外見:</strong> ${escapeHtml(char.appearance)}</p>`;
        if (char.personality) content += `
        <p><strong>性格:</strong> ${escapeHtml(char.personality)}</p>`;
        if (char.background) content += `
        <p><strong>背景:</strong> ${escapeHtml(char.background)}</p>`;
        content += `
    </div>`;
      });
    }

    if (exportOptions.plot && (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.hook || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle || currentProject.plot.ending)) {
      content += `
    <h2>プロット</h2>`;
      if (currentProject.plot.theme) content += `
    <div class="plot-item">
        <strong>テーマ:</strong> ${escapeHtml(currentProject.plot.theme)}
    </div>`;
      if (currentProject.plot.setting) content += `
    <div class="plot-item">
        <strong>舞台:</strong> ${escapeHtml(currentProject.plot.setting)}
    </div>`;
      if (currentProject.plot.hook) content += `
    <div class="plot-item">
        <strong>フック:</strong> ${escapeHtml(currentProject.plot.hook)}
    </div>`;
      if (currentProject.plot.protagonistGoal) content += `
    <div class="plot-item">
        <strong>主人公の目標:</strong> ${escapeHtml(currentProject.plot.protagonistGoal)}
    </div>`;
      if (currentProject.plot.mainObstacle) content += `
    <div class="plot-item">
        <strong>主要な障害:</strong> ${escapeHtml(currentProject.plot.mainObstacle)}
    </div>`;
      if (currentProject.plot.ending) content += `
    <div class="plot-item">
        <strong>物語の結末:</strong> ${escapeHtml(currentProject.plot.ending)}
    </div>`;

      // 構成詳細の追加
      if (currentProject.plot.structure) {
        const structureLabel = STRUCTURE_LABELS[currentProject.plot.structure] || currentProject.plot.structure;
        content += `
    <div class="plot-item">
        <strong>プロット構成形式:</strong> ${escapeHtml(structureLabel)}
    </div>`;
      }
      if (currentProject.plot.structure === 'kishotenketsu') {
        if (currentProject.plot.ki) content += `
    <div class="plot-item">
        <strong>起（導入）:</strong> ${escapeHtml(currentProject.plot.ki)}
    </div>`;
        if (currentProject.plot.sho) content += `
    <div class="plot-item">
        <strong>承（展開）:</strong> ${escapeHtml(currentProject.plot.sho)}
    </div>`;
        if (currentProject.plot.ten) content += `
    <div class="plot-item">
        <strong>転（転換）:</strong> ${escapeHtml(currentProject.plot.ten)}
    </div>`;
        if (currentProject.plot.ketsu) content += `
    <div class="plot-item">
        <strong>結（結末）:</strong> ${escapeHtml(currentProject.plot.ketsu)}
    </div>`;
      } else if (currentProject.plot.structure === 'three-act') {
        if (currentProject.plot.act1) content += `
    <div class="plot-item">
        <strong>第1幕（導入）:</strong> ${escapeHtml(currentProject.plot.act1)}
    </div>`;
        if (currentProject.plot.act2) content += `
    <div class="plot-item">
        <strong>第2幕（展開）:</strong> ${escapeHtml(currentProject.plot.act2)}
    </div>`;
        if (currentProject.plot.act3) content += `
    <div class="plot-item">
        <strong>第3幕（結末）:</strong> ${escapeHtml(currentProject.plot.act3)}
    </div>`;
      } else if (currentProject.plot.structure === 'four-act') {
        if (currentProject.plot.fourAct1) content += `
    <div class="plot-item">
        <strong>第1幕（秩序）:</strong> ${escapeHtml(currentProject.plot.fourAct1)}
    </div>`;
        if (currentProject.plot.fourAct2) content += `
    <div class="plot-item">
        <strong>第2幕（混沌）:</strong> ${escapeHtml(currentProject.plot.fourAct2)}
    </div>`;
        if (currentProject.plot.fourAct3) content += `
    <div class="plot-item">
        <strong>第3幕（秩序）:</strong> ${escapeHtml(currentProject.plot.fourAct3)}
    </div>`;
        if (currentProject.plot.fourAct4) content += `
    <div class="plot-item">
        <strong>第4幕（混沌）:</strong> ${escapeHtml(currentProject.plot.fourAct4)}
    </div>`;
      } else if (currentProject.plot.structure === 'heroes-journey') {
        if (currentProject.plot.hj1) content += `
    <div class="plot-item">
        <strong>日常の世界:</strong> ${escapeHtml(currentProject.plot.hj1)}
    </div>`;
        if (currentProject.plot.hj2) content += `
    <div class="plot-item">
        <strong>冒険への誘い:</strong> ${escapeHtml(currentProject.plot.hj2)}
    </div>`;
        if (currentProject.plot.hj3) content += `
    <div class="plot-item">
        <strong>境界越え:</strong> ${escapeHtml(currentProject.plot.hj3)}
    </div>`;
        if (currentProject.plot.hj4) content += `
    <div class="plot-item">
        <strong>試練と仲間:</strong> ${escapeHtml(currentProject.plot.hj4)}
    </div>`;
        if (currentProject.plot.hj5) content += `
    <div class="plot-item">
        <strong>最大の試練:</strong> ${escapeHtml(currentProject.plot.hj5)}
    </div>`;
        if (currentProject.plot.hj6) content += `
    <div class="plot-item">
        <strong>報酬:</strong> ${escapeHtml(currentProject.plot.hj6)}
    </div>`;
        if (currentProject.plot.hj7) content += `
    <div class="plot-item">
        <strong>帰路:</strong> ${escapeHtml(currentProject.plot.hj7)}
    </div>`;
        if (currentProject.plot.hj8) content += `
    <div class="plot-item">
        <strong>復活と帰還:</strong> ${escapeHtml(currentProject.plot.hj8)}
    </div>`;
      } else if (currentProject.plot.structure === 'beat-sheet') {
        if (currentProject.plot.bs1) content += `
    <div class="plot-item">
        <strong>導入 (Setup):</strong> ${escapeHtml(currentProject.plot.bs1)}
    </div>`;
        if (currentProject.plot.bs2) content += `
    <div class="plot-item">
        <strong>決断 (Break into Two):</strong> ${escapeHtml(currentProject.plot.bs2)}
    </div>`;
        if (currentProject.plot.bs3) content += `
    <div class="plot-item">
        <strong>試練 (Fun and Games):</strong> ${escapeHtml(currentProject.plot.bs3)}
    </div>`;
        if (currentProject.plot.bs4) content += `
    <div class="plot-item">
        <strong>転換点 (Midpoint):</strong> ${escapeHtml(currentProject.plot.bs4)}
    </div>`;
        if (currentProject.plot.bs5) content += `
    <div class="plot-item">
        <strong>危機 (All Is Lost):</strong> ${escapeHtml(currentProject.plot.bs5)}
    </div>`;
        if (currentProject.plot.bs6) content += `
    <div class="plot-item">
        <strong>クライマックス (Finale):</strong> ${escapeHtml(currentProject.plot.bs6)}
    </div>`;
        if (currentProject.plot.bs7) content += `
    <div class="plot-item">
        <strong>結末 (Final Image):</strong> ${escapeHtml(currentProject.plot.bs7)}
    </div>`;
      } else if (currentProject.plot.structure === 'mystery-suspense') {
        if (currentProject.plot.ms1) content += `
    <div class="plot-item">
        <strong>発端（事件発生）:</strong> ${escapeHtml(currentProject.plot.ms1)}
    </div>`;
        if (currentProject.plot.ms2) content += `
    <div class="plot-item">
        <strong>捜査（初期）:</strong> ${escapeHtml(currentProject.plot.ms2)}
    </div>`;
        if (currentProject.plot.ms3) content += `
    <div class="plot-item">
        <strong>仮説とミスリード:</strong> ${escapeHtml(currentProject.plot.ms3)}
    </div>`;
        if (currentProject.plot.ms4) content += `
    <div class="plot-item">
        <strong>第二の事件/急展開:</strong> ${escapeHtml(currentProject.plot.ms4)}
    </div>`;
        if (currentProject.plot.ms5) content += `
    <div class="plot-item">
        <strong>手がかりの統合:</strong> ${escapeHtml(currentProject.plot.ms5)}
    </div>`;
        if (currentProject.plot.ms6) content += `
    <div class="plot-item">
        <strong>解決（真相解明）:</strong> ${escapeHtml(currentProject.plot.ms6)}
    </div>`;
        if (currentProject.plot.ms7) content += `
    <div class="plot-item">
        <strong>エピローグ:</strong> ${escapeHtml(currentProject.plot.ms7)}
    </div>`;
      }
    }

    if (exportOptions.synopsis && currentProject.synopsis) {
      content += `
    <h2>あらすじ</h2>
    <div class="draft-content">${escapeHtml(currentProject.synopsis)}</div>`;
    }

    if (exportOptions.chapters && currentProject.chapters.length > 0) {
      content += `
    <h2>章立て</h2>`;
      currentProject.chapters.forEach((chapter, index) => {
        content += `
    <div class="chapter-item">
        <h3>第${index + 1}章: ${escapeHtml(chapter.title)}</h3>`;
        if (chapter.summary) content += `
        <p class="summary"><strong>あらすじ:</strong> ${escapeHtml(chapter.summary)}</p>`;
        if (chapter.setting) content += `
        <p><strong>設定・場所:</strong> ${escapeHtml(chapter.setting)}</p>`;
        if (chapter.mood) content += `
        <p><strong>雰囲気・ムード:</strong> ${escapeHtml(chapter.mood)}</p>`;
        if (chapter.keyEvents && chapter.keyEvents.length > 0) {
          content += `
        <p><strong>重要な出来事:</strong></p>
        <ul>`;
          chapter.keyEvents.forEach(event => {
            content += `
            <li>${escapeHtml(event)}</li>`;
          });
          content += `
        </ul>`;
        }
        content += `
    </div>`;
      });
    }

    if (exportOptions.imageBoard && currentProject.imageBoard.length > 0) {
      content += `
    <h2>イメージボード</h2>`;
      currentProject.imageBoard.forEach((image, index) => {
        content += `
    <div class="character-card" style="margin-bottom: 20px;">
        <h3>${index + 1}. ${escapeHtml(image.title)} (${escapeHtml(image.category)})</h3>`;
        if (image.description) content += `
        <p><strong>説明:</strong> ${escapeHtml(image.description)}</p>`;
        // URLは検証済みと仮定するが、alt属性はエスケープ
        content += `
        <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.title)}" style="max-width: 100%; height: auto; margin-top: 10px; border-radius: 5px;">
    </div>`;
      });
    }

    if (exportOptions.draft) {
      // すべての章の草案を結合
      const allDrafts = currentProject.chapters
        .map((chapter, index) => {
          const chapterDraft = chapter.draft || '';
          if (chapterDraft.trim()) {
            return `<h3>第${index + 1}章: ${escapeHtml(chapter.title)}</h3>
    <div class="draft-content">${escapeHtml(chapterDraft)}</div>`;
          }
          return null;
        })
        .filter((draft): draft is string => draft !== null);

      // プロジェクト全体の草案がある場合は追加
      const projectDraft = currentProject.draft?.trim() || '';

      if (allDrafts.length > 0 || projectDraft) {
        content += `
    <h2>草案</h2>`;

        // 章の草案を追加
        if (allDrafts.length > 0) {
          content += allDrafts.join('\n');
        }

        // プロジェクト全体の草案がある場合は追加
        if (projectDraft && !allDrafts.some(d => d.includes(escapeHtml(projectDraft)))) {
          content += `
    <div class="draft-content">${escapeHtml(projectDraft)}</div>`;
        }
      }
    }

    if (exportOptions.glossary && currentProject.glossary && currentProject.glossary.length > 0) {
      content += `
    <h2>用語集</h2>`;
      currentProject.glossary.forEach(term => {
        content += `
    <div class="character-card">
        <h3>${escapeHtml(term.term)}`;
        if (term.reading) content += ` (${escapeHtml(term.reading)})`;
        content += ` [${escapeHtml(term.category)}]</h3>
        <p><strong>定義:</strong> ${escapeHtml(term.definition)}</p>`;
        if (term.notes) content += `
        <p><strong>備考:</strong> ${escapeHtml(term.notes)}</p>`;
        content += `
    </div>`;
      });
    }

    if (exportOptions.relationships && currentProject.relationships && currentProject.relationships.length > 0) {
      content += `
    <h2>キャラクター相関図</h2>`;
      currentProject.relationships.forEach(rel => {
        const fromChar = currentProject.characters.find(c => c.id === rel.from);
        const toChar = currentProject.characters.find(c => c.id === rel.to);
        const fromName = fromChar?.name || rel.from;
        const toName = toChar?.name || rel.to;
        content += `
    <div class="plot-item">
        <h3>${escapeHtml(fromName)} → ${escapeHtml(toName)}</h3>
        <p><strong>関係性:</strong> ${escapeHtml(rel.type)} (強度: ${rel.strength}/10)</p>`;
        if (rel.description) content += `
        <p><strong>説明:</strong> ${escapeHtml(rel.description)}</p>`;
        if (rel.notes) content += `
        <p><strong>備考:</strong> ${escapeHtml(rel.notes)}</p>`;
        content += `
    </div>`;
      });
    }

    if (exportOptions.timeline && currentProject.timeline && currentProject.timeline.length > 0) {
      content += `
    <h2>タイムライン</h2>`;
      const sortedTimeline = [...currentProject.timeline].sort((a, b) => a.order - b.order);
      sortedTimeline.forEach(event => {
        content += `
    <div class="chapter-item">
        <h3>${event.order}. ${escapeHtml(event.title)} [${escapeHtml(event.category)}]</h3>`;
        if (event.date) content += `
        <p><strong>日付:</strong> ${escapeHtml(event.date)}</p>`;
        content += `
        <p>${escapeHtml(event.description)}</p>`;
        if (event.characterIds && event.characterIds.length > 0) {
          const charNames = event.characterIds
            .map(id => currentProject.characters.find(c => c.id === id)?.name || id)
            .map(name => escapeHtml(name))
            .join(', ');
          content += `
        <p><strong>関連キャラクター:</strong> ${charNames}</p>`;
        }
        if (event.chapterId) {
          const chapter = currentProject.chapters.find(c => c.id === event.chapterId);
          if (chapter) content += `
        <p><strong>関連章:</strong> ${escapeHtml(chapter.title)}</p>`;
        }
        content += `
    </div>`;
      });
    }

    if (exportOptions.worldSettings && currentProject.worldSettings && currentProject.worldSettings.length > 0) {
      content += `
    <h2>世界観設定</h2>`;
      currentProject.worldSettings.forEach(setting => {
        content += `
    <div class="character-card">
        <h3>${escapeHtml(setting.title)} [${escapeHtml(setting.category)}]</h3>
        <div class="draft-content">${escapeHtml(setting.content)}</div>`;
        if (setting.tags && setting.tags.length > 0) {
          const escapedTags = setting.tags.map(t => escapeHtml(t));
          content += `
        <p><strong>タグ:</strong> ${escapedTags.map(t => `<span style="background: #e8e8e8; padding: 2px 6px; border-radius: 3px; margin-right: 4px;">#${t}</span>`).join(' ')}</p>`;
        }
        content += `
    </div>`;
      });
    }

    if (exportOptions.foreshadowings && currentProject.foreshadowings && currentProject.foreshadowings.length > 0) {
      const statusLabels: Record<string, string> = { planted: '設置済み', hinted: '進行中', resolved: '回収済み', abandoned: '破棄' };
      const categoryLabels: Record<string, string> = { character: 'キャラクター', plot: 'プロット', world: '世界観', mystery: 'ミステリー', relationship: '人間関係', other: 'その他' };
      const importanceLabels: Record<string, string> = { high: '★★★高', medium: '★★☆中', low: '★☆☆低' };
      const pointTypeLabels: Record<string, string> = { plant: '📍設置', hint: '💡ヒント', payoff: '🎯回収' };
      const statusColors: Record<string, string> = { planted: '#3498db', hinted: '#f39c12', resolved: '#27ae60', abandoned: '#7f8c8d' };

      content += `
    <h2>伏線トラッカー</h2>`;
      currentProject.foreshadowings.forEach(foreshadowing => {
        content += `
    <div class="character-card" style="border-left-color: ${statusColors[foreshadowing.status] || '#e74c3c'};">
        <h3>${escapeHtml(foreshadowing.title)}</h3>
        <div style="display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
            <span style="background-color: ${statusColors[foreshadowing.status] || '#e74c3c'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">
                ${escapeHtml(statusLabels[foreshadowing.status] || foreshadowing.status)}
            </span>
            <span style="background-color: #ecf0f1; padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">
                ${escapeHtml(categoryLabels[foreshadowing.category] || foreshadowing.category)}
            </span>
            <span style="font-size: 0.8em; color: ${foreshadowing.importance === 'high' ? '#e74c3c' : foreshadowing.importance === 'medium' ? '#f39c12' : '#7f8c8d'};">
                ${escapeHtml(importanceLabels[foreshadowing.importance] || foreshadowing.importance)}
            </span>
        </div>
        <p>${escapeHtml(foreshadowing.description)}</p>`;

        if (foreshadowing.points && foreshadowing.points.length > 0) {
          content += `
        <h4 style="margin-top: 15px;">ポイント</h4>
        <ul style="list-style: none; padding-left: 0;">`;
          foreshadowing.points.forEach(point => {
            const chapter = currentProject.chapters.find(c => c.id === point.chapterId);
            const chapterTitle = chapter?.title || '不明な章';
            content += `
            <li style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                <strong>${escapeHtml(pointTypeLabels[point.type] || point.type)}</strong>: ${escapeHtml(point.description)}
                <span style="color: #7f8c8d; font-size: 0.9em;"> (${escapeHtml(chapterTitle)})</span>`;
            if (point.lineReference) {
              content += `
                <div style="margin-top: 4px; font-style: italic; color: #7f8c8d;">「${escapeHtml(point.lineReference)}」</div>`;
            }
            content += `
            </li>`;
          });
          content += `
        </ul>`;
        }

        if (foreshadowing.relatedCharacterIds && foreshadowing.relatedCharacterIds.length > 0) {
          const charNames = foreshadowing.relatedCharacterIds
            .map(id => currentProject.characters.find(c => c.id === id)?.name || id)
            .map(name => escapeHtml(name))
            .join(', ');
          content += `
        <p><strong>関連キャラクター:</strong> ${charNames}</p>`;
        }

        if (foreshadowing.plannedPayoffChapterId) {
          const chapter = currentProject.chapters.find(c => c.id === foreshadowing.plannedPayoffChapterId);
          if (chapter) {
            content += `
        <p><strong>回収予定章:</strong> ${escapeHtml(chapter.title)}</p>`;
          }
          if (foreshadowing.plannedPayoffDescription) {
            content += `
        <p><strong>回収予定方法:</strong> ${escapeHtml(foreshadowing.plannedPayoffDescription)}</p>`;
          }
        }

        if (foreshadowing.tags && foreshadowing.tags.length > 0) {
          const escapedTags = foreshadowing.tags.map(t => escapeHtml(t));
          content += `
        <p><strong>タグ:</strong> ${escapedTags.map(t => `<span style="background: #e8e8e8; padding: 2px 6px; border-radius: 3px; margin-right: 4px;">#${t}</span>`).join(' ')}</p>`;
        }
        if (foreshadowing.notes) {
          content += `
        <p><strong>メモ:</strong> ${escapeHtml(foreshadowing.notes)}</p>`;
        }
        content += `
    </div>`;
      });

      // 伏線サマリー
      const unresolvedCount = currentProject.foreshadowings.filter(f => f.status === 'planted' || f.status === 'hinted').length;
      const resolvedCount = currentProject.foreshadowings.filter(f => f.status === 'resolved').length;
      content += `
    <div class="metadata" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <p><strong>伏線サマリー:</strong> 全${currentProject.foreshadowings.length}件 / 回収済み${resolvedCount}件 / 未回収${unresolvedCount}件</p>
    </div>`;
    }

    if (exportOptions.memo) {
      const memoStorageKey = currentProject ? `toolsSidebarMemo:${currentProject.id}` : 'toolsSidebarMemo:global';
      try {
        const savedMemo = localStorage.getItem(memoStorageKey);
        if (savedMemo) {
          const memoData = JSON.parse(savedMemo) as Record<string, string>;
          const memoLabels: Record<string, string> = {
            ideas: 'アイデア',
            tasks: 'タスク',
            notes: 'メモ',
          };
          const hasMemo = Object.values(memoData).some(v => v && v.trim().length > 0);
          if (hasMemo) {
            content += `
    <h2>クイックメモ</h2>`;
            Object.entries(memoData).forEach(([key, value]) => {
              if (value && value.trim().length > 0) {
                content += `
    <div class="character-card">
        <h3>${escapeHtml(memoLabels[key] || key)}</h3>
        <div class="draft-content">${escapeHtml(value)}</div>
    </div>`;
              }
            });
          }
        }
      } catch (error) {
        console.error('メモ読み込みエラー:', error);
      }
    }

    // 日付を安全に変換
    const createdAtDate = currentProject.createdAt instanceof Date ? currentProject.createdAt : new Date(currentProject.createdAt);
    const updatedAtDate = currentProject.updatedAt instanceof Date ? currentProject.updatedAt : new Date(currentProject.updatedAt);

    content += `
    <div class="metadata">
        <p><strong>作成日:</strong> ${createdAtDate.toLocaleDateString('ja-JP')}</p>
        <p><strong>更新日:</strong> ${updatedAtDate.toLocaleDateString('ja-JP')}</p>
    </div>
</body>
</html>`;

    return content;
  }, [currentProject, exportOptions]);

  const totalContentLength = useMemo(() => {
    if (!currentProject) return 0;
    if (selectedFormat === 'html') return generateHtmlContent().length;
    if (selectedFormat === 'md') return generateMarkdownContent().length;
    return generateTxtContent().length;
  }, [selectedFormat, currentProject, generateHtmlContent, generateMarkdownContent, generateTxtContent]);

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  return (
    <div className="space-y-8 overflow-y-auto">
      <StepNavigation
        currentStep="export"
        onPrevious={() => onNavigateToStep?.('review')}
        onNext={() => { }}
      />
      <div className="mb-4 lg:mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-amber-500">
            <Download className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            エクスポート
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          作成した物語をさまざまな形式でエクスポートできます。
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Export Options */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 lg:p-6 lg:w-[340px] lg:flex-shrink-0">
          <div className="mb-4 lg:mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              エクスポート形式
            </h3>
          </div>

          <div className="space-y-4">
            {exportFormats.map((format) => {
              const Icon = format.icon;
              return (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`w-full p-3 lg:p-4 rounded-lg border-2 transition-all text-left ${selectedFormat === format.id
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-700'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-6 w-6 ${selectedFormat === format.id
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-600 dark:text-gray-400'
                      }`} />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {format.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {format.description}
                      </div>
                    </div>
                    {selectedFormat === format.id && (
                      <Check className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ファイル名のカスタマイズ */}
          <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              ファイル名設定
            </h4>
            <div className="space-y-3">
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder={currentProject.title}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']"
              />
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addTimestamp}
                    onChange={(e) => setAddTimestamp(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    日時を追加
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addVersion}
                    onChange={(e) => setAddVersion(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    バージョン番号を追加
                  </span>
                </label>
                {addVersion && (
                  <input
                    type="number"
                    value={versionNumber}
                    onChange={(e) => setVersionNumber(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']"
                  />
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                ファイル名: {generateFileName()}.{selectedFormat}
              </div>
            </div>
          </div>

          {/* プリセット選択 */}
          <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              プリセット
            </h4>
            <div className="grid grid-cols-1 gap-2 mb-4">
              {Object.entries(exportPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key as keyof typeof exportPresets)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${selectedPreset === key
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-700'
                    }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']">
                    {preset.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* エクスポートする内容の選択 */}
          <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              エクスポートする内容
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { key: 'basicInfo', label: '基本情報' },
                { key: 'characters', label: 'キャラクター' },
                { key: 'plot', label: 'プロット' },
                { key: 'synopsis', label: 'あらすじ' },
                { key: 'chapters', label: '章立て' },
                { key: 'imageBoard', label: 'イメージボード' },
                { key: 'draft', label: '草案' },
                { key: 'glossary', label: '用語集' },
                { key: 'relationships', label: '相関図' },
                { key: 'timeline', label: 'タイムライン' },
                { key: 'worldSettings', label: '世界観' },
                { key: 'foreshadowings', label: '伏線トラッカー' },
                { key: 'memo', label: 'クイックメモ' },
              ].map((option) => (
                <label key={option.key} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions[option.key as keyof typeof exportOptions]}
                    onChange={(e) => {
                      setExportOptions({
                        ...exportOptions,
                        [option.key]: e.target.checked,
                      });
                      setSelectedPreset(null);
                    }}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-ai-500 to-ai-700 text-white px-6 py-3 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-semibold disabled:opacity-50 font-['Noto_Sans_JP']"
            >
              <Download className="h-5 w-5" />
              <span>{isExporting ? 'エクスポート中...' : 'エクスポート開始'}</span>
            </button>
            <button
              onClick={handleCopyToClipboard}
              className="w-full flex items-center justify-center space-x-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 font-semibold font-['Noto_Sans_JP']"
            >
              <Copy className="h-5 w-5" />
              <span>クリップボードにコピー</span>
            </button>
          </div>
        </div>

        {/* 右カラム: プロジェクト概要 + プレビュー */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Project Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 lg:p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 lg:mb-6 font-['Noto_Sans_JP']">
            プロジェクト概要
          </h3>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                {currentProject.title}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-['Noto_Sans_JP']">
                {currentProject.description || '説明なし'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-xs font-medium font-['Noto_Sans_JP']">
                キャラ <strong>{currentProject.characters.length}</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium font-['Noto_Sans_JP']">
                章 <strong>{currentProject.chapters.length}</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium font-['Noto_Sans_JP']">
                あらすじ <strong>{currentProject.synopsis.length}</strong>字
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium font-['Noto_Sans_JP']">
                草案 <strong>{draftTotalLength}</strong>字
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium font-['Noto_Sans_JP']">
                作成 {(currentProject.createdAt instanceof Date ? currentProject.createdAt : new Date(currentProject.createdAt)).toLocaleDateString('ja-JP')}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium font-['Noto_Sans_JP']">
                更新 {(currentProject.updatedAt instanceof Date ? currentProject.updatedAt : new Date(currentProject.updatedAt)).toLocaleDateString('ja-JP')}
              </span>
            </div>
          </div>
        </div>
        {/* エクスポートプレビュー */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            エクスポートプレビュー
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPreviewHeight(Math.max(PREVIEW_HEIGHT_MIN, previewHeight - PREVIEW_HEIGHT_STEP))}
              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="高さを減らす"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewHeight(Math.min(PREVIEW_HEIGHT_MAX, previewHeight + PREVIEW_HEIGHT_STEP))}
              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="高さを増やす"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 検索機能 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={previewSearch}
              onChange={(e) => setPreviewSearch(e.target.value)}
              placeholder="プレビュー内を検索..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-['Noto_Sans_JP']"
            />
            {previewSearch && (
              <button
                onClick={() => setPreviewSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* セクション別ジャンプ */}
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { id: 'title', label: 'タイトル' },
            { id: 'basicInfo', label: '基本情報' },
            { id: 'characters', label: 'キャラクター' },
            { id: 'plot', label: 'プロット' },
            { id: 'synopsis', label: 'あらすじ' },
            { id: 'chapters', label: '章立て' },
            { id: 'draft', label: '草案' },
            { id: 'glossary', label: '用語集' },
            { id: 'relationships', label: '相関図' },
            { id: 'timeline', label: 'タイムライン' },
            { id: 'worldSettings', label: '世界観' },
            { id: 'foreshadowings', label: '伏線トラッカー' },
            { id: 'memo', label: 'クイックメモ' },
          ]
            .filter((section) => exportOptions[section.id as keyof typeof exportOptions] || section.id === 'title')
            .map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors font-['Noto_Sans_JP'] ${selectedSection === section.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
              >
                {section.label}
              </button>
            ))}
        </div>

        <div
          ref={previewRef}
          className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg overflow-y-auto"
          style={{ maxHeight: `${previewHeight}px` }}
        >
          {selectedFormat === 'html' ? (
            <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              <p className="mb-2">HTML形式では、美しくスタイリングされた文書が生成されます。</p>
              <p className="mb-2">以下の内容が含まれます：</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                {exportOptions.basicInfo && <li>プロジェクトタイトルと概要</li>}
                {exportOptions.characters && <li>キャラクター一覧（外見・性格・背景情報付き）</li>}
                {exportOptions.plot && <li>プロット情報（テーマ・舞台・フック・構成詳細）</li>}
                {exportOptions.synopsis && <li>あらすじ</li>}
                {exportOptions.chapters && <li>章立て</li>}
                {exportOptions.imageBoard && <li>イメージボード</li>}
                {exportOptions.draft && <li>草案内容</li>}
                {exportOptions.glossary && <li>用語集</li>}
                {exportOptions.relationships && <li>キャラクター相関図</li>}
                {exportOptions.timeline && <li>タイムライン</li>}
                {exportOptions.worldSettings && <li>世界観設定</li>}
                {exportOptions.foreshadowings && <li>伏線トラッカー（サマリー付き）</li>}
                {exportOptions.memo && <li>クイックメモ</li>}
                <li>作成日・更新日のメタデータ</li>
              </ul>
              <p className="mt-4 text-xs text-gray-500">
                ※ HTMLファイルはWebブラウザで開くと、読みやすい形式で表示されます。
              </p>
            </div>
          ) : (
            <pre
              ref={previewContentRef as React.RefObject<HTMLPreElement>}
              className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP']"
            >
              {(() => {
                const content = selectedFormat === 'md' ? generateMarkdownContent() : generateTxtContent();
                if (previewSearch) {
                  try {
                    const escapedSearch = escapeRegex(previewSearch);
                    const searchRegex = new RegExp(escapedSearch, 'gi');
                    const parts = content.split(searchRegex);
                    const matches = content.match(searchRegex);
                    if (matches) {
                      return parts.map((part: string, i: number) => (
                        <React.Fragment key={i}>
                          {part}
                          {i < parts.length - 1 && matches && matches[i] && (
                            <mark className="bg-yellow-300 dark:bg-yellow-600">{matches[i]}</mark>
                          )}
                        </React.Fragment>
                      ));
                    }
                  } catch (error) {
                    console.warn('検索正規表現エラー:', error);
                    // エラー時は通常の文字列検索にフォールバック
                    const index = content.toLowerCase().indexOf(previewSearch.toLowerCase());
                    if (index !== -1) {
                      return (
                        <>
                          {content.substring(0, index)}
                          <mark className="bg-yellow-300 dark:bg-yellow-600">
                            {content.substring(index, index + previewSearch.length)}
                          </mark>
                          {content.substring(index + previewSearch.length)}
                        </>
                      );
                    }
                  }
                }
                return content;
              })()}
            </pre>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          <div>
            総文字数: {totalContentLength.toLocaleString()} 文字
          </div>
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center space-x-1 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
          >
            <Copy className="h-4 w-4" />
            <span>コピー</span>
          </button>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};