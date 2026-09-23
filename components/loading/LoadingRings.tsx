"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface LoadingRingsProps {
  reducedMotion?: boolean;
  isExiting?: boolean;
}

const EASE_INSTITUTIONAL = [0.22, 1, 0.36, 1] as const;

export const LoadingRings: React.FC<LoadingRingsProps> = ({
  reducedMotion = false,
  isExiting = false,
}) => {
  // Reduced motion: Static, low-contrast hairline concentric rings with no rotation or traveling highlight
  if (reducedMotion) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-[240px] h-[240px] rounded-full border border-slate-400/[0.14]" />
        <div className="absolute w-[190px] h-[190px] rounded-full border border-[#635BFF]/[0.18]" />
        <div className="absolute w-[140px] h-[140px] rounded-full border border-slate-400/[0.10]" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
    >
      {/* =========================================================================
          LAYER 3 (OUTER ORBIT): Fine hairline ring — Period: 26s Clockwise
          Extremely low contrast (opacity 0.14), ultra-slow linear rotation
          ========================================================================= */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isExiting ? 0 : 0.14,
          rotate: isExiting ? 45 : 360,
        }}
        transition={{
          opacity: { duration: 0.8, delay: 0.3, ease: 'easeOut' },
          rotate: {
            duration: isExiting ? 0.4 : 26,
            repeat: isExiting ? 0 : Infinity,
            ease: isExiting ? EASE_INSTITUTIONAL : 'linear',
          },
        }}
        className="absolute w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] rounded-full flex items-center justify-center"
      >
        <svg className="w-full h-full" viewBox="0 0 260 260" fill="none">
          <circle
            cx="130"
            cy="130"
            r="120"
            stroke="#635BFF"
            strokeWidth="1"
            strokeDasharray="6 4"
            strokeOpacity="0.9"
          />
        </svg>
      </motion.div>

      {/* =========================================================================
          LAYER 2 (MIDDLE ORBIT): Period: 30s Counter-Clockwise
          Features the SINGLE subtle traveling highlight signal (Section 7)
          ========================================================================= */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isExiting ? 0 : 0.20,
          rotate: isExiting ? -45 : -360,
        }}
        transition={{
          opacity: { duration: 0.7, delay: 0.2, ease: 'easeOut' },
          rotate: {
            duration: isExiting ? 0.4 : 30,
            repeat: isExiting ? 0 : Infinity,
            ease: isExiting ? EASE_INSTITUTIONAL : 'linear',
          },
        }}
        className="absolute w-[190px] h-[190px] sm:w-[205px] sm:h-[205px] rounded-full flex items-center justify-center"
      >
        <svg className="w-full h-full" viewBox="0 0 205 205" fill="none">
          <circle
            cx="102.5"
            cy="102.5"
            r="96"
            stroke="#475569"
            strokeWidth="0.85"
            strokeOpacity="0.85"
          />
        </svg>

        {/* Section 7: Single subtle highlight traveling on the middle orbital line */}
        <div className="absolute top-[6px] left-1/2 -translate-x-1/2 flex items-center justify-center">
          <div className="w-[3.5px] h-[3.5px] rounded-full bg-[#635BFF] opacity-60" />
          <div className="absolute w-[8px] h-[8px] rounded-full bg-[#635BFF]/15 blur-[1px] pointer-events-none" />
        </div>
      </motion.div>

      {/* =========================================================================
          LAYER 1 (INNER ORBIT): Period: 20s Clockwise
          Subtlest inner horizon — Opacity 0.10, stroke 0.75px
          ========================================================================= */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isExiting ? 0 : 0.10,
          rotate: isExiting ? 45 : 360,
        }}
        transition={{
          opacity: { duration: 0.6, delay: 0.1, ease: 'easeOut' },
          rotate: {
            duration: isExiting ? 0.4 : 20,
            repeat: isExiting ? 0 : Infinity,
            ease: isExiting ? EASE_INSTITUTIONAL : 'linear',
          },
        }}
        className="absolute w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] rounded-full flex items-center justify-center"
      >
        <svg className="w-full h-full" viewBox="0 0 150 150" fill="none">
          <circle
            cx="75"
            cy="75"
            r="70"
            stroke="#635BFF"
            strokeWidth="0.75"
            strokeOpacity="0.75"
          />
        </svg>
      </motion.div>
    </div>
  );
};
