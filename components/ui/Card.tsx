import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'light' | 'dark' | 'glass' | 'subtle';
  hoverEffect?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'light',
  hoverEffect = false,
  padding = 'lg',
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  }[padding];

  const variantStyles = {
    light:
      'bg-white text-slate-900 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]',
    dark:
      'bg-[#111827] text-white border border-slate-800/80 shadow-[0_12px_36px_rgba(0,0,0,0.25)]',
    glass:
      'bg-[#111827]/80 backdrop-blur-xl text-white border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.37)]',
    subtle:
      'bg-slate-50/70 text-slate-900 border border-slate-200/60',
  }[variant];

  const hoverStyles = hoverEffect
    ? 'transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] hover:-translate-y-1'
    : '';

  return (
    <div
      className={`rounded-3xl ${variantStyles} ${paddingStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
