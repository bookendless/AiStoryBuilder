import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

// リップルエフェクト用のスタイル
const rippleStyle = `
@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

.ripple-effect {
  position: relative;
  overflow: hidden;
}

.ripple-effect::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  width: 20px;
  height: 20px;
  margin-top: -10px;
  margin-left: -10px;
  animation: ripple 0.6s;
  pointer-events: none;
}
`;

// リップルエフェクトを適用するHOC
export const withRipple = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P & { ripple?: boolean }> => {
  return ({ ripple = true, ...props }) => {
    const [rippleActive, setRippleActive] = useState(false);
    const componentRef = useRef<HTMLElement>(null);

    const handleClick = (e: React.MouseEvent) => {
      if (!ripple || !componentRef.current) return;

      const button = componentRef.current as HTMLElement;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const rippleElement = document.createElement('span');
      rippleElement.className = 'ripple-effect';
      rippleElement.style.position = 'absolute';
      rippleElement.style.left = `${x}px`;
      rippleElement.style.top = `${y}px`;
      rippleElement.style.width = '20px';
      rippleElement.style.height = '20px';
      rippleElement.style.borderRadius = '50%';
      rippleElement.style.background = 'rgba(255, 255, 255, 0.6)';
      rippleElement.style.transform = 'scale(0)';
      rippleElement.style.animation = 'ripple 0.6s';
      rippleElement.style.pointerEvents = 'none';

      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(rippleElement);

      setTimeout(() => {
        rippleElement.remove();
      }, 600);
    };

    return (
      <>
        <style>{rippleStyle}</style>
        <Component
          {...(props as P)}
          ref={componentRef}
          onClick={(e: React.MouseEvent) => {
            handleClick(e);
            if ((props as any).onClick) {
              (props as any).onClick(e);
            }
          }}
        />
      </>
    );
  };
};

// チェックマークアニメーションコンポーネント
interface CheckmarkAnimationProps {
  show: boolean;
  size?: number;
  className?: string;
}

export const CheckmarkAnimation: React.FC<CheckmarkAnimationProps> = ({
  show,
  size = 24,
  className = '',
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!show && !isAnimating) return null;

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        animation: show ? 'checkmarkPop 0.5s ease-out' : 'none',
      }}
    >
      <style>{`
        @keyframes checkmarkPop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <div className="rounded-full bg-semantic-success p-1">
        <Check
          className="text-white"
          size={size}
          strokeWidth={3}
          style={{
            animation: 'checkmarkDraw 0.5s ease-out 0.2s both',
          }}
        />
      </div>
      <style>{`
        @keyframes checkmarkDraw {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .checkmark-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>
    </div>
  );
};

// シェイクアニメーションコンポーネント
interface ShakeAnimationProps {
  trigger: boolean;
  children: React.ReactNode;
  className?: string;
}

export const ShakeAnimation: React.FC<ShakeAnimationProps> = ({
  trigger,
  children,
  className = '',
}) => {
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsShaking(true);
      const timer = setTimeout(() => {
        setIsShaking(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .shake-animation {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
      <div className={isShaking ? `shake-animation ${className}` : className}>
        {children}
      </div>
    </>
  );
};

// リップルエフェクト付きボタンコンポーネント
interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ripple?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const RippleButton: React.FC<RippleButtonProps> = ({
  ripple = true,
  variant = 'primary',
  className = '',
  children,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ripple || !buttonRef.current) {
      if (props.onClick) {
        props.onClick(e);
      }
      return;
    }

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rippleElement = document.createElement('span');
    rippleElement.style.position = 'absolute';
    rippleElement.style.left = `${x}px`;
    rippleElement.style.top = `${y}px`;
    rippleElement.style.width = '20px';
    rippleElement.style.height = '20px';
    rippleElement.style.borderRadius = '50%';
    rippleElement.style.background = 'rgba(255, 255, 255, 0.6)';
    rippleElement.style.transform = 'scale(0)';
    rippleElement.style.animation = 'ripple 0.6s';
    rippleElement.style.pointerEvents = 'none';
    rippleElement.style.zIndex = '1';

    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(rippleElement);

    setTimeout(() => {
      rippleElement.remove();
    }, 600);

    if (props.onClick) {
      props.onClick(e);
    }
  };

  const variantClasses = {
    primary: 'bg-ai-500 hover:bg-ai-600 text-white',
    secondary: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
  };

  return (
    <>
      <style>{rippleStyle}</style>
      <button
        ref={buttonRef}
        className={`${variantClasses[variant]} ${className} transition-colors`}
        {...props}
        onClick={handleClick}
      >
        {children}
      </button>
    </>
  );
};
































