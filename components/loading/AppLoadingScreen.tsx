"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingLogo } from './LoadingLogo';
import { LoadingRings } from './LoadingRings';
import { LoadingProgress } from './LoadingProgress';

interface AppLoadingScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

// Institutional easing: cubic-bezier(0.22, 1, 0.36, 1) — smooth, controlled, no bounce
const EASE_INSTITUTIONAL = [0.22, 1, 0.36, 1] as const;

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  onComplete,
  minDuration = 850,
}) => {
  const [progress, setProgress] = useState(20);
  const [isDone, setIsDone] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check reduced motion preference
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
    }

    // Gentle staged progress without artificially delaying application readiness
    const timers: NodeJS.Timeout[] = [];

    // Stage 1: Initial progress
    const t1 = setTimeout(() => {
      setProgress(60);
    }, Math.min(300, minDuration * 0.35));
    timers.push(t1);

    // Stage 2: Near completion
    const t2 = setTimeout(() => {
      setProgress(100);
    }, Math.min(650, minDuration * 0.75));
    timers.push(t2);

    // Stage 3: Section 16 completion transition (progress completes -> orbits subtly slow -> screen fades out)
    const t3 = setTimeout(() => {
      setIsExiting(true);
      const finishTimer = setTimeout(() => {
        setIsDone(true);
        if (onComplete) onComplete();
      }, 380);
      timers.push(finishTimer);
    }, Math.max(minDuration, 850));
    timers.push(t3);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [onComplete, minDuration]);

  return (
    <AnimatePresence>
      {!isDone && (
        <motion.div
          key="app-loader"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.38, ease: EASE_INSTITUTIONAL },
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F7F8FC] px-4 select-none overflow-hidden"
          role="status"
          aria-live="polite"
        >
          {/* Section 2: Clean, breathable brand opening composition — Generous whitespace, zero heavy cards */}
          <div className="flex flex-col items-center justify-center max-w-sm w-full -mt-4">
            {/* Section 4 & 5: Center TCE CSEA Logo + Concentric Hairline Orbitals */}
            <div className="relative flex items-center justify-center w-[250px] h-[250px] sm:w-[270px] sm:h-[270px] mb-6">
              <LoadingRings reducedMotion={reducedMotion} isExiting={isExiting} />
              <LoadingLogo size={76} reducedMotion={reducedMotion} />
            </div>

            {/* Section 2, 10, 11, 12, 13: Exact Brand Hierarchy with small stagger */}
            <div className="text-center space-y-1 mb-7 flex flex-col items-center">
              {/* Section 12: CSEA — Revealed at 500ms, uppercase, medium weight, tracked */}
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.5, ease: EASE_INSTITUTIONAL }}
                className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                CSEA
              </motion.div>

              {/* Section 11: PITCH AND PROSPER — Revealed at 650ms, Manrope, weight 700, primary text */}
              <motion.h1
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.65, ease: EASE_INSTITUTIONAL }}
                className="font-sans font-bold tracking-tight text-xl sm:text-2xl text-[#111827] leading-snug"
              >
                PITCH AND PROSPER
              </motion.h1>

              {/* Section 13: LEARN · BUILD · GROW — Revealed at 800ms, quietest element, muted tagline */}
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.8, ease: EASE_INSTITUTIONAL }}
                className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.25em] text-slate-400 pt-0.5"
              >
                LEARN · BUILD · GROW
              </motion.div>
            </div>

            {/* Section 14 & 15: Hairline progress indicator — Revealed at 900ms */}
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.9, ease: EASE_INSTITUTIONAL }}
            >
              <LoadingProgress
                progress={progress}
                statusText="Preparing your workspace"
                reducedMotion={reducedMotion}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
