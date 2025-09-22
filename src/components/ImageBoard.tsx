import React, { useState, useRef, useEffect } from 'react';
import { Plus, Image, X, Eye, Trash2, Tag, Upload, FileImage, Download, ZoomIn, ZoomOut, RotateCw, Maximize2, Info, Edit3, Save } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface ImageBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

const categories = [
  { id: 'character', label: 'キャラクター', color: 'bg-pink-500' },
  { id: 'setting', label: '舞台・背景', color: 'bg-blue-500' },
  { id: 'mood', label: '雰囲気・ムード', color: 'bg-purple-500' },
  { id: 'reference', label: '参考資料', color: 'bg-green-500' },
  { id: 'other', label: 'その他', color: 'bg-gray-500' },
];

export const ImageBoard: React.FC<ImageBoardProps> = ({ isOpen, onClose }) => {
  const { currentProject, updateProject } = useProject();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    category: 'reference' as const,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 画像ビューアー関連の状態
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showImageInfo, setShowImageInfo] = useState(false);
  
  // 編集関連の状態
  const [editingImage, setEditingImage] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    category: 'reference' as const,
  });
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // 自動保存のトリガー（フォームデータが変更された時）
  useEffect(() => {
    if (isOpen && currentProject && formData.url.trim() && formData.title.trim() && selectedFile) {
      const timeoutId = setTimeout(() => {
        autoSaveImage(formData);
      }, 2000); // 2秒後に自動保存

      return () => clearTimeout(timeoutId);
    }
  }, [formData, selectedFile, isOpen, currentProject]);

  if (!isOpen || !currentProject) return null;

  // ファイルをBase64に変換する関数
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // ファイル選択ハンドラー
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルタイプの検証
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    // ファイルサイズの検証（10MB制限）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('ファイルサイズが大きすぎます。10MB以下の画像を選択してください。');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      const base64 = await fileToBase64(file);
      setPreviewUrl(base64);
      setFormData(prev => ({ ...prev, url: base64 }));
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      alert('ファイルの読み込みに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  // ファイル選択ダイアログを開く
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // ファイルをクリア
  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setFormData(prev => ({ ...prev, url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 自動保存機能
  const autoSaveImage = async (imageData: { url: string; title: string }) => {
    if (!imageData.url.trim() || !imageData.title.trim()) return;

    setIsAutoSaving(true);
    
    const newImage = {
      id: Date.now().toString(),
      url: imageData.url.trim(),
      title: imageData.title.trim(),
      description: imageData.description.trim(),
      category: imageData.category,
      addedAt: new Date(),
    };

    try {
      updateProject({
        imageBoard: [...currentProject.imageBoard, newImage],
      });
      
      // 成功メッセージを短時間表示
      setTimeout(() => {
        setIsAutoSaving(false);
      }, 1000);
    } catch (error) {
      console.error('自動保存エラー:', error);
      setIsAutoSaving(false);
    }
  };

  const handleAddImage = () => {
    if (!formData.url.trim() || !formData.title.trim()) return;

    const newImage = {
      id: Date.now().toString(),
      url: formData.url.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      addedAt: new Date(),
    };

    updateProject({
      imageBoard: [...currentProject.imageBoard, newImage],
    });

    setFormData({ url: '', title: '', description: '', category: 'reference' });
    setSelectedFile(null);
    setPreviewUrl('');
    setShowAddForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const handleDeleteImage = (id: string) => {
    updateProject({
      imageBoard: currentProject.imageBoard.filter(img => img.id !== id),
    });
  };

  const filteredImages = selectedCategory === 'all' 
    ? currentProject.imageBoard 
    : currentProject.imageBoard.filter(img => img.category === selectedCategory);

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId) || categories[4];
  };

  // 画像ビューアー関連の関数
  const handleViewImage = (image: Record<string, unknown>) => {
    setSelectedImage(image);
    setShowImageViewer(true);
    setZoomLevel(1);
    setRotation(0);
    setShowImageInfo(false);
  };

  const handleCloseImageViewer = () => {
    setShowImageViewer(false);
    setSelectedImage(null);
    setZoomLevel(1);
    setRotation(0);
    setShowImageInfo(false);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownloadImage = () => {
    if (!selectedImage) return;
    
    const link = document.createElement('a');
    link.href = selectedImage.url;
    link.download = `${selectedImage.title || 'image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  // 画像編集関連の関数
  const handleEditImage = (image: { title: string; description: string; category: string }) => {
    setEditingImage(image);
    setEditFormData({
      title: image.title,
      description: image.description,
      category: image.category,
    });
    setShowEditForm(true);
  };

  const handleUpdateImage = () => {
    if (!editingImage || !editFormData.title.trim()) return;

    const updatedImages = currentProject.imageBoard.map(img =>
      img.id === editingImage.id
        ? {
            ...img,
            title: editFormData.title.trim(),
            description: editFormData.description.trim(),
            category: editFormData.category,
            updatedAt: new Date(),
          }
        : img
    );

    updateProject({
      imageBoard: updatedImages,
    });

    setShowEditForm(false);
    setEditingImage(null);
    setEditFormData({ title: '', description: '', category: 'reference' });
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setEditingImage(null);
    setEditFormData({ title: '', description: '', category: 'reference' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full mx-4 h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                <Image className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  イメージボード
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {currentProject.title} - {filteredImages.length} 枚の画像
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>画像追加</span>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2 mt-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'
              }`}
            >
              すべて ({currentProject.imageBoard.length})
            </button>
            {categories.map((category) => {
              const count = currentProject.imageBoard.filter(img => img.category === category.id).length;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'
                  }`}
                >
                  {category.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {showAddForm ? (
            /* Add Form */
            <div className="p-6 h-full overflow-y-auto">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 font-['Noto_Sans_JP']">
                  新しい画像を追加
                </h3>
                
                <div className="space-y-4">
                  {/* ファイル選択エリア */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      画像ファイル *
                    </label>
                    
                    {/* ファイル選択ボタン */}
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleSelectFile}
                        disabled={isUploading}
                        className="w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="text-center">
                          {isUploading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                          ) : (
                            <Upload className="h-8 w-8 text-gray-400 group-hover:text-indigo-500 mx-auto mb-2" />
                          )}
                          <p className="text-gray-600 dark:text-gray-400 group-hover:text-indigo-500 font-['Noto_Sans_JP']">
                            {isUploading ? '読み込み中...' : '画像ファイルを選択'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-['Noto_Sans_JP']">
                            JPG, PNG, GIF, WebP (最大10MB)
                          </p>
                        </div>
                      </button>
                      
                      {/* 選択されたファイル情報 */}
                      {selectedFile && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileImage className="h-5 w-5 text-indigo-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                {selectedFile.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleClearFile}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* 隠しファイル入力 */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      タイトル *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="画像の説明やタイトル"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      カテゴリー
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                      説明・メモ
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="この画像についてのメモや説明"
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-['Noto_Sans_JP']"
                    />
                  </div>

                  {/* Preview */}
                  {previewUrl && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                        プレビュー
                      </label>
                      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-w-full h-48 object-cover rounded-lg mx-auto"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setFormData({ url: '', title: '', description: '', category: 'reference' });
                        setSelectedFile(null);
                        setPreviewUrl('');
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleAddImage}
                      disabled={!selectedFile || !formData.title.trim() || isUploading}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
                    >
                      {isAutoSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>自動保存中...</span>
                        </>
                      ) : isUploading ? (
                        '読み込み中...'
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>画像を追加</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Image Grid */
            <div className="p-6 h-full overflow-y-auto">
              {filteredImages.length === 0 ? (
                <div className="text-center py-16">
                  <Image className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 font-['Noto_Sans_JP']">
                    {selectedCategory === 'all' ? 'まだ画像がありません' : `${getCategoryInfo(selectedCategory).label}の画像がありません`}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 font-['Noto_Sans_JP']">
                    インスピレーションとなる画像を追加して、創作の参考にしましょう
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    <Plus className="h-5 w-5" />
                    <span>最初の画像を追加</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredImages.map((image) => {
                    const categoryInfo = getCategoryInfo(image.category);
                    return (
                      <div key={image.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 group">
                        <div className="aspect-square relative overflow-hidden">
                          <img
                            src={image.url}
                            alt={image.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEwMEg3MEwxMDAgNzBaIiBmaWxsPSIjOUI5QkEwIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIHN0cm9rZT0iIzlCOUJBMCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUI5QkEwIiBmb250LXNpemU9IjEyIj7nlLvlg4/jgpLoqq3jgb/ovrzjgoHjgb7jgZvjgpPjgafjgZfjgZ88L3RleHQ+Cjwvc3ZnPgo=';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleViewImage(image)}
                                className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                                title="画像を表示"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </button>
                              <button
                                onClick={() => handleEditImage(image)}
                                className="p-2 bg-blue-500/90 rounded-full hover:bg-blue-500 transition-colors"
                                title="画像を編集"
                              >
                                <Edit3 className="h-4 w-4 text-white" />
                              </button>
                              <button
                                onClick={() => handleDeleteImage(image.id)}
                                className="p-2 bg-red-500/90 rounded-full hover:bg-red-500 transition-colors"
                                title="画像を削除"
                              >
                                <Trash2 className="h-4 w-4 text-white" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate font-['Noto_Sans_JP']">
                              {image.title}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs text-white ${categoryInfo.color}`}>
                              <Tag className="h-3 w-3 inline mr-1" />
                              {categoryInfo.label}
                            </span>
                          </div>
                          {image.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-xs line-clamp-2 font-['Noto_Sans_JP']">
                              {image.description}
                            </p>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-['Noto_Sans_JP']">
                            {image.addedAt.toLocaleDateString('ja-JP')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 画像編集モーダル */}
      {showEditForm && editingImage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
                    <Edit3 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                      画像を編集
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                      {editingImage.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* 画像プレビュー */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                  画像プレビュー
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  <img
                    src={editingImage.url}
                    alt={editingImage.title}
                    className="max-w-full h-48 object-cover rounded-lg mx-auto"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEwMEg3MEwxMDAgNzBaIiBmaWxsPSIjOUI5QkEwIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIHN0cm9rZT0iIzlCOUJBMCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUI5QkEwIiBmb250LXNpemU9IjEyIj7nlLvlg4/jgpLoqq3jgb/ovrzjgoHjgb7jgZvjgpPjgafjgZfjgZ88L3RleHQ+Cjwvc3ZnPgo=';
                    }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    タイトル *
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    placeholder="画像の説明やタイトル"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    カテゴリー
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP']"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                    説明・メモ
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="この画像についてのメモや説明"
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-['Noto_Sans_JP']"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleUpdateImage}
                    disabled={!editFormData.title.trim()}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>更新を保存</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 画像ビューアーモーダル */}
      {showImageViewer && selectedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="relative w-full h-full flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 bg-black/50 text-white">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold font-['Noto_Sans_JP']">
                  {selectedImage.title}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs text-white ${getCategoryInfo(selectedImage.category).color}`}>
                  <Tag className="h-3 w-3 inline mr-1" />
                  {getCategoryInfo(selectedImage.category).label}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* ズームコントロール */}
                <div className="flex items-center space-x-1 bg-black/30 rounded-lg p-1">
                  <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-white/20 rounded transition-colors"
                    title="縮小"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-xs px-2 font-mono">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-white/20 rounded transition-colors"
                    title="拡大"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>

                {/* 回転ボタン */}
                <button
                  onClick={handleRotate}
                  className="p-2 hover:bg-white/20 rounded transition-colors"
                  title="回転"
                >
                  <RotateCw className="h-4 w-4" />
                </button>

                {/* リセットボタン */}
                <button
                  onClick={handleResetView}
                  className="p-2 hover:bg-white/20 rounded transition-colors"
                  title="リセット"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>

                {/* 情報ボタン */}
                <button
                  onClick={() => setShowImageInfo(!showImageInfo)}
                  className={`p-2 rounded transition-colors ${showImageInfo ? 'bg-white/20' : 'hover:bg-white/20'}`}
                  title="画像情報"
                >
                  <Info className="h-4 w-4" />
                </button>

                {/* ダウンロードボタン */}
                <button
                  onClick={handleDownloadImage}
                  className="p-2 hover:bg-white/20 rounded transition-colors"
                  title="ダウンロード"
                >
                  <Download className="h-4 w-4" />
                </button>

                {/* 閉じるボタン */}
                <button
                  onClick={handleCloseImageViewer}
                  className="p-2 hover:bg-white/20 rounded transition-colors"
                  title="閉じる"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 画像表示エリア */}
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  }}
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTQwTDI2MCAyMDBIMTQwTDIwMCAxNDBaIiBmaWxsPSIjOUI5QkEwIi8+CjxjaXJjbGUgY3g9IjIwMCIgY3k9IjIwMCIgcj0iODAiIHN0cm9rZT0iIzlCOUJBMCIgc3Ryb2tlLXdpZHRoPSI0IiBmaWxsPSJub25lIi8+Cjx0ZXh0IHg9IjIwMCIgeT0iMjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUI5QkEwIiBmb250LXNpemU9IjI0Ij7nlLvlg4/jgpLoqq3jgb/ovrzjgoHjgb7jgZvjgpPjgafjgZfjgZ88L3RleHQ+Cjwvc3ZnPgo=';
                  }}
                />
              </div>
            </div>

            {/* 画像情報パネル */}
            {showImageInfo && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2 font-['Noto_Sans_JP']">基本情報</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-300">タイトル:</span> {selectedImage.title}</p>
                      <p><span className="text-gray-300">カテゴリー:</span> {getCategoryInfo(selectedImage.category).label}</p>
                      <p><span className="text-gray-300">追加日:</span> {selectedImage.addedAt.toLocaleDateString('ja-JP')}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 font-['Noto_Sans_JP']">表示設定</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-300">ズーム:</span> {Math.round(zoomLevel * 100)}%</p>
                      <p><span className="text-gray-300">回転:</span> {rotation}°</p>
                    </div>
                  </div>
                </div>
                {selectedImage.description && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 font-['Noto_Sans_JP']">説明</h4>
                    <p className="text-sm text-gray-300 font-['Noto_Sans_JP']">
                      {selectedImage.description}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};