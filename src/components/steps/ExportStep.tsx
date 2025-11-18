import React, { useState, useRef } from 'react';
import { Download, FileText, File, Globe, Check, Copy, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';

export const ExportStep: React.FC = () => {
  const { currentProject } = useProject();
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
    memo: true,
  });
  
  // ファイル名のカスタマイズ
  const [customFileName, setCustomFileName] = useState('');
  const [addTimestamp, setAddTimestamp] = useState(false);
  const [addVersion, setAddVersion] = useState(false);
  const [versionNumber, setVersionNumber] = useState(1);
  
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  
  // プレビュー機能の強化
  const [previewHeight, setPreviewHeight] = useState(384); // max-h-96 = 384px
  const [previewSearch, setPreviewSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLPreElement | HTMLDivElement>(null);
  
  // セクション名と検索文字列のマッピング
  const sectionSearchMap: Record<string, string> = {
    title: currentProject?.title || '',
    basicInfo: '基本情報',
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
    memo: 'クイックメモ',
  };
  
  // セクションまでスクロールする関数
  const scrollToSection = (sectionId: string) => {
    setSelectedSection(sectionId);
    
    if (!previewRef.current || !previewContentRef.current) return;
    
    const searchText = sectionSearchMap[sectionId];
    if (!searchText) return;
    
    // 少し遅延を入れて、コンテンツがレンダリングされた後にスクロール
    setTimeout(() => {
      if (!previewContentRef.current) return;
      
      const content = previewContentRef.current.textContent || '';
      const index = content.indexOf(searchText);
      
      if (index !== -1) {
        // テキストノード内の位置を計算
        const textNode = previewContentRef.current.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          // 範囲を作成してスクロール
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index);
          
          // 範囲を可視化するためにマーカー要素を作成
          const marker = document.createElement('span');
          marker.id = `section-marker-${sectionId}`;
          marker.style.position = 'absolute';
          marker.style.top = '0';
          marker.style.left = '0';
          marker.style.width = '1px';
          marker.style.height = '1px';
          marker.style.visibility = 'hidden';
          
          // より簡単な方法：テキストを検索して、その位置を計算
          const container = previewRef.current;
          if (container) {
            const scrollPosition = (index / content.length) * container.scrollHeight;
            container.scrollTo({
              top: Math.max(0, scrollPosition - 20), // 少し上に余白を持たせる
              behavior: 'smooth'
            });
          }
        } else {
          // HTMLコンテンツの場合、IDで検索
          const element = previewContentRef.current.querySelector(`#section-${sectionId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    }, 100);
  };

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
      
      const fileName = generateFileName();
      
      // Tauri環境かどうかを確認（Tauri 2対応）
      const isTauri = typeof window !== 'undefined' && 
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      
      if (!isTauri) {
        // ブラウザ環境の場合、ダウンロードリンクを作成
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
        
        // クリップボードにコピー
        try {
          await navigator.clipboard.writeText(content);
        } catch (e) {
          console.warn('クリップボードへのコピーに失敗しました', e);
        }
        
        alert('エクスポートが完了しました');
        setIsExporting(false);
        return;
      }
      
      // Tauri環境の場合、プラグインを動的にインポート
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        
        // 最近保存したフォルダがある場合はそれを使用、なければダイアログを表示
        let filePath: string | null = null;
        
        if (lastExportPath) {
          // 最後に保存したパスからディレクトリを取得
          const dirPath = lastExportPath.substring(0, Math.max(lastExportPath.lastIndexOf('/'), lastExportPath.lastIndexOf('\\')));
          filePath = await save({
            title: 'ファイルを保存',
            defaultPath: `${dirPath}/${fileName}.${selectedFormat}`,
            filters: [
              {
                name: 'Text Files',
                extensions: [selectedFormat]
              }
            ]
          });
        } else {
          filePath = await save({
            title: 'ファイルを保存',
            defaultPath: `${fileName}.${selectedFormat}`,
            filters: [
              {
                name: 'Text Files',
                extensions: [selectedFormat]
              }
            ]
          });
        }
        
        if (filePath) {
          // TauriのファイルシステムAPIを使用してファイルを保存
          await writeTextFile(filePath, content);
          setLastExportPath(filePath);
          
          // クリップボードにコピー
          try {
            await navigator.clipboard.writeText(content);
          } catch (e) {
            console.warn('クリップボードへのコピーに失敗しました', e);
          }
          
          alert('エクスポートが完了しました');
        }
      } catch (pluginError) {
        console.error('Tauri plugin error:', pluginError);
        // プラグインが利用できない場合、ブラウザのダウンロード機能にフォールバック
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
        alert('エクスポートが完了しました（ブラウザダウンロード）');
      }
      
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました: ' + (error as Error).message);
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
      alert('クリップボードにコピーしました');
    } catch (error) {
      console.error('Copy error:', error);
      alert('クリップボードへのコピーに失敗しました');
    }
  };

  const generateTxtContent = () => {
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
    
    if (exportOptions.plot && (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle)) {
      content += 'プロット\n';
      content += '-'.repeat(20) + '\n';
      if (currentProject.plot.theme) content += `テーマ: ${currentProject.plot.theme}\n\n`;
      if (currentProject.plot.setting) content += `舞台: ${currentProject.plot.setting}\n\n`;
      if (currentProject.plot.hook) content += `フック: ${currentProject.plot.hook}\n\n`;
      if (currentProject.plot.protagonistGoal) content += `主人公の目標: ${currentProject.plot.protagonistGoal}\n\n`;
      if (currentProject.plot.mainObstacle) content += `主要な障害: ${currentProject.plot.mainObstacle}\n\n`;
      
      // 構成詳細の追加
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
        if (chapter.summary) content += `${chapter.summary}\n`;
        
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
    
    if (exportOptions.draft && currentProject.draft) {
      content += '草案\n';
      content += '-'.repeat(20) + '\n';
      content += `${currentProject.draft}\n\n`;
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
  };

  const generateMarkdownContent = () => {
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
    
    if (exportOptions.plot && (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle)) {
      content += '## プロット\n\n';
      if (currentProject.plot.theme) content += `**テーマ**: ${currentProject.plot.theme}\n\n`;
      if (currentProject.plot.setting) content += `**舞台**: ${currentProject.plot.setting}\n\n`;
      if (currentProject.plot.hook) content += `**フック**: ${currentProject.plot.hook}\n\n`;
      if (currentProject.plot.protagonistGoal) content += `**主人公の目標**: ${currentProject.plot.protagonistGoal}\n\n`;
      if (currentProject.plot.mainObstacle) content += `**主要な障害**: ${currentProject.plot.mainObstacle}\n\n`;
      
      // 構成詳細の追加
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
        if (chapter.summary) content += `${chapter.summary}\n\n`;
        
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
    
    if (exportOptions.draft && currentProject.draft) {
      content += '## 草案\n\n';
      content += `${currentProject.draft}\n\n`;
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
  };

  const generateHtmlContent = () => {
    if (!currentProject) return '';
    
    let content = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentProject.title}</title>
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
    <h1>${currentProject.title}</h1>`;
    
    if (exportOptions.basicInfo) {
      if (currentProject.description) {
        content += `
    <div class="summary">
        <strong>概要:</strong> ${currentProject.description}
    </div>`;
      }
      
      // ジャンル・読者層・テーマ情報の追加
      if (currentProject.mainGenre || currentProject.subGenre || currentProject.targetReader || currentProject.projectTheme) {
        content += `
    <h2>基本情報</h2>
    <div class="metadata">`;
        if (currentProject.mainGenre) content += `
        <p><strong>メインジャンル:</strong> ${currentProject.mainGenre}</p>`;
        if (currentProject.subGenre) content += `
        <p><strong>サブジャンル:</strong> ${currentProject.subGenre}</p>`;
        if (currentProject.targetReader) content += `
        <p><strong>読者層:</strong> ${currentProject.targetReader}</p>`;
        if (currentProject.projectTheme) content += `
        <p><strong>プロジェクトテーマ:</strong> ${currentProject.projectTheme}</p>`;
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
        <h3>${char.name} (${char.role})</h3>`;
        if (char.appearance) content += `
        <p><strong>外見:</strong> ${char.appearance}</p>`;
        if (char.personality) content += `
        <p><strong>性格:</strong> ${char.personality}</p>`;
        if (char.background) content += `
        <p><strong>背景:</strong> ${char.background}</p>`;
        content += `
    </div>`;
      });
    }
    
    if (exportOptions.plot && (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle)) {
      content += `
    <h2>プロット</h2>`;
      if (currentProject.plot.theme) content += `
    <div class="plot-item">
        <strong>テーマ:</strong> ${currentProject.plot.theme}
    </div>`;
      if (currentProject.plot.setting) content += `
    <div class="plot-item">
        <strong>舞台:</strong> ${currentProject.plot.setting}
    </div>`;
      if (currentProject.plot.hook) content += `
    <div class="plot-item">
        <strong>フック:</strong> ${currentProject.plot.hook}
    </div>`;
      if (currentProject.plot.protagonistGoal) content += `
    <div class="plot-item">
        <strong>主人公の目標:</strong> ${currentProject.plot.protagonistGoal}
    </div>`;
      if (currentProject.plot.mainObstacle) content += `
    <div class="plot-item">
        <strong>主要な障害:</strong> ${currentProject.plot.mainObstacle}
    </div>`;
      
      // 構成詳細の追加
      if (currentProject.plot.structure === 'kishotenketsu') {
        if (currentProject.plot.ki) content += `
    <div class="plot-item">
        <strong>起（導入）:</strong> ${currentProject.plot.ki}
    </div>`;
        if (currentProject.plot.sho) content += `
    <div class="plot-item">
        <strong>承（展開）:</strong> ${currentProject.plot.sho}
    </div>`;
        if (currentProject.plot.ten) content += `
    <div class="plot-item">
        <strong>転（転換）:</strong> ${currentProject.plot.ten}
    </div>`;
        if (currentProject.plot.ketsu) content += `
    <div class="plot-item">
        <strong>結（結末）:</strong> ${currentProject.plot.ketsu}
    </div>`;
      } else if (currentProject.plot.structure === 'three-act') {
        if (currentProject.plot.act1) content += `
    <div class="plot-item">
        <strong>第1幕（導入）:</strong> ${currentProject.plot.act1}
    </div>`;
        if (currentProject.plot.act2) content += `
    <div class="plot-item">
        <strong>第2幕（展開）:</strong> ${currentProject.plot.act2}
    </div>`;
        if (currentProject.plot.act3) content += `
    <div class="plot-item">
        <strong>第3幕（結末）:</strong> ${currentProject.plot.act3}
    </div>`;
      } else if (currentProject.plot.structure === 'four-act') {
        if (currentProject.plot.fourAct1) content += `
    <div class="plot-item">
        <strong>第1幕（秩序）:</strong> ${currentProject.plot.fourAct1}
    </div>`;
        if (currentProject.plot.fourAct2) content += `
    <div class="plot-item">
        <strong>第2幕（混沌）:</strong> ${currentProject.plot.fourAct2}
    </div>`;
        if (currentProject.plot.fourAct3) content += `
    <div class="plot-item">
        <strong>第3幕（秩序）:</strong> ${currentProject.plot.fourAct3}
    </div>`;
        if (currentProject.plot.fourAct4) content += `
    <div class="plot-item">
        <strong>第4幕（混沌）:</strong> ${currentProject.plot.fourAct4}
    </div>`;
      }
    }
    
    if (exportOptions.synopsis && currentProject.synopsis) {
      content += `
    <h2>あらすじ</h2>
    <div class="draft-content">${currentProject.synopsis}</div>`;
    }
    
    if (exportOptions.chapters && currentProject.chapters.length > 0) {
      content += `
    <h2>章立て</h2>`;
      currentProject.chapters.forEach((chapter, index) => {
        content += `
    <div class="chapter-item">
        <h3>第${index + 1}章: ${chapter.title}</h3>`;
        if (chapter.summary) content += `
        <p class="summary">${chapter.summary}</p>`;
        
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
        <h3>${index + 1}. ${image.title} (${image.category})</h3>`;
        if (image.description) content += `
        <p><strong>説明:</strong> ${image.description}</p>`;
        content += `
        <img src="${image.url}" alt="${image.title}" style="max-width: 100%; height: auto; margin-top: 10px; border-radius: 5px;">
    </div>`;
      });
    }
    
    if (exportOptions.draft && currentProject.draft) {
      content += `
    <h2>草案</h2>
    <div class="draft-content">${currentProject.draft}</div>`;
    }
    
    if (exportOptions.glossary && currentProject.glossary && currentProject.glossary.length > 0) {
      content += `
    <h2>用語集</h2>`;
      currentProject.glossary.forEach(term => {
        content += `
    <div class="character-card">
        <h3>${term.term}`;
        if (term.reading) content += ` (${term.reading})`;
        content += ` [${term.category}]</h3>
        <p><strong>定義:</strong> ${term.definition}</p>`;
        if (term.notes) content += `
        <p><strong>備考:</strong> ${term.notes}</p>`;
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
        <h3>${fromName} → ${toName}</h3>
        <p><strong>関係性:</strong> ${rel.type} (強度: ${rel.strength}/10)</p>`;
        if (rel.description) content += `
        <p><strong>説明:</strong> ${rel.description}</p>`;
        if (rel.notes) content += `
        <p><strong>備考:</strong> ${rel.notes}</p>`;
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
        <h3>${event.order}. ${event.title} [${event.category}]</h3>`;
        if (event.date) content += `
        <p><strong>日付:</strong> ${event.date}</p>`;
        content += `
        <p>${event.description}</p>`;
        if (event.characterIds && event.characterIds.length > 0) {
          const charNames = event.characterIds
            .map(id => currentProject.characters.find(c => c.id === id)?.name || id)
            .join(', ');
          content += `
        <p><strong>関連キャラクター:</strong> ${charNames}</p>`;
        }
        if (event.chapterId) {
          const chapter = currentProject.chapters.find(c => c.id === event.chapterId);
          if (chapter) content += `
        <p><strong>関連章:</strong> ${chapter.title}</p>`;
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
        <h3>${setting.title} [${setting.category}]</h3>
        <div class="draft-content">${setting.content}</div>`;
        if (setting.tags && setting.tags.length > 0) {
          content += `
        <p><strong>タグ:</strong> ${setting.tags.join(', ')}</p>`;
        }
        content += `
    </div>`;
      });
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
        <h3>${memoLabels[key] || key}</h3>
        <div class="draft-content">${value}</div>
    </div>`;
              }
            });
          }
        }
      } catch (error) {
        console.error('メモ読み込みエラー:', error);
      }
    }
    
    content += `
    <div class="metadata">
        <p><strong>作成日:</strong> ${currentProject.createdAt.toLocaleDateString('ja-JP')}</p>
        <p><strong>更新日:</strong> ${currentProject.updatedAt.toLocaleDateString('ja-JP')}</p>
    </div>
</body>
</html>`;
    
    return content;
  };

  if (!currentProject) {
    return <div>プロジェクトを選択してください</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Options */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="mb-6">
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
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedFormat === format.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-6 w-6 ${
                      selectedFormat === format.id 
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
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
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

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-semibold disabled:opacity-50 font-['Noto_Sans_JP']"
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

        {/* Project Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 font-['Noto_Sans_JP']">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                  {currentProject.characters.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  キャラクター
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {currentProject.chapters.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  章数
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {currentProject.synopsis.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  あらすじ文字数
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {currentProject.draft.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  草案文字数
                </div>
              </div>
            </div>

            {/* エクスポートする内容の選択 */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
                エクスポートする内容
              </h4>
              <div className="space-y-2">
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
                  { key: 'memo', label: 'クイックメモ' },
                ].map((option) => (
                  <label key={option.key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions[option.key as keyof typeof exportOptions]}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          [option.key]: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 font-['Noto_Sans_JP']">
                <div>作成日: {currentProject.createdAt.toLocaleDateString('ja-JP')}</div>
                <div>更新日: {currentProject.updatedAt.toLocaleDateString('ja-JP')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* エクスポートプレビュー */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            エクスポートプレビュー
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPreviewHeight(Math.max(200, previewHeight - 100))}
              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="高さを減らす"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewHeight(Math.min(800, previewHeight + 100))}
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
            { id: 'memo', label: 'クイックメモ' },
          ]
            .filter((section) => exportOptions[section.id as keyof typeof exportOptions] || section.id === 'title')
            .map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors font-['Noto_Sans_JP'] ${
                  selectedSection === section.id
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
                  const searchRegex = new RegExp(previewSearch, 'gi');
                  const parts = content.split(searchRegex);
                  const matches = content.match(searchRegex);
                  if (matches) {
                    return parts.map((part, i) => (
                      <React.Fragment key={i}>
                        {part}
                        {i < parts.length - 1 && (
                          <mark className="bg-yellow-300 dark:bg-yellow-600">{matches[i]}</mark>
                        )}
                      </React.Fragment>
                    ));
                  }
                }
                return content;
              })()}
            </pre>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          <div>
            総文字数: {(() => {
              if (selectedFormat === 'html') return generateHtmlContent().length;
              if (selectedFormat === 'md') return generateMarkdownContent().length;
              return generateTxtContent().length;
            })().toLocaleString()} 文字
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
  );
};