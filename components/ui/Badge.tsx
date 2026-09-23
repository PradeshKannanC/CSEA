import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'live-purple' | 'live-teal' | 'track' | 'tag' | 'draft' | 'admin' | 'shield' | 'gold' | 'outline' | 'slate';
  size?: 'xs' | 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'track',
  size = 'sm',
  icon,
  className = '',
  dot = false,
}) => {
  const sizeStyles = {
    xs: 'text-[10px] px-2 py-0.5 font-semibold tracking-wider',
    sm: 'text-xs px-3 py-1 font-semibold tracking-wider',
    md: 'text-xs px-3.5 py-1.5 font-bold tracking-wider',
  }[size];

  const variantStyles = {
    'live-purple':
      'bg-indigo-50 text-[#635BFF] border border-indigo-100/80 uppercase',
    'live-teal':
      'bg-[#E6FBF5] text-[#0F9D82] border border-[#22C7A9]/20 uppercase',
    'track':
      'bg-slate-100 text-slate-600 font-semibold tracking-wider uppercase text-[11px]',
    'tag':
      'bg-[#E6FBF5] text-[#14B8A6] font-bold tracking-wider uppercase text-[11px] border border-[#22C7A9]/20',
    'draft':
      'bg-amber-50 text-amber-800 border border-amber-200/80 uppercase',
    'admin':
      'bg-rose-50 text-rose-700 border border-rose-200 uppercase font-bold text-[10px]',
    'shield':
      'bg-[#E6FBF5]/80 text-[#0F9D82] border border-[#22C7A9]/30 uppercase font-semibold',
    'gold':
      'bg-[#FFFBEB] text-amber-800 border border-amber-200/80 uppercase font-bold',
    'outline':
      'bg-transparent text-slate-600 border border-slate-200 uppercase',
    'slate':
      'bg-slate-800 text-slate-200 border border-slate-700 uppercase font-medium',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full select-none ${sizeStyles} ${variantStyles} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            variant.includes('purple')
              ? 'bg-[#635BFF] animate-pulse'
              : variant.includes('teal') || variant === 'shield'
              ? 'bg-[#22C7A9] animate-pulse'
              : variant === 'admin'
              ? 'bg-rose-500 animate-pulse'
              : variant === 'draft'
              ? 'bg-amber-500'
              : 'bg-current'
          }`}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
