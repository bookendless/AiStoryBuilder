import React from 'react';
import { useModalNavigation } from '../../../hooks/useKeyboardNavigation';
import { Modal } from '../../common/Modal';
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
      <div className="flex items-center justify-center h-[80vh]">
        <OptimizedImage
          src={imageUrl}
          alt={characterName}
          className="max-w-full max-h-full rounded-lg shadow-2xl cursor-pointer"
          lazy={false}
          quality={0.9}
          onClick={onClose}
        />
      </div>
    </Modal>
  );
};



























