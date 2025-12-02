/**
 * 最適化された画像コンポーネント
 * 画像の圧縮、遅延読み込み、エラーハンドリングを提供
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { compressImage, optimizeBase64Image } from '../utils/performanceUtils';
import { databaseService } from '../services/databaseService';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  lazy?: boolean;
  placeholder?: string;
  imageId?: string; // Blobストレージの画像ID
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onClick?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  imageClassName = '',
  objectFit = 'cover',
  width,
  height,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.8,
  lazy = true,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
  imageId,
  onLoad,
  onError,
  onClick
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 画像の最適化処理
  const optimizeImage = useCallback(async (imageSrc: string) => {
    try {
      setIsLoading(true);
      setIsError(false);

      // Base64画像の場合は最適化
      if (imageSrc.startsWith('data:image/')) {
        // qualityパラメータを使用してファイルサイズ制限を計算
        const maxSize = Math.round(500000 * quality); // qualityに基づいてサイズ制限を調整
        const optimizedSrc = await optimizeBase64Image(imageSrc, maxSize);
        setImageSrc(optimizedSrc);
      } else {
        setImageSrc(imageSrc);
      }
    } catch (error) {
      console.error('画像の最適化エラー:', error);
      setImageSrc(imageSrc); // エラーの場合は元の画像を使用
    } finally {
      setIsLoading(false);
    }
  }, [quality]);

  // 遅延読み込みの設定
  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observerRef.current?.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy]);

  // 画像の読み込み（Blobストレージ対応）
  useEffect(() => {
    if (!isVisible) return;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        // imageIdが指定されている場合はBlobストレージから読み込む
        if (imageId) {
          const blobUrl = await databaseService.getImageUrl(imageId);
          if (blobUrl) {
            setImageSrc(blobUrl);
            setIsLoading(false);
            return;
          } else {
            throw new Error('画像を取得できませんでした');
          }
        }

        // 通常のsrcを使用
        if (src) {
          await optimizeImage(src);
        }
      } catch (error) {
        console.error('画像読み込みエラー:', error);
        setIsError(true);
        setIsLoading(false);
        if (onError) {
          onError(error instanceof Error ? error : new Error('画像の読み込みに失敗しました'));
        }
      }
    };

    loadImage();
  }, [isVisible, src, imageId, optimizeImage, onError]);

  // 画像の読み込み完了
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setIsError(false);
    onLoad?.();
  }, [onLoad]);

  // 画像の読み込みエラー
  const handleError = useCallback((error: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('画像の読み込みエラー:', error);
    setIsLoading(false);
    setIsError(true);
    onError?.(new Error('画像の読み込みに失敗しました'));
  }, [onError]);

  // クリックイベント
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  const objectFitClass = (() => {
    switch (objectFit) {
      case 'contain':
        return 'object-contain';
      case 'fill':
        return 'object-fill';
      case 'none':
        return 'object-none';
      case 'scale-down':
        return 'object-scale-down';
      case 'cover':
      default:
        return 'object-cover';
    }
  })();

  const imageStyle: React.CSSProperties = {
    maxWidth,
    maxHeight,
  };

  if (typeof width === 'number') {
    imageStyle.width = width;
  }

  if (typeof height === 'number') {
    imageStyle.height = height;
  }

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
      onClick={handleClick}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📷</div>
            <div className="text-sm">画像を読み込めませんでした</div>
          </div>
        </div>
      )}
      
      <img
        src={imageSrc}
        alt={alt}
        className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${imageClassName}`.trim()}
        onLoad={handleLoad}
        onError={handleError}
        style={imageStyle}
      />
    </div>
  );
}

// 画像アップロードコンポーネント
interface ImageUploadProps {
  onImageSelect: (file: File, base64: string) => void;
  maxSize?: number;
  acceptedTypes?: string[];
  className?: string;
  disabled?: boolean;
  quality?: number;
}

export function ImageUpload({
  onImageSelect,
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  className = '',
  disabled = false,
  quality = 0.8
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ファイルの検証
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!acceptedTypes.includes(file.type)) {
      return { valid: false, error: 'サポートされていないファイル形式です' };
    }
    
    if (file.size > maxSize) {
      return { valid: false, error: `ファイルサイズが大きすぎます（最大${Math.round(maxSize / 1024 / 1024)}MB）` };
    }
    
    return { valid: true };
  };

  // ファイルの処理
  const processFile = async (file: File) => {
    try {
      setIsProcessing(true);
      
      // ファイルの検証
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      // 画像の圧縮（qualityパラメータを使用）
      const compressedBlob = await compressImage(file, 1920, 1080, quality);
      
      // Base64に変換
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onImageSelect(file, base64);
        setIsProcessing(false);
      };
      reader.onerror = () => {
        throw new Error('ファイルの読み込みに失敗しました');
      };
      reader.readAsDataURL(compressedBlob);
    } catch (error) {
      console.error('ファイル処理エラー:', error);
      setIsProcessing(false);
      // エラーハンドリングは親コンポーネントに委ねる
    }
  };

  // ファイル選択
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    processFile(file);
  };

  // ドラッグ&ドロップ
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // クリックでファイル選択
  const handleClick = () => {
    if (disabled || isProcessing) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      
      {isProcessing ? (
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-sm text-gray-600">画像を処理中...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="text-4xl mb-2">📷</div>
          <p className="text-sm text-gray-600">
            画像をドラッグ&ドロップまたはクリックして選択
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {acceptedTypes.map(type => type.split('/')[1]).join(', ').toUpperCase()} 形式
          </p>
        </div>
      )}
    </div>
  );
}


