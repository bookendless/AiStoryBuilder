import React from 'react';
import { useModalNavigation } from '../../../hooks/useKeyboardNavigation';
import { Modal } from '../../common/Modal';
import { useOverlayBackHandler } from '../../../contexts/BackButtonContext';
import { OptimizedImage } from '../../OptimizedImage';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  characterName: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  characterName
}) => {
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  // Android戻るボタン対応
  useOverlayBackHandler(isOpen, onClose, 'image-viewer-modal', 90);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={characterName}
      size="full"
      className="z-[60] bg-black/75"
      ref={modalRef}
      showCloseButton={true}
    >
      <div className="flex items-center justify-center p-2 min-h-min">
        <OptimizedImage
          src={imageUrl}
          alt={characterName}
          className="max-w-full h-auto rounded-lg shadow-2xl cursor-pointer"
          lazy={false}
          quality={0.9}
          onClick={onClose}
        />
      </div>
    </Modal>
  );
};

























































































