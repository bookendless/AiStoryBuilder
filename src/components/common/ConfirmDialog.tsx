import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { useModalNavigation } from '../../hooks/useKeyboardNavigation';

export type ConfirmDialogType = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: ConfirmDialogType;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
}) => {
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
    onConfirm,
  });

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const typeStyles = {
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/20',
      confirmButton: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/20',
      confirmButton: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/20',
      confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      ref={modalRef}
    >
      <div className="flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-full ${style.iconBg} flex items-center justify-center mb-4`}>
          <Icon className={`h-8 w-8 ${style.iconColor}`} />
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
          {title}
        </h3>
        
        <p className="text-gray-700 dark:text-gray-300 mb-6 font-['Noto_Sans_JP'] whitespace-pre-line">
          {message}
        </p>
        
        <div className="flex items-center space-x-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2 ${style.confirmButton} rounded-lg transition-colors font-['Noto_Sans_JP']`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

