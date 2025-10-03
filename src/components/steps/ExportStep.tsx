import React, { useState } from 'react';
import { Download, FileText, File, Globe, Check } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';

export const ExportStep: React.FC = () => {
  const { currentProject } = useProject();
  const [selectedFormat, setSelectedFormat] = useState('txt');
  const [isExporting, setIsExporting] = useState(false);

  const exportFormats = [
    { id: 'txt', name: 'テキスト (.txt)', icon: FileText, description: 'シンプルなテキスト形式' },
    { id: 'md', name: 'マークダウン (.md)', icon: File, description: '構造化されたマークダウン形式' },
    { id: 'html', name: 'HTML (.html)', icon: Globe, description: 'Webブラウザで表示可能なHTML形式' },
  ];

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
      
      // Tauriのダイアログを使用してファイル保存場所を選択
      const filePath = await save({
        title: 'ファイルを保存',
        defaultPath: `${currentProject.title}.${selectedFormat}`,
        filters: [
          {
            name: 'Text Files',
            extensions: [selectedFormat]
          }
        ]
      });
      
      if (filePath) {
        // TauriのファイルシステムAPIを使用してファイルを保存
        await writeTextFile(filePath, content);
        alert('エクスポートが完了しました');
      }
      
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const generateTxtContent = () => {
    if (!currentProject) return '';
    
    let content = `${currentProject.title}\n`;
    content += '='.repeat(currentProject.title.length) + '\n\n';
    
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
    
    if (currentProject.characters.length > 0) {
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
    
    if (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle) {
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
    
    if (currentProject.synopsis) {
      content += 'あらすじ\n';
      content += '-'.repeat(20) + '\n';
      content += `${currentProject.synopsis}\n\n`;
    }
    
    if (currentProject.chapters.length > 0) {
      content += '章立て\n';
      content += '-'.repeat(20) + '\n';
      currentProject.chapters.forEach((chapter, index) => {
        content += `第${index + 1}章: ${chapter.title}\n`;
        if (chapter.summary) content += `${chapter.summary}\n`;
        
        content += '\n';
      });
    }
    
    if (currentProject.imageBoard.length > 0) {
      content += 'イメージボード\n';
      content += '-'.repeat(20) + '\n';
      currentProject.imageBoard.forEach((image, index) => {
        content += `${index + 1}. ${image.title} (${image.category})\n`;
        if (image.description) content += `   ${image.description}\n`;
        content += `   URL: ${image.url}\n\n`;
      });
    }
    
    if (currentProject.draft) {
      content += '草案\n';
      content += '-'.repeat(20) + '\n';
      content += `${currentProject.draft}\n`;
    }
    
    return content;
  };

  const generateMarkdownContent = () => {
    if (!currentProject) return '';
    
    let content = `# ${currentProject.title}\n\n`;
    
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
    
    if (currentProject.characters.length > 0) {
      content += '## キャラクター一覧\n\n';
      currentProject.characters.forEach(char => {
        content += `### ${char.name} (${char.role})\n\n`;
        if (char.appearance) content += `**外見**: ${char.appearance}\n\n`;
        if (char.personality) content += `**性格**: ${char.personality}\n\n`;
        if (char.background) content += `**背景**: ${char.background}\n\n`;
      });
    }
    
    if (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle) {
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
    
    if (currentProject.synopsis) {
      content += '## あらすじ\n\n';
      content += `${currentProject.synopsis}\n\n`;
    }
    
    if (currentProject.chapters.length > 0) {
      content += '## 章立て\n\n';
      currentProject.chapters.forEach((chapter, index) => {
        content += `### 第${index + 1}章: ${chapter.title}\n\n`;
        if (chapter.summary) content += `${chapter.summary}\n\n`;
        
      });
    }
    
    if (currentProject.imageBoard.length > 0) {
      content += '## イメージボード\n\n';
      currentProject.imageBoard.forEach((image, index) => {
        content += `### ${index + 1}. ${image.title} (${image.category})\n\n`;
        if (image.description) content += `${image.description}\n\n`;
        content += `![${image.title}](${image.url})\n\n`;
      });
    }
    
    if (currentProject.draft) {
      content += '## 草案\n\n';
      content += `${currentProject.draft}\n`;
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
    
    if (currentProject.characters.length > 0) {
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
    
    if (currentProject.plot.theme || currentProject.plot.setting || currentProject.plot.protagonistGoal || currentProject.plot.mainObstacle) {
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
    
    if (currentProject.synopsis) {
      content += `
    <h2>あらすじ</h2>
    <div class="draft-content">${currentProject.synopsis}</div>`;
    }
    
    if (currentProject.chapters.length > 0) {
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
    
    if (currentProject.imageBoard.length > 0) {
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
    
    if (currentProject.draft) {
      content += `
    <h2>草案</h2>
    <div class="draft-content">${currentProject.draft}</div>`;
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

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-semibold disabled:opacity-50 font-['Noto_Sans_JP']"
            >
              <Download className="h-5 w-5" />
              <span>{isExporting ? 'エクスポート中...' : 'エクスポート開始'}</span>
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

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 font-['Noto_Sans_JP']">
                <div>作成日: {currentProject.createdAt.toLocaleDateString('ja-JP')}</div>
                <div>更新日: {currentProject.updatedAt.toLocaleDateString('ja-JP')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Preview */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
          エクスポートプレビュー
        </h3>
        
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg max-h-96 overflow-y-auto">
          {selectedFormat === 'html' ? (
            <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
              <p className="mb-2">HTML形式では、美しくスタイリングされた文書が生成されます。</p>
              <p className="mb-2">以下の内容が含まれます：</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>プロジェクトタイトルと概要</li>
                <li>キャラクター一覧（外見・性格・背景情報付き）</li>
                <li>プロット情報（テーマ・舞台・フック・構成詳細）</li>
                <li>あらすじ</li>
                <li>章立て</li>
                <li>草案内容</li>
                <li>作成日・更新日のメタデータ</li>
              </ul>
              <p className="mt-4 text-xs text-gray-500">
                ※ HTMLファイルはWebブラウザで開くと、読みやすい形式で表示されます。
              </p>
            </div>
          ) : (
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP']">
              {selectedFormat === 'md' ? generateMarkdownContent().substring(0, 1000) : generateTxtContent().substring(0, 1000)}
              {(selectedFormat === 'md' ? generateMarkdownContent() : generateTxtContent()).length > 1000 && '...'}
            </pre>
          )}
        </div>
        
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
          総文字数: {(() => {
            if (selectedFormat === 'html') return generateHtmlContent().length;
            if (selectedFormat === 'md') return generateMarkdownContent().length;
            return generateTxtContent().length;
          })().toLocaleString()} 文字
        </div>
      </div>
    </div>
  );
};