import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus, Image, Eye, Trash2, Tag, Upload, FileImage, Download, ZoomIn, ZoomOut, RotateCw, Maximize2, Info, Edit3, Save, X } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { ImageItem } from '../types/ai';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';
import { useToast } from './Toast';
import { OptimizedImage } from './OptimizedImage';
import { databaseService } from '../services/databaseService';
import { optimizeImageToWebP } from '../utils/performanceUtils';
import { EmptyState } from './common/EmptyState';

// 画像カードコンポーネント（メモ化）
interface ImageCardProps {
  image: ImageItem;
  categoryInfo: { id: string; label: string; color: string };
  onView: (image: ImageItem) => void;
  onEdit: (image: ImageItem) => void;
  onDelete: (id: string) => void;
}

const ImageCard = React.memo<ImageCardProps>(({ image, categoryInfo, onView, onEdit, onDelete }) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 group">
      <div className="aspect-square relative overflow-hidden">
        <OptimizedImage
          src={image.url}
          alt={image.title}
          imageId={image.imageId}
          className="w-full h-full group-hover:scale-105 transition-transform duration-200"
          lazy={true}
          quality={0.8}
          onError={(error) => {
            console.error('画像読み込みエラー:', error);
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex space-x-2">
            <button
              onClick={() => onView(image)}
              className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
              title="画像を表示"
            >
              <Eye className="h-4 w-4 text-gray-700" />
            </button>
            <button
              onClick={() => onEdit(image)}
              className="p-2 bg-blue-500/90 rounded-full hover:bg-blue-500 transition-colors"
              title="画像を編集"
            >
              <Edit3 className="h-4 w-4 text-white" />
            </button>
            <button
              onClick={() => onDelete(image.id)}
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
}, (prevProps, nextProps) => {
  // カスタム比較関数：画像の主要プロパティが変更された場合のみ再レンダリング
  return (
    prevProps.image.id === nextProps.image.id &&
    prevProps.image.title === nextProps.image.title &&
    prevProps.image.description === nextProps.image.description &&
    prevProps.image.category === nextProps.image.category &&
    prevProps.image.url === nextProps.image.url &&
    prevProps.categoryInfo.id === nextProps.categoryInfo.id
  );
});

ImageCard.displayName = 'ImageCard';

// グリッド用仮想スクロールコンポーネント
interface VirtualGridProps<T> {
  items: T[];
  columns: number; // グリッドの列数
  itemHeight: number; // 各アイテムの高さ（概算）
  gap: number; // グリッドのギャップ
  containerHeight: number; // コンテナの高さ
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

function VirtualGrid<T>({
  items,
  columns,
  itemHeight,
  gap,
  containerHeight,
  renderItem,
  className = ''
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 行の高さを計算（アイテムの高さ + ギャップ）
  const rowHeight = itemHeight + gap;

  // 総行数を計算
  const totalRows = Math.ceil(items.length / columns);

  // 表示する行の範囲を計算
  const visibleRange = useMemo(() => {
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.min(
      startRow + Math.ceil(containerHeight / rowHeight) + 2, // 上下に1行ずつ余分に表示
      totalRows
    );

    const startIndex = startRow * columns;
    const endIndex = Math.min(endRow * columns, items.length);

    return {
      startRow,
      endRow,
      startIndex,
      endIndex,
      visibleItems: items.slice(startIndex, endIndex),
      totalHeight: totalRows * rowHeight,
      offsetY: startRow * rowHeight
    };
  }, [scrollTop, rowHeight, containerHeight, items, columns, totalRows]);

  // スクロールイベントハンドラー
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: visibleRange.totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleRange.offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: `0 ${gap / 2}px`
          }}
        >
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            style={{ gap: `${gap}px` }}
          >
            {visibleRange.visibleItems.map((item, index) => (
              <div key={visibleRange.startIndex + index}>
                {renderItem(item, visibleRange.startIndex + index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const { showError, showSuccess } = useToast();
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState<{
    url: string;
    imageId?: string;
    title: string;
    description: string;
    category: ImageItem['category'];
  }>({
    url: '',
    imageId: undefined,
    title: '',
    description: '',
    category: 'reference',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 画像ビューアー関連の状態
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showImageInfo, setShowImageInfo] = useState(false);

  // 編集関連の状態
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    category: 'reference' as ImageItem['category'],
  });
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridContainerHeight, setGridContainerHeight] = useState(600); // デフォルト高さ

  // 自動保存機能（Blobストレージ対応）
  const autoSaveImage = useCallback(async (imageData: { url: string; imageId?: string; title: string; description: string; category: ImageItem['category'] }) => {
    if (!imageData.url.trim() || !imageData.title.trim()) return;

    setIsAutoSaving(true);

    const newImage: ImageItem = {
      id: Date.now().toString(),
      url: imageData.url.trim(),
      imageId: imageData.imageId,
      title: imageData.title.trim(),
      description: imageData.description || '',
      category: imageData.category,
      addedAt: new Date(),
    };

    try {
      // 参照カウントを増やす
      if (newImage.imageId) {
        await databaseService.incrementImageReference(newImage.imageId);
      }

      await updateProject({
        imageBoard: [...(currentProject?.imageBoard || []), newImage]
      });

      // 成功メッセージを短時間表示
      setTimeout(() => {
        setIsAutoSaving(false);
      }, 1000);
    } catch (error) {
      console.error('自動保存エラー:', error);
      setIsAutoSaving(false);
    }
  }, [currentProject, updateProject]);

  // 自動保存のトリガー（フォームデータが変更された時）
  useEffect(() => {
    if (isOpen && currentProject && formData.url.trim() && formData.title.trim() && selectedFile) {
      const timeoutId = setTimeout(() => {
        autoSaveImage(formData);
      }, 2000); // 2秒後に自動保存

      return () => clearTimeout(timeoutId);
    }
  }, [formData, selectedFile, isOpen, currentProject, autoSaveImage]);


  // ファイル処理関数（単一ファイル用）- Blobストレージ対応
  const processFile = async (file: File): Promise<{ imageId: string; url: string } | null> => {
    // ファイルタイプの検証
    if (!file.type.startsWith('image/')) {
      showError('画像ファイルを選択してください。');
      return null;
    }

    // ファイルサイズの検証（10MB制限）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showError('ファイルサイズが大きすぎます。10MB以下の画像を選択してください。');
      return null;
    }

    try {
      // 画像のサイズを取得
      const img = document.createElement('img');
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      // WebP形式に変換してBlobストレージに保存
      const webpBlob = await optimizeImageToWebP(file, 1920, 1080, 0.8);
      const imageId = await databaseService.saveImage(
        webpBlob,
        file.type,
        file.size,
        img.width,
        img.height
      );

      // Blob URLを生成（表示用）
      const blobUrl = URL.createObjectURL(webpBlob);

      return { imageId, url: blobUrl };
    } catch (error) {
      console.error('ファイル処理エラー:', error);
      showError('ファイルの処理に失敗しました。');
      return null;
    }
  };

  // 複数ファイル処理関数 - Blobストレージ対応
  const processMultipleFiles = async (files: FileList | File[]) => {
    if (!currentProject) return;

    const fileArray = Array.from(files);
    const validFiles: Array<{ file: File; imageId: string; url: string }> = [];
    const errors: string[] = [];

    setIsUploading(true);

    // すべてのファイルを処理
    for (const file of fileArray) {
      const result = await processFile(file);
      if (result) {
        validFiles.push({ file, ...result });
      } else {
        errors.push(file.name);
      }
    }

    if (validFiles.length === 0) {
      setIsUploading(false);
      if (errors.length > 0) {
        showError(`${errors.length}個のファイルの処理に失敗しました。`);
      }
      return;
    }

    // 複数ファイルを一括追加
    const newImages: ImageItem[] = validFiles.map(({ file, imageId, url }, index) => ({
      id: (Date.now() + index).toString(),
      imageId, // BlobストレージのID
      url, // 表示用のBlob URL
      title: file.name.replace(/\.[^/.]+$/, ''), // 拡張子を除いたファイル名
      description: '',
      category: 'reference' as ImageItem['category'],
      addedAt: new Date(),
    }));

    try {
      // 参照カウントを増やす
      for (const image of newImages) {
        if (image.imageId) {
          await databaseService.incrementImageReference(image.imageId);
        }
      }

      await updateProject({
        imageBoard: [...(currentProject.imageBoard || []), ...newImages],
      });

      showSuccess(`${validFiles.length}個の画像を追加しました${errors.length > 0 ? `（${errors.length}個のファイルはスキップされました）` : ''}`);
    } catch (error) {
      console.error('画像追加エラー:', error);
      showError('画像の追加に失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  // ファイル選択ハンドラー
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 複数ファイルの場合は一括処理
    if (files.length > 1) {
      await processMultipleFiles(files);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // 単一ファイルの処理
    const file = files[0];
    setSelectedFile(file);
    setIsUploading(true);

    const result = await processFile(file);
    if (result) {
      setPreviewUrl(result.url);
      setFormData(prev => ({ ...prev, url: result.url, imageId: result.imageId }));
    }

    setIsUploading(false);
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

  // ドラッグ&ドロップハンドラー
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 子要素への移動を除外
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // 複数ファイルの場合は一括処理
    if (files.length > 1) {
      await processMultipleFiles(files);
      return;
    }

    // 単一ファイルの処理（フォームが開いている場合のみ）
    if (showAddForm) {
      const file = files[0];
      setSelectedFile(file);
      setIsUploading(true);

      const result = await processFile(file);
      if (result) {
        setPreviewUrl(result.url);
        setFormData(prev => ({ ...prev, url: result.url, imageId: result.imageId }));
      }

      setIsUploading(false);
    } else {
      // フォームが開いていない場合は、フォームを開いてから処理
      setShowAddForm(true);
      const file = files[0];
      setSelectedFile(file);
      setIsUploading(true);

      const result = await processFile(file);
      if (result) {
        setPreviewUrl(result.url);
        setFormData(prev => ({ ...prev, url: result.url, imageId: result.imageId, title: file.name.replace(/\.[^/.]+$/, '') }));
      }

      setIsUploading(false);
    }
  };


  const handleAddImage = async () => {
    if (!currentProject || !formData.url.trim() || !formData.title.trim()) return;

    const newImage: ImageItem = {
      id: Date.now().toString(),
      url: formData.url.trim(),
      imageId: formData.imageId,
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      addedAt: new Date(),
    };

    try {
      // 参照カウントを増やす
      if (newImage.imageId) {
        await databaseService.incrementImageReference(newImage.imageId);
      }

      await updateProject({
        imageBoard: [...currentProject.imageBoard, newImage],
      });

      setFormData({ url: '', title: '', description: '', category: 'reference' });
      setSelectedFile(null);
      setPreviewUrl('');
      setShowAddForm(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('画像追加エラー:', error);
      showError('画像の追加に失敗しました。');
    }
  };


  const handleDeleteImage = async (id: string) => {
    if (!currentProject) return;
    
    // 削除する画像を取得
    const imageToDelete = currentProject.imageBoard.find(img => img.id === id) as ImageItem | undefined;
    
    try {
      // Blobストレージから削除（参照カウントを減らす）
      if (imageToDelete?.imageId) {
        await databaseService.decrementImageReference(imageToDelete.imageId);
        // 参照カウントが0になった場合は自動削除される（オプション）
      }
      
      // プロジェクトから削除
      await updateProject({
        imageBoard: currentProject.imageBoard.filter(img => img.id !== id),
      });
    } catch (error) {
      console.error('画像削除エラー:', error);
      showError('画像の削除に失敗しました。');
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId) || categories[4];
  };

  // 画像ビューアー関連の関数
  const handleViewImage = (image: ImageItem) => {
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
  const handleEditImage = (image: ImageItem) => {
    setEditingImage(image);
    setEditFormData({
      title: image.title,
      description: image.description || '',
      category: image.category,
    });
    setShowEditForm(true);
  };

  const handleUpdateImage = () => {
    if (!currentProject || !editingImage || !editFormData.title.trim()) return;

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

  const handleCancelEdit = useCallback(() => {
    setShowEditForm(false);
    setEditingImage(null);
    setEditFormData({ title: '', description: '', category: 'reference' });
  }, []);

  // 画像編集モーダル用のESCキー処理
  const editModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showEditForm) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCancelEdit();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showEditForm, handleCancelEdit]);

  // 画像ビューアーモーダル用のESCキー処理
  const viewerModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showImageViewer) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCloseImageViewer();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showImageViewer]);

  // グリッドコンテナの高さを計算
  useEffect(() => {
    if (!isOpen || !gridContainerRef.current) return;

    const updateHeight = () => {
      if (gridContainerRef.current) {
        const rect = gridContainerRef.current.getBoundingClientRect();
        setGridContainerHeight(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, [isOpen, showAddForm]);

  // すべてのHooksの呼び出し後に早期リターンを配置
  if (!isOpen || !currentProject) return null;

  const filteredImages = selectedCategory === 'all'
    ? currentProject.imageBoard
    : currentProject.imageBoard.filter(img => img.category === selectedCategory);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // オーバーレイ自体がクリックされた場合のみ閉じる
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 glass-overlay flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className="glass-strong glass-shimmer rounded-2xl shadow-2xl max-w-6xl w-full mx-4 h-[90vh] flex flex-col transform transition-all duration-300 ease-out animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/20 dark:border-white/10 shrink-0">
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
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
                aria-label="閉じる"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2 mt-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedCategory === 'all'
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
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedCategory === category.id
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

                    {/* ファイル選択ボタン（ドロップゾーン） */}
                    <div className="space-y-3">
                      <div
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`w-full p-6 border-2 border-dashed rounded-lg transition-all duration-200 ${isDraggingOver
                            ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.02]'
                            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400'
                          }`}
                      >
                        <button
                          type="button"
                          onClick={handleSelectFile}
                          disabled={isUploading}
                          className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-center">
                            {isUploading ? (
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                            ) : (
                              <Upload className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDraggingOver
                                  ? 'text-indigo-500 dark:text-indigo-400'
                                  : 'text-gray-400 group-hover:text-indigo-500'
                                }`} />
                            )}
                            <p className={`font-['Noto_Sans_JP'] transition-colors ${isDraggingOver
                                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                                : 'text-gray-600 dark:text-gray-400'
                              }`}>
                              {isUploading
                                ? '読み込み中...'
                                : isDraggingOver
                                  ? 'ここにドロップしてアップロード'
                                  : '画像ファイルを選択またはドラッグ&ドロップ'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-['Noto_Sans_JP']">
                              JPG, PNG, GIF, WebP (最大10MB) - 複数ファイル対応
                            </p>
                          </div>
                        </button>
                      </div>

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

                    {/* 隠しファイル入力（複数ファイル対応） */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
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
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as ImageItem['category'] })}
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
                        setFormData({ url: '', imageId: undefined, title: '', description: '', category: 'reference' });
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
            /* Image Grid with Virtual Scroll */
            <div
              ref={gridContainerRef}
              className="p-6 h-full relative"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {filteredImages.length === 0 ? (
                isDraggingOver ? (
                  <div className="text-center py-16 rounded-lg border-4 border-dashed border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 transition-all duration-200">
                    <Upload className="h-16 w-16 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-2 font-['Noto_Sans_JP']">
                      ここにドロップして画像を追加
                    </h3>
                    <p className="text-indigo-500 dark:text-indigo-300 font-['Noto_Sans_JP']">
                      複数の画像を一度にドロップできます
                    </p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <EmptyState
                      icon={Image}
                      iconColor="text-indigo-400 dark:text-indigo-500"
                      title={selectedCategory === 'all' 
                        ? 'まだ画像がありません' 
                        : `${getCategoryInfo(selectedCategory).label}の画像がありません`}
                      description={selectedCategory === 'all'
                        ? 'インスピレーションとなる画像を追加して、創作の参考にしましょう。キャラクターのイメージ、世界観、シーンの雰囲気など、物語を彩る画像を集められます。'
                        : `${getCategoryInfo(selectedCategory).label}カテゴリの画像を追加して、創作の参考にしましょう。`}
                      actionLabel="最初の画像を追加"
                      onAction={() => setShowAddForm(true)}
                    />
                  </div>
                )
              ) : (
                <>
                  {isDraggingOver && (
                    <div className="absolute inset-0 z-10 border-4 border-dashed border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <Upload className="h-12 w-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-2" />
                        <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 font-['Noto_Sans_JP']">
                          ここにドロップして画像を追加
                        </p>
                        <p className="text-sm text-indigo-500 dark:text-indigo-300 font-['Noto_Sans_JP']">
                          複数の画像を一度にドロップできます
                        </p>
                      </div>
                    </div>
                  )}
                  {/* 仮想スクロールを適用（50枚以上の画像の場合のみ） */}
                  {filteredImages.length >= 50 ? (
                    <VirtualGrid
                      items={filteredImages}
                      columns={4} // lg:grid-cols-4
                      itemHeight={320} // 画像カードの概算高さ（aspect-square + padding）
                      gap={16} // gap-4 = 16px
                      containerHeight={gridContainerHeight - 48} // padding分を引く
                      renderItem={(image) => {
                        const categoryInfo = getCategoryInfo(image.category);
                        return (
                          <ImageCard
                            key={image.id}
                            image={image}
                            categoryInfo={categoryInfo}
                            onView={handleViewImage}
                            onEdit={handleEditImage}
                            onDelete={handleDeleteImage}
                          />
                        );
                      }}
                      className={isDraggingOver ? 'opacity-75' : ''}
                    />
                  ) : (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative ${isDraggingOver ? 'opacity-75' : ''
                      }`}>
                      {filteredImages.map((image) => {
                        const categoryInfo = getCategoryInfo(image.category);
                        return (
                          <ImageCard
                            key={image.id}
                            image={image}
                            categoryInfo={categoryInfo}
                            onView={handleViewImage}
                            onEdit={handleEditImage}
                            onDelete={handleDeleteImage}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 画像編集モーダル */}
      {showEditForm && editingImage && (
        <div
          className="fixed inset-0 glass-overlay flex items-center justify-center z-[70] transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelEdit();
            }
          }}
        >
          <div
            ref={editModalRef}
            className="glass-strong glass-shimmer rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-out animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
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
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
                  aria-label="閉じる"
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
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as ImageItem['category'] })}
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
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImageViewer(false);
            }
          }}
        >
          <div
            ref={viewerModalRef}
            className="relative w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 bg-black/60 backdrop-blur-lg text-white border-b border-white/10">
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