import { Project, Character, GlossaryTerm, TimelineEvent, WorldSetting, Foreshadowing } from '../contexts/ProjectContext';

export interface SearchResult {
  type: 'project' | 'character' | 'plot' | 'synopsis' | 'chapter' | 'glossary' | 'timeline' | 'world' | 'foreshadowing';
  id: string;
  title: string;
  content: string;
  matchText: string;
  step?: string; // ジャンプ先のステップ
  chapterId?: string; // 章のID（章関連の場合）
}

/**
 * プロジェクト全体を検索する
 */
export function searchProject(project: Project | null, query: string): SearchResult[] {
  if (!project || !query.trim()) {
    return [];
  }

  const searchQuery = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  // プロジェクト基本情報
  if (project.title.toLowerCase().includes(searchQuery)) {
    results.push({
      type: 'project',
      id: project.id,
      title: 'プロジェクト',
      content: project.title,
      matchText: project.title,
    });
  }
  if (project.description?.toLowerCase().includes(searchQuery)) {
    results.push({
      type: 'project',
      id: project.id,
      title: 'プロジェクト説明',
      content: project.description,
      matchText: project.description,
    });
  }
  if (project.theme?.toLowerCase().includes(searchQuery)) {
    results.push({
      type: 'project',
      id: project.id,
      title: 'テーマ',
      content: project.theme,
      matchText: project.theme,
    });
  }

  // キャラクター
  project.characters?.forEach((char: Character) => {
    const fields = [
      { key: 'name', value: char.name },
      { key: 'role', value: char.role },
      { key: 'appearance', value: char.appearance },
      { key: 'personality', value: char.personality },
      { key: 'background', value: char.background },
    ];

    fields.forEach(field => {
      if (field.value?.toLowerCase().includes(searchQuery)) {
        results.push({
          type: 'character',
          id: char.id,
          title: `${char.name} - ${field.key === 'name' ? '名前' : field.key === 'role' ? '役割' : field.key === 'appearance' ? '外見' : field.key === 'personality' ? '性格' : '背景'}`,
          content: field.value,
          matchText: field.value,
          step: 'character',
        });
      }
    });
  });

  // プロット
  if (project.plot) {
    const plotFields = [
      { key: 'theme', value: project.plot.theme, label: 'テーマ' },
      { key: 'setting', value: project.plot.setting, label: '舞台設定' },
      { key: 'hook', value: project.plot.hook, label: 'フック' },
      { key: 'protagonistGoal', value: project.plot.protagonistGoal, label: '主人公の目標' },
      { key: 'mainObstacle', value: project.plot.mainObstacle, label: '主要な障害' },
      { key: 'ending', value: project.plot.ending, label: '結末' },
    ];

    plotFields.forEach(field => {
      if (field.value?.toLowerCase().includes(searchQuery)) {
        results.push({
          type: 'plot',
          id: 'plot',
          title: `プロット - ${field.label}`,
          content: field.value,
          matchText: field.value,
          step: 'plot1',
        });
      }
    });

    // プロット構造（起承転結、三幕構成など）
    const structureFields = [
      { key: 'ki', value: project.plot.ki, label: '起' },
      { key: 'sho', value: project.plot.sho, label: '承' },
      { key: 'ten', value: project.plot.ten, label: '転' },
      { key: 'ketsu', value: project.plot.ketsu, label: '結' },
      { key: 'act1', value: project.plot.act1, label: '第1幕' },
      { key: 'act2', value: project.plot.act2, label: '第2幕' },
      { key: 'act3', value: project.plot.act3, label: '第3幕' },
    ];

    structureFields.forEach(field => {
      if (field.value?.toLowerCase().includes(searchQuery)) {
        results.push({
          type: 'plot',
          id: 'plot',
          title: `プロット構成 - ${field.label}`,
          content: field.value,
          matchText: field.value,
          step: 'plot2',
        });
      }
    });
  }

  // あらすじ
  if (project.synopsis?.toLowerCase().includes(searchQuery)) {
    const matchIndex = project.synopsis.toLowerCase().indexOf(searchQuery);
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(project.synopsis.length, matchIndex + searchQuery.length + 50);
    const matchText = project.synopsis.substring(start, end);
    
    results.push({
      type: 'synopsis',
      id: 'synopsis',
      title: 'あらすじ',
      content: project.synopsis,
      matchText: matchText,
      step: 'synopsis',
    });
  }

  // 章
  project.chapters?.forEach((chapter) => {
    if (chapter.title?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'chapter',
        id: chapter.id,
        title: `章: ${chapter.title}`,
        content: chapter.title,
        matchText: chapter.title,
        step: 'chapter',
        chapterId: chapter.id,
      });
    }
    if (chapter.summary?.toLowerCase().includes(searchQuery)) {
      const matchIndex = chapter.summary.toLowerCase().indexOf(searchQuery);
      const start = Math.max(0, matchIndex - 50);
      const end = Math.min(chapter.summary.length, matchIndex + searchQuery.length + 50);
      const matchText = chapter.summary.substring(start, end);
      
      results.push({
        type: 'chapter',
        id: chapter.id,
        title: `章: ${chapter.title || '無題'} - 要約`,
        content: chapter.summary,
        matchText: matchText,
        step: 'chapter',
        chapterId: chapter.id,
      });
    }
    if (chapter.draft?.toLowerCase().includes(searchQuery)) {
      const matchIndex = chapter.draft.toLowerCase().indexOf(searchQuery);
      const start = Math.max(0, matchIndex - 50);
      const end = Math.min(chapter.draft.length, matchIndex + searchQuery.length + 50);
      const matchText = chapter.draft.substring(start, end);
      
      results.push({
        type: 'chapter',
        id: chapter.id,
        title: `章: ${chapter.title || '無題'} - 草案`,
        content: chapter.draft,
        matchText: matchText,
        step: 'draft',
        chapterId: chapter.id,
      });
    }
  });

  // 用語集
  project.glossary?.forEach((term: GlossaryTerm) => {
    if (term.term?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'glossary',
        id: term.id,
        title: `用語: ${term.term}`,
        content: term.definition || '',
        matchText: term.term,
      });
    }
    if (term.definition?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'glossary',
        id: term.id,
        title: `用語: ${term.term} - 定義`,
        content: term.definition,
        matchText: term.definition,
      });
    }
  });

  // タイムラインイベント
  project.timeline?.forEach((event: TimelineEvent) => {
    if (event.title?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'timeline',
        id: event.id,
        title: `タイムライン: ${event.title}`,
        content: event.description || '',
        matchText: event.title,
      });
    }
    if (event.description?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'timeline',
        id: event.id,
        title: `タイムライン: ${event.title || '無題'} - 説明`,
        content: event.description,
        matchText: event.description,
      });
    }
  });

  // 世界設定
  project.worldSettings?.forEach((setting: WorldSetting) => {
    if (setting.title?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'world',
        id: setting.id,
        title: `世界設定: ${setting.title}`,
        content: setting.content || '',
        matchText: setting.title,
      });
    }
    if (setting.content?.toLowerCase().includes(searchQuery)) {
      const matchIndex = setting.content.toLowerCase().indexOf(searchQuery);
      const start = Math.max(0, matchIndex - 50);
      const end = Math.min(setting.content.length, matchIndex + searchQuery.length + 50);
      const matchText = setting.content.substring(start, end);
      
      results.push({
        type: 'world',
        id: setting.id,
        title: `世界設定: ${setting.title || '無題'} - 内容`,
        content: setting.content,
        matchText: matchText,
      });
    }
  });

  // 伏線
  project.foreshadowings?.forEach((foreshadowing: Foreshadowing) => {
    if (foreshadowing.title?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'foreshadowing',
        id: foreshadowing.id,
        title: `伏線: ${foreshadowing.title}`,
        content: foreshadowing.description || '',
        matchText: foreshadowing.title,
      });
    }
    if (foreshadowing.description?.toLowerCase().includes(searchQuery)) {
      results.push({
        type: 'foreshadowing',
        id: foreshadowing.id,
        title: `伏線: ${foreshadowing.title || '無題'} - 説明`,
        content: foreshadowing.description,
        matchText: foreshadowing.description,
      });
    }
  });

  return results;
}

/**
 * 検索結果のタイプに応じたラベルを取得
 */
export function getSearchResultTypeLabel(type: SearchResult['type']): string {
  const labels: Record<SearchResult['type'], string> = {
    project: 'プロジェクト',
    character: 'キャラクター',
    plot: 'プロット',
    synopsis: 'あらすじ',
    chapter: '章',
    glossary: '用語集',
    timeline: 'タイムライン',
    world: '世界設定',
    foreshadowing: '伏線',
  };
  return labels[type] || type;
}








































