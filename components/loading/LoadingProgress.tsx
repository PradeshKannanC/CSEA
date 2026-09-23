"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface LoadingProgressProps {
  progress?: number;
  statusText?: string;
  reducedMotion?: boolean;
}

const EASE_INSTITUTIONAL = [0.22, 1, 0.36, 1] as const;

export const LoadingProgress: React.FC<LoadingProgressProps> = ({
  progress,
  statusText = 'Preparing your workspace',
  reducedMotion = false,
}) => {
  const isDeterminate = typeof progress === 'number';

  return (
    <div className="flex flex-col items-center justify-center space-y-2 select-none">
      {/* Section 14: Ultra-thin 1.5px hairline progress indicator (120-160px width) */}
      <div className="w-32 sm:w-36 h-[1.5px] bg-slate-200/80 rounded-full overflow-hidden relative">
        {isDeterminate ? (
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            transition={{
              duration: reducedMotion ? 0.05 : 0.4,
              ease: EASE_INSTITUTIONAL,
            }}
            className="h-full bg-[#635BFF] rounded-full"
          />
        ) : (
          !reducedMotion && (
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-[#635BFF] to-transparent"
            />
          )
        )}
      </div>

      {/* Section 15: Restrained, professional subtext */}
      {statusText && (
        <span className="text-[11px] font-medium tracking-wide text-slate-400">
          {statusText}
        </span>
      )}
    </div>
  );
};
