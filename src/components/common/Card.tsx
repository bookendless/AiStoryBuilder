import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    glassEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    hoverEffect = false,
    glassEffect = true,
    ...props
}) => {
    return (
        <div
            className={`
        rounded-2xl
        ${glassEffect
                    ? 'glass'
                    : 'bg-unohana-100 dark:bg-sumi-800 border border-usuzumi-200 dark:border-usuzumi-700 shadow-lg'
                }
        ${hoverEffect
                    ? 'transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:bg-unohana-100 dark:hover:bg-sumi-800/90 hover:border-ai-400/50 dark:hover:border-ai-400/50 hover:-translate-y-1'
                    : ''
                }
        ${className}
      `}
            {...props}
        >
            {children}
        </div>
    );
};
