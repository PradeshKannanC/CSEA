"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CoinToken } from './CoinToken';
import { EASE_PREMIUM } from '@/lib/motion';

interface CoinFlightAnimationProps {
  isActive: boolean;
  onComplete?: () => void;
  amount?: number;
}

interface FlightParticle {
  id: number;
  delay: number;
  startX: number;
  midX: number;
  endX: number;
  endY: number;
  scale: number;
  tokenSize: 'sm' | 'md' | 'lg';
}

const PARTICLES: FlightParticle[] = [
  { id: 1, delay: 0, startX: -10, midX: -36, endX: -20, endY: -130, scale: 1.05, tokenSize: 'md' },
  { id: 2, delay: 0.06, startX: 5, midX: 28, endX: 18, endY: -145, scale: 0.95, tokenSize: 'sm' },
  { id: 3, delay: 0.12, startX: -2, midX: -15, endX: 0, endY: -160, scale: 1.15, tokenSize: 'lg' },
  { id: 4, delay: 0.18, startX: 12, midX: 42, endX: 30, endY: -135, scale: 0.9, tokenSize: 'sm' },
];

export const CoinFlightAnimation: React.FC<CoinFlightAnimationProps> = ({
  isActive,
  onComplete,
  amount,
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, reducedMotion ? 50 : 850);
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete, reducedMotion]);

  if (!isActive || reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center select-none"
    >
      {/* Background Soft Glow Pulse */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.4, 0], scale: [0.6, 1.4, 1.8] }}
        transition={{ duration: 0.8, ease: EASE_PREMIUM }}
        className="absolute w-44 h-44 rounded-full bg-radial from-[#F5B942]/25 to-transparent blur-xl pointer-events-none"
      />

      {/* Curved Multi-Token Flight Stream */}
      <div className="relative flex items-center justify-center">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            initial={{
              opacity: 0,
              scale: 0.4,
              x: p.startX,
              y: 20,
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.4, p.scale, p.scale * 0.9, 0.4],
              x: [p.startX, p.midX, p.endX],
              y: [20, p.endY * 0.4, p.endY],
            }}
            transition={{
              duration: 0.75,
              delay: p.delay,
              ease: EASE_PREMIUM,
              times: [0, 0.25, 0.75, 1],
            }}
            className="absolute flex items-center justify-center"
          >
            <CoinToken size={p.tokenSize} showGlow />
          </motion.div>
        ))}

        {/* Soft Dissipation Ring at Flight Destination */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, y: -145 }}
          animate={{ opacity: [0, 0.6, 0], scale: [0.3, 1.3, 1.7], y: -145 }}
          transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
          className="absolute w-20 h-20 rounded-full border border-[#F5B942]/50 bg-[#F5B942]/10 pointer-events-none"
        />

        {/* Amount Badge floating upward with easing */}
        {amount && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, -35, -55], scale: [0.9, 1, 0.95] }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE_PREMIUM }}
            className="absolute z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/95 text-white border border-amber-500/40 shadow-xl backdrop-blur-sm"
          >
            <CoinToken size="xs" />
            <span className="font-display font-black text-xs text-amber-300 tracking-wider">
              -{amount} COINS
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
