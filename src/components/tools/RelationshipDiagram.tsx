import React, { useState, useMemo } from 'react';
import { Network, Plus, Edit2, Trash2, X, Save, Users, Heart, UsersRound, Sword, GraduationCap, Zap, LayoutList, GitBranch } from 'lucide-react';
import { useProject, CharacterRelationship } from '../../contexts/ProjectContext';

interface RelationshipDiagramProps {
  isOpen: boolean;
  onClose: () => void;
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

  const relationships = currentProject?.relationships || [];
  const characters = currentProject?.characters || [];

  const getCharacterName = (id: string) => {
    return characters.find(c => c.id === id)?.name || '不明';
  };

  // フローチャート用のレイアウト計算
  const flowChartLayout = useMemo<{ nodes: any[]; edges: any[]; svgWidth: number; svgHeight: number } | null>(() => {
    if (relationships.length === 0 || characters.length === 0) return null;

    // ノードの位置計算（円形配置 + 関係性に基づく最適化）
    const nodes: any[] = [];
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
        ...char,
        x: Math.max(100, x),
        y: Math.max(100, y),
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
    
    const edges = relationships.map((rel, idx) => {
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
      
      return {
        ...rel,
        fromX: fromNode.x,
        fromY: fromNode.y,
        toX: toNode.x,
        toY: toNode.y,
        offset,
      };
    }).filter(edge => edge !== null);

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
      alert('両方のキャラクターを選択してください');
      return;
    }

    if (formData.from === formData.to) {
      alert('自分自身との関係は設定できません');
      return;
    }

    // 既存の関係をチェック（同じ方向の関係のみ重複チェック）
    const exists = relationships.find(
      r => r.from === formData.from && r.to === formData.to
    );

    if (exists && !editingRelationship) {
      alert('この方向の関係は既に登録されています');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Network className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
              人物相関図
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="リスト表示"
            >
              <LayoutList className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('flow')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'flow'
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
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 関係リスト */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'list' ? (
            relationships.length === 0 ? (
              <div className="text-center py-12">
                <Network className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  まだ関係が登録されていません
                </p>
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
                                      className={`w-3 h-3 rounded-full ${
                                        level <= rel.strength ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
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
              <div className="text-center py-12">
                <GitBranch className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  まだ関係が登録されていません
                </p>
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
                    {flowChartLayout.nodes.map((node: any, idx: number) => (
                      <clipPath key={`clip-${idx}`} id={`clip-${idx}`}>
                        <circle cx={node.x} cy={node.y - 50} r="35" />
                      </clipPath>
                    ))}
                  </defs>
                  
                  {/* エッジ（矢印）の線を先に描画 */}
                  {flowChartLayout.edges.map((edge: any, idx: number) => {
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
                  {flowChartLayout.nodes.map((node: any, idx: number) => (
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

        {/* 追加/編集フォーム */}
        {showAddForm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                    {editingRelationship ? '関係を編集' : '関係を追加'}
                  </h3>
                  <button
                    onClick={handleCloseForm}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      説明
                    </label>
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

