"use client";

import React from 'react';
import { CoinToken } from './CoinToken';

interface CoinIconProps {
  size?: number | string;
  className?: string;
  animated?: boolean;
}

export const CoinIcon: React.FC<CoinIconProps> = ({
  size = 20,
  className = '',
  animated = false,
}) => {
  const numSize = typeof size === 'string' ? parseInt(size, 10) || 20 : size;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${
        animated ? 'animate-bounce' : ''
      } ${className}`}
    >
      <CoinToken size={numSize} />
    </span>
  );
};
