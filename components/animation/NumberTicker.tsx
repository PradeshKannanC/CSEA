"use client";

import React, { useEffect, useState, useRef } from 'react';
import { EASE_PREMIUM } from '@/lib/motion';

interface NumberTickerProps {
  value: number;
  initialValue?: number;
  duration?: number; // in milliseconds
  className?: string;
  prefix?: string;
  suffix?: string;
  formatNumber?: (val: number) => string;
}

// Cubic bezier evaluator for [0.22, 1, 0.36, 1]
function cubicBezier(t: number, p1x = 0.22, p1y = 1, p2x = 0.36, p2y = 1): number {
  // Simple approximation for smooth ease-out curves
  // Since p1y=1 and p2y=1, it settles smoothly at 1
  const u = 1 - t;
  return 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t;
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  initialValue,
  duration = 750,
  className = '',
  prefix = '',
  suffix = '',
  formatNumber,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(initialValue ?? value);
  const prevValueRef = useRef<number>(initialValue ?? value);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startVal = prevValueRef.current;
    const endVal = value;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = cubicBezier(progress, ...EASE_PREMIUM);

      const current = Math.round(startVal + (endVal - startVal) * easedProgress);
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
      }
    };

    animFrameRef.current = requestAnimationFrame(updateCounter);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, duration]);

  const formatted = formatNumber ? formatNumber(displayValue) : displayValue.toString();

  return (
    <span className={`tabular-nums inline-block font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
