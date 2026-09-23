"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'teal';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      pill = true,
      isLoading = false,
      disabled,
      icon,
      iconRight,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles =
      'relative inline-flex items-center justify-center font-medium transition-all duration-200 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

    // Sizes
    const sizeStyles = {
      sm: 'text-xs px-3.5 py-1.5 gap-1.5',
      md: 'text-sm px-5 py-2.5 gap-2 font-semibold',
      lg: 'text-base px-6 py-3.5 gap-2.5 font-semibold',
    }[size];

    // Radius
    const radiusStyles = pill ? 'rounded-full' : 'rounded-2xl';

    // Variant styles
    const variantStyles = {
      primary:
        'bg-[#635BFF] text-white hover:bg-[#5046E5] active:bg-[#4338CA] shadow-[0_4px_14px_rgba(99,91,255,0.28)] hover:shadow-[0_6px_20px_rgba(99,91,255,0.36)] focus-visible:ring-[#635BFF]',
      secondary:
        'bg-white text-slate-800 border border-slate-200/80 hover:bg-slate-50 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-visible:ring-slate-300',
      dark:
        'bg-[#111827] text-white hover:bg-black active:bg-slate-900 shadow-[0_4px_14px_rgba(17,24,39,0.2)] focus-visible:ring-slate-700',
      outline:
        'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-100/60 focus-visible:ring-slate-400',
      ghost:
        'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 focus-visible:ring-slate-300',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 shadow-[0_4px_14px_rgba(225,29,72,0.28)] focus-visible:ring-rose-500',
      teal:
        'bg-[#22C7A9] text-white hover:bg-[#1bb397] shadow-[0_4px_14px_rgba(34,199,169,0.28)] focus-visible:ring-[#22C7A9]',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${radiusStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        <span>{children}</span>
        {!isLoading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
