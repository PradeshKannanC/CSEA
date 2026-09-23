"use client";

import React from 'react';

export interface CoinTokenProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showGlow?: boolean;
}

const SIZE_MAP: Record<string, number> = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 32,
  xl: 44,
};

export const CoinToken: React.FC<CoinTokenProps> = ({
  size = 'md',
  className = '',
  showGlow = false,
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 24;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      {/* Optional ambient soft glow */}
      {showGlow && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#F5B942]/30 blur-sm scale-125 pointer-events-none"
        />
      )}

      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_2px_4px_rgba(180,83,9,0.22)]"
      >
        <defs>
          {/* Outer Rim Metallic Gradient */}
          <linearGradient id="pnp-coin-rim" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="35%" stopColor="#F5B942" />
            <stop offset="70%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>

          {/* Inner Face Radiant Gradient */}
          <radialGradient id="pnp-coin-face" cx="38%" cy="32%" r="62%" fx="38%" fy="32%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="45%" stopColor="#FEF3C7" />
            <stop offset="85%" stopColor="#F5B942" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>

          {/* Specular Highlight Sheen */}
          <linearGradient id="pnp-coin-sheen" x1="6" y1="6" x2="30" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Inner Crest Emboss Gradient */}
          <linearGradient id="pnp-coin-crest" x1="12" y1="10" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
        </defs>

        {/* Outer Coin Edge / Bevel */}
        <circle cx="18" cy="18" r="17" fill="url(#pnp-coin-rim)" stroke="#B45309" strokeWidth="0.8" />

        {/* Inner Recessed Face */}
        <circle cx="18" cy="18" r="14.2" fill="url(#pnp-coin-face)" stroke="#D97706" strokeWidth="0.8" />

        {/* Precision Micro Beaded Track */}
        <circle
          cx="18"
          cy="18"
          r="12.2"
          stroke="#B45309"
          strokeWidth="0.75"
          strokeDasharray="1.2 1.4"
          strokeOpacity="0.65"
          fill="none"
        />

        {/* Institutional CSEA Geometric Star / Spark Crest */}
        {/* Central Star Diamond */}
        <path
          d="M18 9.5L19.8 15.2L25.5 17L19.8 18.8L18 24.5L16.2 18.8L10.5 17L16.2 15.2Z"
          fill="url(#pnp-coin-crest)"
          opacity="0.92"
        />

        {/* Center Seed Dot */}
        <circle cx="18" cy="17" r="1.4" fill="#FEF3C7" />

        {/* Upper Specular Crescent Sheen */}
        <path
          d="M8 16C8.5 11 12.5 7.5 18 7.5C23.5 7.5 27.5 11 28 16C24.5 12 21 10.5 18 10.5C15 10.5 11.5 12 8 16Z"
          fill="url(#pnp-coin-sheen)"
        />
      </svg>
    </div>
  );
};
