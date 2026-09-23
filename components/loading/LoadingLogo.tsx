"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface LoadingLogoProps {
  size?: number;
  reducedMotion?: boolean;
}

// Institutional easing: cubic-bezier(0.22, 1, 0.36, 1) — gentle settling with zero bounce or overshoot
const EASE_INSTITUTIONAL = [0.22, 1, 0.36, 1] as const;

export const LoadingLogo: React.FC<LoadingLogoProps> = ({
  size = 76,
  reducedMotion = false,
}) => {
  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Soft, static ambient radial backlight behind logo (0.05 opacity, large blur, no pulsing) */}
      <div
        aria-hidden="true"
        className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-[#635BFF]/[0.05] blur-3xl pointer-events-none"
      />

      {/* Official Emblem Container: Enters once, settles gently into position with zero bounce */}
      <motion.div
        initial={
          reducedMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.97, y: 4 }
        }
        animate={
          reducedMotion
            ? { opacity: 1 }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={{
          duration: 0.7,
          ease: EASE_INSTITUTIONAL,
        }}
        className="relative z-10 p-1 rounded-full bg-white shadow-[0_4px_24px_rgba(17,24,39,0.04)] border border-slate-200/60 flex items-center justify-center shrink-0"
        style={{ width: size + 10, height: size + 10 }}
      >
        <div
          className="relative rounded-full overflow-hidden"
          style={{ width: size, height: size }}
        >
          <Image
            src="/branding/tce-csea-logo.png"
            alt="TCE CSEA"
            width={size}
            height={size}
            priority
            className="object-contain w-full h-full rounded-full pointer-events-none"
          />
        </div>
      </motion.div>
    </div>
  );
};
