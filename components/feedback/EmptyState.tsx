"use client";

import React from 'react';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-xs">
        {icon}
      </div>

      <h3 className="font-display font-bold text-lg sm:text-xl text-slate-900 mb-1.5 tracking-tight">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
        {description}
      </p>

      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <a href={actionHref}>
            <Button variant="primary" size="sm" pill>
              {actionLabel}
            </Button>
          </a>
        ) : (
          <Button variant="primary" size="sm" pill onClick={onAction}>
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
};
