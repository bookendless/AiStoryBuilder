import React, { useState, useMemo } from 'react';
import { Network, Plus, Edit2, Trash2, Save, Users, Heart, UsersRound, Sword, GraduationCap, Zap, LayoutList, GitBranch, Sparkles, Loader2, Wand2, CheckCircle, AlertCircle, Lightbulb } from 'lucide-react';
import { useProject, CharacterRelationship } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { aiService } from '../../services/aiService';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';
import { Modal } from '../common/Modal';
import { useToast } from '../Toast';
import { EmptyState } from '../common/EmptyState';

interface RelationshipDiagramProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FlowChartNode {
  id: string;
  x: number;
  y: number;
  name: string;
  image?: string;
}

interface FlowChartEdge {
  from: string;
  to: string;
  type: CharacterRelationship['type'];
  label: string;
  strength: number;
  color: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  offset?: number;
}

const relationshipTypes: Record<CharacterRelationship['type'], { label: string; icon: typeof Users; color: string; svgColor: string }> = {
  friend: { label: '友人', icon: Users, color: 'bg-green-500', svgColor: '#10b981' },
  enemy: { label: '敵対', icon: Sword, color: 'bg-red-500', svgColor: '#ef4444' },
  family: { label: '家族', icon: UsersRound, color: 'bg-blue-500', svgColor: '#3b82f6' },
  romantic: { label: '恋愛', icon: Heart, color: 'bg-pink-500', svgColor: '#ec4899' },
  mentor: { label: '師弟', icon: GraduationCap, color: 'bg-purple-500', svgColor: '#a855f7' },
  rival: { label: 'ライバル', icon: Zap, color: 'bg-orange-500', svgColor: '#f97316' },
  other: { label: 'その他', icon: Network, color: 'bg-gray-500', svgColor: '#6b7280' },
};

export const RelationshipDiagram: React.FC<RelationshipDiagramProps> = ({ isOpen, onClose }) => {
  const { currentProject, updateProject } = useProject();
  const { showError, showWarning, showSuccess, showInfo } = useToast();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'flow'>('list');
  const [editingRelationship, setEditingRelationship] = useState<CharacterRelationship | null>(null);
  const [formData, setFormData] = useState<Partial<CharacterRelationship>>({
    from: '',
    to: '',
    type: 'friend',
    strength: 3,
    description: '',
    notes: '',
  });
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMode, setAiMode] = useState<'infer' | 'suggest' | 'check' | 'generate'>('infer');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<Partial<CharacterRelationship>[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [consistencyCheckResult, setConsistencyCheckResult] = useState<string>('');
  const { settings, isConfigured } = useAI();

  const relationships = currentProject?.relationships || [];
  const characters = currentProject?.characters || [];

  const getCharacterName = (id: string) => {
    return characters.find(c => c.id === id)?.name || '不明';
  };

  // フローチャート用のレイアウト計算
  const flowChartLayout = useMemo<{ nodes: FlowChartNode[]; edges: FlowChartEdge[]; svgWidth: number; svgHeight: number } | null>(() => {
    if (relationships.length === 0 || characters.length === 0) return null;

    // ノードの位置計算（円形配置 + 関係性に基づく最適化）
    const nodes: FlowChartNode[] = [];
    const charCount = characters.length;

    // 中心点と半径（大きなキャンバスサイズに合わせて調整）
    const centerX = 600;
    const centerY = 400;
    // 関係性が多い場合はより大きな半径を使用
    const baseRadius = Math.max(400, charCount * 35);

    // 関係性の数でソート（多い順）
    const relationshipCount = new Map<string, number>();
    characters.forEach(char => {
      const count = relationships.filter(r => r.from === char.id || r.to === char.id).length;
      relationshipCount.set(char.id, count);
    });

    const sortedCharacters = [...characters].sort((a, b) => {
      const countA = relationshipCount.get(a.id) || 0;
      const countB = relationshipCount.get(b.id) || 0;
      return countB - countA;
    });

    sortedCharacters.forEach((char, index) => {
      // 円形に均等配置（すべて外側に配置して間隔を広げる）
      const angle = (index * 2 * Math.PI) / charCount;
      const x = centerX + baseRadius * Math.cos(angle);
      const y = centerY + baseRadius * Math.sin(angle);

      nodes.push({
        id: char.id,
        name: char.name,
        x: Math.max(100, x),
        y: Math.max(100, y),
        image: char.image,
      });
    });

    // エッジ（矢印）の計算
    // 双方向の関係を検出してオフセットを設定
    const bidirectionalPairs = new Map<string, number[]>();
    relationships.forEach((rel, idx) => {
      // ペアキーを作成（常に小さいIDから大きいIDへの順序で）
      const sortedIds = [rel.from, rel.to].sort();
      const pairKey = `${sortedIds[0]}-${sortedIds[1]}`;

      if (!bidirectionalPairs.has(pairKey)) {
        bidirectionalPairs.set(pairKey, []);
      }
      bidirectionalPairs.get(pairKey)!.push(idx);
    });

    const edges: FlowChartEdge[] = relationships.map((rel, idx) => {
      const fromNode = nodes.find(n => n.id === rel.from);
      const toNode = nodes.find(n => n.id === rel.to);

      if (!fromNode || !toNode) return null;

      // ペアキーを作成
      const sortedIds = [rel.from, rel.to].sort();
      const pairKey = `${sortedIds[0]}-${sortedIds[1]}`;
      const pairIndices = bidirectionalPairs.get(pairKey) || [];

      // 複数の関係がある場合はオフセットを設定
      let offset = 0;
      if (pairIndices.length >= 2) {
        const indexInPair = pairIndices.indexOf(idx);
        const isReversed = rel.from > rel.to;
        const totalRelations = pairIndices.length;
        const offsetStep = 25;
        // 中央から離れた位置に配置
        const indexOffset = indexInPair - (totalRelations - 1) / 2;
        offset = isReversed ? indexOffset * offsetStep : -indexOffset * offsetStep;
      }

      const relationshipType = relationshipTypes[rel.type];

      return {
        from: rel.from,
        to: rel.to,
        type: rel.type,
        label: relationshipType.label,
        strength: rel.strength,
        color: relationshipType.svgColor,
        fromX: fromNode.x,
        fromY: fromNode.y,
        toX: toNode.x,
        toY: toNode.y,
        offset: offset,
      } as FlowChartEdge;
    }).filter((edge): edge is FlowChartEdge => edge !== null);

    // SVGのサイズをノードの最大座標に基づいて計算
    const maxX = Math.max(...nodes.map(n => n.x), 0) + 200;
    const maxY = Math.max(...nodes.map(n => n.y), 0) + 150;
    const svgWidth = Math.max(1200, maxX);
    const svgHeight = Math.max(800, maxY);

    return { nodes, edges, svgWidth, svgHeight };
  }, [relationships, characters]);

  if (!isOpen || !currentProject) return null;

  const handleAddRelationship = () => {
    if (!formData.from || !formData.to) {
      showWarning('両方のキャラクターを選択してください', 5000, {
        title: '選択エラー',
      });
      return;
    }

    if (formData.from === formData.to) {
      showWarning('自分自身との関係は設定できません', 5000, {
        title: '設定エラー',
      });
      return;
    }

    // 既存の関係をチェック（同じ方向の関係のみ重複チェック）
    const exists = relationships.find(
      r => r.from === formData.from && r.to === formData.to
    );

    if (exists && !editingRelationship) {
      showWarning('この方向の関係は既に登録されています', 5000, {
        title: '重複エラー',
      });
      return;
    }

    const newRelationship: CharacterRelationship = {
      id: editingRelationship?.id || Date.now().toString(),
      from: formData.from!,
      to: formData.to!,
      type: formData.type || 'friend',
      strength: formData.strength || 3,
      description: formData.description || undefined,
      notes: formData.notes || undefined,
    };

    if (editingRelationship) {
      const updatedRelationships = relationships.map(r =>
        r.id === editingRelationship.id ? newRelationship : r
      );
      updateProject({ relationships: updatedRelationships });
    } else {
      updateProject({ relationships: [...relationships, newRelationship] });
    }

    handleCloseForm();
  };

  const handleEditRelationship = (relationship: CharacterRelationship) => {
    setEditingRelationship(relationship);
    setFormData(relationship);
    setShowAddForm(true);
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    if (!confirm('この関係を削除しますか？')) return;

    updateProject({
      relationships: relationships.filter(r => r.id !== relationshipId),
    });
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingRelationship(null);
    setFormData({
      from: '',
      to: '',
      type: 'friend',
      strength: 3,
      description: '',
      notes: '',
    });
  };



  // プロジェクトコンテキストを取得
  const getProjectContext = (): string => {
    if (!currentProject) return '';

    let context = `プロジェクトタイトル: ${currentProject.title}\n`;
    context += `テーマ: ${currentProject.theme || currentProject.projectTheme || '未設定'}\n`;
    context += `メインジャンル: ${currentProject.mainGenre || currentProject.genre || '未設定'}\n\n`;

    if (currentProject.synopsis) {
      context += `あらすじ:\n${currentProject.synopsis}\n\n`;
    }

    if (currentProject.plot) {
      context += `プロット設定:\n`;
      context += `- テーマ: ${currentProject.plot.theme || '未設定'}\n`;
      context += `- 舞台: ${currentProject.plot.setting || '未設定'}\n`;
      context += `- 主人公の目標: ${currentProject.plot.protagonistGoal || '未設定'}\n`;
      context += `- 主要な障害: ${currentProject.plot.mainObstacle || '未設定'}\n\n`;
    }

    if (currentProject.characters && currentProject.characters.length > 0) {
      context += `キャラクター:\n`;
      currentProject.characters.forEach(char => {
        context += `- ${char.name} (${char.role}): ${char.personality || ''}\n`;
        context += `  外見: ${char.appearance || ''}\n`;
        context += `  背景: ${char.background || ''}\n`;
      });
      context += '\n';
    }

    // 既存の関係性
    if (relationships.length > 0) {
      context += `既存の関係性:\n`;
      relationships.forEach(rel => {
        const fromChar = characters.find(c => c.id === rel.from);
        const toChar = characters.find(c => c.id === rel.to);
        context += `- ${fromChar?.name || '不明'} → ${toChar?.name || '不明'}: ${relationshipTypes[rel.type].label} (強度: ${rel.strength}/5)\n`;
      });
      context += '\n';
    }

    return context;
  };

  // 関係性自動推論
  const handleInferRelationships = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。設定画面でAPIキーを設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (characters.length < 2) {
      showWarning('キャラクターが2人以上必要です。', 5000, {
        title: 'キャラクター不足',
      });
      return;
    }

    setIsAIGenerating(true);
    setAiResults([]);
    setSelectedResults(new Set());

    try {
      const projectContext = getProjectContext();
      
      // 登録済みキャラクター名のリストを作成
      const characterNames = characters.map(c => c.name).join('、');

      const prompt = `以下のプロジェクト情報から、キャラクター間の関係性を自動推論してください。

${projectContext}

【重要】登録済みキャラクターのみを使用してください
登録済みのキャラクター名リスト: ${characterNames}

上記のリストに含まれているキャラクター名のみを使用して関係性を推論してください。
リストに含まれていないキャラクター名を使用した関係性は無効となります。

【指示】
1. キャラクターの設定（役割、性格、背景など）から、自然な関係性を推論してください
2. 既存の関係性は除外してください
3. 必ず登録済みキャラクター名リストに含まれているキャラクター名のみを使用してください
4. 各関係性について、以下の情報を提供してください：
   - 起点キャラクター名（登録済みキャラクター名リストから選択）
   - 相手キャラクター名（登録済みキャラクター名リストから選択）
   - 関係の種類（friend: 友人, enemy: 敵対, family: 家族, romantic: 恋愛, mentor: 師弟, rival: ライバル, other: その他）
   - 関係の強度（1-5の数値）
   - 説明（100文字以上200文字程度）
   - 備考（任意）

【出力形式】
JSON配列形式で出力してください：
[
  {
    "fromName": "起点キャラクター名",
    "toName": "相手キャラクター名",
    "type": "friend|enemy|family|romantic|mentor|rival|other",
    "strength": 1-5,
    "description": "関係性の説明",
    "notes": "備考（任意）"
  },
  ...
]`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        context: projectContext,
      });

      if (response.error) {
        showError(`エラーが発生しました: ${response.error}`, 7000, {
          title: 'AI生成エラー',
        });
        setIsAIGenerating(false);
        return;
      }

      if (response.content) {
        try {
          let jsonText = response.content.trim();
          const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }

          const inferredRelationships = JSON.parse(jsonText) as Array<{
            fromName: string;
            toName: string;
            type: CharacterRelationship['type'];
            strength: number;
            description?: string;
            notes?: string;
          }>;

          // キャラクターIDを解決し、既存の関係と重複しないようにフィルタ
          const existingPairs = new Set(
            relationships.map(r => {
              const sorted = [r.from, r.to].sort();
              return `${sorted[0]}-${sorted[1]}`;
            })
          );

          const filteredRelationships = inferredRelationships
            .map(rel => {
              const fromChar = characters.find(c => c.name === rel.fromName);
              const toChar = characters.find(c => c.name === rel.toName);

              if (!fromChar || !toChar || fromChar.id === toChar.id) {
                return null;
              }

              // 重複チェック
              const sorted = [fromChar.id, toChar.id].sort();
              const pairKey = `${sorted[0]}-${sorted[1]}`;
              if (existingPairs.has(pairKey)) {
                return null;
              }

              return {
                from: fromChar.id,
                to: toChar.id,
                type: rel.type || 'friend',
                strength: Math.max(1, Math.min(5, rel.strength || 3)),
                description: rel.description,
                notes: rel.notes,
              } as Partial<CharacterRelationship>;
            })
            .filter((rel): rel is Partial<CharacterRelationship> => rel !== null);

          setAiResults(filteredRelationships);
          setSelectedResults(new Set(filteredRelationships.map((_, idx) => idx)));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          showError('AIの応答を解析できませんでした。応答形式が正しくない可能性があります。', 7000, {
            title: '解析エラー',
          });
        }
      }
    } catch (error) {
      console.error('関係性推論エラー:', error);
      showError(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`, 7000, {
        title: 'エラー',
      });
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 関係性提案
  const handleSuggestRelationships = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。設定画面でAPIキーを設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (characters.length < 2) {
      showWarning('キャラクターが2人以上必要です。', 5000, {
        title: 'キャラクター不足',
      });
      return;
    }

    setIsAIGenerating(true);
    setAiResults([]);
    setSelectedResults(new Set());

    try {
      const projectContext = getProjectContext();
      
      // 登録済みキャラクター名のリストを作成
      const characterNames = characters.map(c => c.name).join('、');

      const prompt = `以下のプロジェクト情報を参考に、物語に追加すべき重要な関係性を提案してください。

${projectContext}

【重要】登録済みキャラクターのみを使用してください
登録済みのキャラクター名リスト: ${characterNames}

上記のリストに含まれているキャラクター名のみを使用して関係性を提案してください。
リストに含まれていないキャラクター名を使用した関係性は無効となります。

【指示】
1. プロットの流れやキャラクターの設定を考慮して、物語に必要な関係性を提案してください
2. キャラクターの成長や関係性の発展に関わる関係性も含めてください
3. 既存の関係性は除外してください
4. 必ず登録済みキャラクター名リストに含まれているキャラクター名のみを使用してください
5. 各関係性について、以下の情報を提供してください：
   - 起点キャラクター名（登録済みキャラクター名リストから選択）
   - 相手キャラクター名（登録済みキャラクター名リストから選択）
   - 関係の種類（friend, enemy, family, romantic, mentor, rival, other）
   - 関係の強度（1-5の数値）
   - 説明（100文字以上200文字程度）
   - 備考（任意）

【出力形式】
JSON配列形式で出力してください：
[
  {
    "fromName": "起点キャラクター名",
    "toName": "相手キャラクター名",
    "type": "friend|enemy|family|romantic|mentor|rival|other",
    "strength": 1-5,
    "description": "関係性の説明",
    "notes": "備考（任意）"
  },
  ...
]`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        context: projectContext,
      });

      if (response.error) {
        showError(`エラーが発生しました: ${response.error}`, 7000, {
          title: 'AI生成エラー',
        });
        setIsAIGenerating(false);
        return;
      }

      if (response.content) {
        try {
          let jsonText = response.content.trim();
          const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }

          const suggestedRelationships = JSON.parse(jsonText) as Array<{
            fromName: string;
            toName: string;
            type: CharacterRelationship['type'];
            strength: number;
            description?: string;
            notes?: string;
          }>;

          // キャラクターIDを解決
          const existingPairs = new Set(
            relationships.map(r => {
              const sorted = [r.from, r.to].sort();
              return `${sorted[0]}-${sorted[1]}`;
            })
          );

          const filteredRelationships = suggestedRelationships
            .map(rel => {
              const fromChar = characters.find(c => c.name === rel.fromName);
              const toChar = characters.find(c => c.name === rel.toName);

              if (!fromChar || !toChar || fromChar.id === toChar.id) {
                return null;
              }

              // 重複チェック
              const sorted = [fromChar.id, toChar.id].sort();
              const pairKey = `${sorted[0]}-${sorted[1]}`;
              if (existingPairs.has(pairKey)) {
                return null;
              }

              return {
                from: fromChar.id,
                to: toChar.id,
                type: rel.type || 'friend',
                strength: Math.max(1, Math.min(5, rel.strength || 3)),
                description: rel.description,
                notes: rel.notes,
              } as Partial<CharacterRelationship>;
            })
            .filter((rel): rel is Partial<CharacterRelationship> => rel !== null);

          setAiResults(filteredRelationships);
          setSelectedResults(new Set(filteredRelationships.map((_, idx) => idx)));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          showError('AIの応答を解析できませんでした。応答形式が正しくない可能性があります。', 7000, {
            title: '解析エラー',
          });
        }
      }
    } catch (error) {
      console.error('関係性提案エラー:', error);
      showError(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`, 7000, {
        title: 'エラー',
      });
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 整合性チェック
  const handleCheckConsistency = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。設定画面でAPIキーを設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (relationships.length === 0) {
      showWarning('関係性が登録されていません。', 5000, {
        title: 'データ不足',
      });
      return;
    }

    setIsAIGenerating(true);
    setConsistencyCheckResult('');

    try {
      const projectContext = getProjectContext();

      const relationshipsText = relationships.map(rel => {
        const fromChar = characters.find(c => c.id === rel.from);
        const toChar = characters.find(c => c.id === rel.to);
        return `- ${fromChar?.name || '不明'} → ${toChar?.name || '不明'}: ${relationshipTypes[rel.type].label} (強度: ${rel.strength}/5)${rel.description ? `\n  説明: ${rel.description}` : ''}`;
      }).join('\n');

      const prompt = `以下の関係性について、整合性をチェックしてください。

${projectContext}

【現在の関係性】
${relationshipsText}

【チェック項目】
1. 矛盾する関係性がないか（例：敵対関係と恋愛関係の矛盾）
2. 関係性の強度と説明の整合性
3. 孤立したキャラクターがないか
4. 双方向の関係性が適切か
5. プロット設定との整合性

【出力形式】
問題があれば具体的に指摘し、改善提案をしてください。JSON形式で出力してください：
{
  "hasIssues": true/false,
  "issues": ["問題点1", "問題点2", ...],
  "suggestions": ["改善提案1", "改善提案2", ...],
  "isolatedCharacters": ["孤立しているキャラクター名1", ...]
}`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        context: projectContext,
      });

      if (response.error) {
        showError(`エラーが発生しました: ${response.error}`, 7000, {
          title: 'AI生成エラー',
        });
        setIsAIGenerating(false);
        return;
      }

      if (response.content) {
        try {
          let jsonText = response.content.trim();
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }

          const result = JSON.parse(jsonText) as {
            hasIssues: boolean;
            issues?: string[];
            suggestions?: string[];
            isolatedCharacters?: string[];
          };

          let resultText = '';
          if (!result.hasIssues) {
            resultText = '✅ 関係性に問題は見つかりませんでした。整合性が保たれています。';
          } else {
            resultText = '⚠️ 以下の問題が見つかりました：\n\n';
            if (result.issues && result.issues.length > 0) {
              resultText += '【問題点】\n';
              result.issues.forEach((issue, idx) => {
                resultText += `${idx + 1}. ${issue}\n`;
              });
              resultText += '\n';
            }
            if (result.isolatedCharacters && result.isolatedCharacters.length > 0) {
              resultText += '【孤立しているキャラクター】\n';
              result.isolatedCharacters.forEach((char, idx) => {
                resultText += `${idx + 1}. ${char}\n`;
              });
              resultText += '\n';
            }
            if (result.suggestions && result.suggestions.length > 0) {
              resultText += '【改善提案】\n';
              result.suggestions.forEach((suggestion, idx) => {
                resultText += `${idx + 1}. ${suggestion}\n`;
              });
            }
          }

          setConsistencyCheckResult(resultText);
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          setConsistencyCheckResult(response.content);
        }
      }
    } catch (error) {
      console.error('整合性チェックエラー:', error);
      showError(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`, 7000, {
        title: 'エラー',
      });
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 関係性説明自動生成
  const handleGenerateDescription = async () => {
    if (!isConfigured) {
      showError('AI設定が必要です。設定画面でAPIキーを設定してください。', 7000, {
        title: 'AI設定が必要',
      });
      return;
    }

    if (!formData.from || !formData.to) {
      showWarning('両方のキャラクターを選択してください。', 5000, {
        title: '選択エラー',
      });
      return;
    }

    setIsAIGenerating(true);

    try {
      const projectContext = getProjectContext();
      const fromChar = characters.find(c => c.id === formData.from);
      const toChar = characters.find(c => c.id === formData.to);

      const prompt = `以下の関係性について、プロジェクトの世界観に合わせた説明文を生成してください。

${projectContext}

起点キャラクター: ${fromChar?.name || ''} (${fromChar?.role || ''})
相手キャラクター: ${toChar?.name || ''} (${toChar?.role || ''})
関係の種類: ${relationshipTypes[formData.type || 'friend'].label}
関係の強度: ${formData.strength || 3}/5

【指示】
1. プロジェクトの世界観や設定に合わせた説明文を生成してください
2. 説明文は100文字以上200文字程度で、具体的で分かりやすい内容にしてください
3. 必要に応じて関係の種類や強度も提案してください（未設定の場合）
4. 備考も提案してください（任意）

【出力形式】
JSON形式で出力してください：
{
  "description": "説明文",
  "type": "friend|enemy|family|romantic|mentor|rival|other",
  "strength": 1-5,
  "notes": "備考（任意）"
}`;

      const response = await aiService.generateContent({
        prompt,
        type: 'draft',
        settings,
        context: projectContext,
      });

      if (response.error) {
        showError(`エラーが発生しました: ${response.error}`, 7000, {
          title: 'AI生成エラー',
        });
        setIsAIGenerating(false);
        return;
      }

      if (response.content) {
        try {
          let jsonText = response.content.trim();
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }

          const generated = JSON.parse(jsonText) as {
            description: string;
            type?: CharacterRelationship['type'];
            strength?: number;
            notes?: string;
          };

          setFormData(prev => ({
            ...prev,
            description: generated.description || prev.description,
            type: generated.type || prev.type,
            strength: generated.strength || prev.strength,
            notes: generated.notes || prev.notes,
          }));
        } catch (parseError) {
          console.error('JSON解析エラー:', parseError);
          const descriptionMatch = response.content.match(/説明[文]?[：:]\s*(.+)/);
          if (descriptionMatch) {
            setFormData(prev => ({
              ...prev,
              description: descriptionMatch[1].trim(),
            }));
          } else {
            const firstParagraph = response.content.split('\n\n')[0].trim();
            setFormData(prev => ({
              ...prev,
              description: firstParagraph,
            }));
          }
        }
      }
    } catch (error) {
      console.error('説明生成エラー:', error);
      showError(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`, 7000, {
        title: 'エラー',
      });
    } finally {
      setIsAIGenerating(false);
    }
  };

  // AI生成結果を追加
  const handleAddAIResults = () => {
    const relationshipsToAdd = aiResults
      .filter((_, idx) => selectedResults.has(idx))
      .map(rel => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        from: rel.from!,
        to: rel.to!,
        type: rel.type || 'friend',
        strength: rel.strength || 3,
        description: rel.description,
        notes: rel.notes,
      }));

    if (relationshipsToAdd.length === 0) {
      showWarning('追加する関係性を選択してください。', 5000, {
        title: '選択エラー',
      });
      return;
    }

    // 重複チェック
    const existingPairs = new Set(
      relationships.map(r => {
        const sorted = [r.from, r.to].sort();
        return `${sorted[0]}-${sorted[1]}`;
      })
    );

    const validRelationships = relationshipsToAdd.filter(rel => {
      const sorted = [rel.from, rel.to].sort();
      const pairKey = `${sorted[0]}-${sorted[1]}`;
      if (existingPairs.has(pairKey)) {
        return false;
      }
      existingPairs.add(pairKey);
      return true;
    });

    if (validRelationships.length === 0) {
      showInfo('追加できる関係性がありません。既に登録されている可能性があります。', 5000, {
        title: '追加不可',
      });
      return;
    }

    updateProject({
      relationships: [...relationships, ...validRelationships],
    });

    setShowAIAssistant(false);
    setAiResults([]);
    setSelectedResults(new Set());
    showSuccess(`${validRelationships.length}件の関係性を追加しました。`);
  };

  // 結果の選択を切り替え
  const toggleResultSelection = (index: number) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedResults(newSelected);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center space-x-3">
            <Network className="h-6 w-6 text-indigo-600" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              人物相関図
            </span>
          </div>
        }
        size="full"
        ref={modalRef}
      >
        <div className="flex flex-col h-[80vh]">
          {/* ヘッダーアクション */}
          <div className="flex items-center justify-end space-x-2 mb-4">
            <button
              onClick={() => setShowAIAssistant(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
              title="AIアシスタント"
            >
              <Sparkles className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">AIアシスト</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${viewMode === 'list'
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              title="リスト表示"
            >
              <LayoutList className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('flow')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${viewMode === 'flow'
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              title="フローチャート表示"
            >
              <GitBranch className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">追加</span>
            </button>
          </div>

          {/* 関係リスト */}
          <div className="flex-1 overflow-y-auto p-6">
            {viewMode === 'list' ? (
              relationships.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <EmptyState
                    icon={Network}
                    iconColor="text-indigo-400 dark:text-indigo-500"
                    title="まだ関係が登録されていません"
                    description="キャラクター間の関係性を登録しましょう。友人、敵対、家族、恋愛、師弟、ライバルなど、物語を彩る多様な関係性を管理できます。AIアシスタント機能を使って、キャラクター設定から自動的に関係性を推論することも可能です。"
                    actionLabel="最初の関係を追加"
                    onAction={() => setShowAddForm(true)}
                  />
                </div>
              ) : (
                <div className="grid gap-4">
                  {relationships.map((rel) => {
                    const TypeIcon = relationshipTypes[rel.type].icon;
                    const typeInfo = relationshipTypes[rel.type];

                    return (
                      <div
                        key={rel.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="flex items-center space-x-2">
                                <div className={`w-10 h-10 rounded-full ${typeInfo.color} flex items-center justify-center`}>
                                  <TypeIcon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                      {getCharacterName(rel.from)}
                                    </span>
                                    <span className="text-gray-500">→</span>
                                    <span className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                      {getCharacterName(rel.to)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-['Noto_Sans_JP']">
                                      {typeInfo.label}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                      {[1, 2, 3, 4, 5].map((level) => (
                                        <div
                                          key={level}
                                          className={`w-3 h-3 rounded-full ${level <= rel.strength ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                        />
                                      ))}
                                      <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] ml-1">
                                        強度: {rel.strength}/5
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {rel.description && (
                              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2 font-['Noto_Sans_JP']">
                                {rel.description}
                              </p>
                            )}
                            {rel.notes && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 italic font-['Noto_Sans_JP']">
                                {rel.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleEditRelationship(rel)}
                              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRelationship(rel.id)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // フローチャート表示（SVG）
              !flowChartLayout || flowChartLayout.nodes.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <EmptyState
                    icon={GitBranch}
                    iconColor="text-indigo-400 dark:text-indigo-500"
                    title="まだ関係が登録されていません"
                    description="キャラクター間の関係性を登録すると、フローチャート形式で視覚的に表示されます。関係性を追加して、物語の人間関係を可視化しましょう。"
                    actionLabel="最初の関係を追加"
                    onAction={() => setShowAddForm(true)}
                  />
                </div>
              ) : (
                <div className="relative w-full h-full overflow-auto">
                  <svg
                    className="w-full h-full"
                    style={{
                      width: `${flowChartLayout.svgWidth}px`,
                      height: `${flowChartLayout.svgHeight}px`
                    }}
                  >
                    {/* SVG定義 */}
                    <defs>
                      {/* 矢印マーカー */}
                      <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 10 3, 0 6"
                          fill="#374151"
                        />
                      </marker>

                      {/* クリッピングパス定義 */}
                      {flowChartLayout.nodes.map((node: FlowChartNode, idx: number) => (
                        <clipPath key={`clip-${idx}`} id={`clip-${idx}`}>
                          <circle cx={node.x} cy={node.y - 50} r="35" />
                        </clipPath>
                      ))}
                    </defs>

                    {/* エッジ（矢印）の線を先に描画 */}
                    {flowChartLayout.edges.map((edge: FlowChartEdge, idx: number) => {
                      if (!edge) return null;
                      const relType = relationshipTypes[edge.type as CharacterRelationship['type']];

                      // キャラクター円の中心座標（y-50のオフセットを考慮）
                      const fromCenterY = edge.fromY - 50;
                      const toCenterY = edge.toY - 50;

                      const dx = edge.toX - edge.fromX;
                      const dy = toCenterY - fromCenterY;
                      const angle = Math.atan2(dy, dx);

                      // ノードのサイズを考慮して線を描画（円の半径45）
                      const nodeRadius = 45;

                      // オフセットを適用（双方向の矢印を並列に配置）
                      const perpendicularAngle = angle + Math.PI / 2;
                      const offsetX = edge.offset !== undefined ? edge.offset * Math.cos(perpendicularAngle) : 0;
                      const offsetY = edge.offset !== undefined ? edge.offset * Math.sin(perpendicularAngle) : 0;

                      const startX = edge.fromX + nodeRadius * Math.cos(angle) + offsetX;
                      const startY = fromCenterY + nodeRadius * Math.sin(angle) + offsetY;
                      const endX = edge.toX - nodeRadius * Math.cos(angle) + offsetX;
                      const endY = toCenterY - nodeRadius * Math.sin(angle) + offsetY;

                      // ラベル位置を矢印の先端側に配置（65%の位置）
                      const labelRatio = 0.65;
                      const labelX = startX + (endX - startX) * labelRatio;
                      const labelY = startY + (endY - startY) * labelRatio;

                      // 強度に応じた線の太さ（1-5を1-3ピクセルに調整）
                      const strokeWidth = edge.strength * 0.4 + 0.6;

                      return (
                        <g key={`edge-${idx}`}>
                          {/* 矢印の線 */}
                          <line
                            x1={startX}
                            y1={startY}
                            x2={endX}
                            y2={endY}
                            stroke={relType.svgColor}
                            strokeWidth={strokeWidth}
                            fill="none"
                            opacity="0.8"
                            markerEnd="url(#arrowhead)"
                            strokeDasharray={edge.type === 'enemy' ? "5,5" : "none"}
                          />
                          {/* ラベル背景 */}
                          <ellipse
                            cx={labelX}
                            cy={labelY}
                            rx="35"
                            ry="20"
                            fill={relType.svgColor}
                            opacity="0.9"
                          />
                          {/* 関係の種類ラベル */}
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            fill="white"
                            fontSize="11"
                            fontWeight="bold"
                            dy="4"
                          >
                            {relType.label}
                          </text>
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            fill="white"
                            fontSize="11"
                            fontWeight="bold"
                            dy="18"
                          >
                            {`★${edge.strength}`}
                          </text>
                        </g>
                      );
                    })}

                    {/* ノード（キャラクター）を描画 */}
                    {flowChartLayout.nodes.map((node: FlowChartNode, idx: number) => (
                      <g key={node.id}>
                        {/* キャラクター背景（円形） */}
                        <circle
                          cx={node.x}
                          cy={node.y - 50}
                          r="45"
                          fill="#ffffff"
                          stroke="#c7d2fe"
                          strokeWidth="2"
                        />

                        {/* キャラクター画像 */}
                        <circle
                          cx={node.x}
                          cy={node.y - 50}
                          r="35"
                          fill="#6366f1"
                        />
                        {node.image ? (
                          <image
                            href={node.image}
                            x={node.x - 35}
                            y={node.y - 85}
                            width="70"
                            height="70"
                            clipPath={`url(#clip-${idx})`}
                          />
                        ) : (
                          <text
                            x={node.x}
                            y={node.y - 40}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="40"
                          >
                            👤
                          </text>
                        )}

                        {/* キャラクター名 */}
                        <text
                          x={node.x}
                          y={node.y + 20}
                          textAnchor="middle"
                          fill="#111827"
                          fontSize="14"
                          fontWeight="bold"
                        >
                          {node.name}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )
            )}
          </div>

        </div>
      </Modal>

      {/* 追加/編集フォーム */}
      <Modal
        isOpen={showAddForm}
        onClose={handleCloseForm}
        title={editingRelationship ? '関係を編集' : '関係を追加'}
        size="lg"
        className="z-[60]"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              キャラクター（起点）
            </label>
            <select
              value={formData.from}
              onChange={(e) => setFormData({ ...formData, from: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">選択してください</option>
              {characters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              キャラクター（相手）
            </label>
            <select
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">選択してください</option>
              {characters.filter(char => char.id !== formData.from).map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              関係の種類
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CharacterRelationship['type'] })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(relationshipTypes).map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              関係の強度: {formData.strength || 3}/5
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={formData.strength || 3}
              onChange={(e) => setFormData({ ...formData, strength: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>弱い</span>
              <span>普通</span>
              <span>強い</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                説明
              </label>
              {isConfigured && formData.from && formData.to && (
                <button
                  onClick={handleGenerateDescription}
                  disabled={isAIGenerating}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAIGenerating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="font-['Noto_Sans_JP']">生成中...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3 w-3" />
                      <span className="font-['Noto_Sans_JP']">AIで生成</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
              placeholder="関係の詳細な説明"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
              備考
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Noto_Sans_JP']"
              placeholder="追加情報"
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              onClick={handleCloseForm}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              キャンセル
            </button>
            <button
              onClick={handleAddRelationship}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Save className="h-5 w-5" />
              <span className="font-['Noto_Sans_JP']">保存</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* AIアシスタントモーダル */}
      <Modal
        isOpen={showAIAssistant}
        onClose={() => {
          setShowAIAssistant(false);
          setAiResults([]);
          setSelectedResults(new Set());
          setConsistencyCheckResult('');
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AIアシスタント
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                関係性の自動推論・提案・整合性チェック
              </p>
            </div>
          </div>
        }
        size="lg"
        className="z-[70]"
      >

        {!isConfigured ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 font-['Noto_Sans_JP']">
                  AI設定が必要です
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1 font-['Noto_Sans_JP']">
                  設定画面でAPIキーを設定してください。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* モード選択 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
              <button
                onClick={() => {
                  setAiMode('infer');
                  setAiResults([]);
                  setSelectedResults(new Set());
                  setConsistencyCheckResult('');
                }}
                className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'infer'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <Zap className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">自動推論</div>
                <div className="text-xs mt-1 opacity-80">設定から推論</div>
              </button>
              <button
                onClick={() => {
                  setAiMode('suggest');
                  setAiResults([]);
                  setSelectedResults(new Set());
                  setConsistencyCheckResult('');
                }}
                className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'suggest'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <Wand2 className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">関係性提案</div>
                <div className="text-xs mt-1 opacity-80">新規関係性提案</div>
              </button>
              <button
                onClick={() => {
                  setAiMode('check');
                  setAiResults([]);
                  setSelectedResults(new Set());
                  setConsistencyCheckResult('');
                }}
                className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'check'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <CheckCircle className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">整合性チェック</div>
                <div className="text-xs mt-1 opacity-80">矛盾を検出</div>
              </button>
              <button
                onClick={() => {
                  setAiMode('generate');
                  setAiResults([]);
                  setSelectedResults(new Set());
                  setConsistencyCheckResult('');
                }}
                className={`px-4 py-3 rounded-lg transition-colors font-['Noto_Sans_JP'] ${aiMode === 'generate'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <Lightbulb className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">説明生成</div>
                <div className="text-xs mt-1 opacity-80">説明文生成</div>
              </button>
            </div>

            {/* 自動推論モード */}
            {aiMode === 'infer' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                    <strong>自動推論機能</strong><br />
                    キャラクターの設定（役割、性格、背景など）から、自然な関係性を自動的に推論します。
                  </p>
                </div>
                <button
                  onClick={handleInferRelationships}
                  disabled={isAIGenerating || characters.length < 2}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAIGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-['Noto_Sans_JP']">推論中...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      <span className="font-['Noto_Sans_JP']">関係性を自動推論</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 関係性提案モード */}
            {aiMode === 'suggest' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                    <strong>関係性提案機能</strong><br />
                    プロットの流れやキャラクターの設定を分析して、物語に追加すべき重要な関係性を提案します。
                  </p>
                </div>
                <button
                  onClick={handleSuggestRelationships}
                  disabled={isAIGenerating || characters.length < 2}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAIGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-['Noto_Sans_JP']">提案中...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-5 w-5" />
                      <span className="font-['Noto_Sans_JP']">関係性を提案</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 整合性チェックモード */}
            {aiMode === 'check' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                    <strong>整合性チェック機能</strong><br />
                    関係性の矛盾や問題点をチェックし、孤立したキャラクターを検出します。
                  </p>
                </div>
                <button
                  onClick={handleCheckConsistency}
                  disabled={isAIGenerating || relationships.length === 0}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAIGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-['Noto_Sans_JP']">チェック中...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-['Noto_Sans_JP']">整合性をチェック</span>
                    </>
                  )}
                </button>
                {consistencyCheckResult && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                      チェック結果
                    </h4>
                    <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                      {consistencyCheckResult}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 説明生成モード */}
            {aiMode === 'generate' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                    <strong>説明生成機能</strong><br />
                    関係性追加フォームでキャラクターを選択後、「AIで生成」ボタンを使用してください。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAIAssistant(false);
                    setShowAddForm(true);
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span className="font-['Noto_Sans_JP']">関係性追加フォームを開く</span>
                </button>
              </div>
            )}

            {/* 生成結果 */}
            {aiResults.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    生成結果 ({aiResults.length}件)
                  </h4>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedResults(new Set(aiResults.map((_, idx) => idx)));
                      }}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-['Noto_Sans_JP']"
                    >
                      すべて選択
                    </button>
                    <span className="text-gray-400">|</span>
                    <button
                      onClick={() => setSelectedResults(new Set())}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:underline font-['Noto_Sans_JP']"
                    >
                      選択解除
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {aiResults.map((rel, idx) => {
                    const fromChar = characters.find(c => c.id === rel.from);
                    const toChar = characters.find(c => c.id === rel.to);
                    const typeInfo = relationshipTypes[rel.type || 'friend'];

                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedResults.has(idx)
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        onClick={() => toggleResultSelection(idx)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {selectedResults.has(idx) ? (
                              <CheckCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                {fromChar?.name || '不明'}
                              </h5>
                              <span className="text-gray-500">→</span>
                              <h5 className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                {toChar?.name || '不明'}
                              </h5>
                              <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full font-['Noto_Sans_JP']">
                                {typeInfo.label}
                              </span>
                              <div className="flex items-center space-x-1">
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <div
                                    key={level}
                                    className={`w-2 h-2 rounded-full ${level <= (rel.strength || 3) ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                                      }`}
                                  />
                                ))}
                                <span className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] ml-1">
                                  {rel.strength || 3}/5
                                </span>
                              </div>
                            </div>
                            {rel.description && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                                {rel.description}
                              </p>
                            )}
                            {rel.notes && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic font-['Noto_Sans_JP']">
                                {rel.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setAiResults([]);
                      setSelectedResults(new Set());
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddAIResults}
                    disabled={selectedResults.size === 0}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-['Noto_Sans_JP']">
                      {selectedResults.size}件を追加
                    </span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
};

