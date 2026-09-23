"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface VenturaLogoProps {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  showSubtitle?: boolean;
}

export const VenturaLogo: React.FC<VenturaLogoProps> = ({
  theme = 'light',
  isAdmin = false,
  size = 'md',
  href = '/',
  showSubtitle = true,
}) => {
  const iconClass =
    size === 'sm'
      ? 'w-7 h-7 sm:w-8 sm:h-8'
      : size === 'lg'
      ? 'w-10 h-10 sm:w-12 sm:h-12'
      : 'w-8 h-8 sm:w-[42px] sm:h-[42px]';

  const content = (
    <div className="flex items-center gap-2 sm:gap-3 select-none group min-w-0">
      {/* Official TCE CSEA Emblem Asset - Aspect Ratio strictly preserved */}
      <div
        className={`relative shrink-0 rounded-full bg-white p-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-slate-200/80 transition-transform duration-200 group-hover:scale-105 ${iconClass}`}
      >
        <Image
          src="/branding/tce-csea-logo.png"
          alt="TCE CSEA"
          width={48}
          height={48}
          priority
          className="object-contain rounded-full w-full h-full"
        />
      </div>

      {/* Brand & Platform Wordmark matching official specification */}
      <div className="flex flex-col justify-center text-left min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            className={`font-display font-black tracking-tight leading-none truncate ${
              theme === 'dark' ? 'text-white' : 'text-[#111827]'
            } ${
              size === 'sm'
                ? 'text-[11px] sm:text-sm'
                : size === 'lg'
                ? 'text-base sm:text-xl'
                : 'text-xs sm:text-base md:text-lg'
            }`}
          >
            PITCH AND PROSPER
          </span>

          {isAdmin && (
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest px-1 sm:px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
              ADMIN
            </span>
          )}
        </div>

        {showSubtitle && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest leading-none ${
                theme === 'dark' ? 'text-indigo-400' : 'text-[#635BFF]'
              }`}
            >
              by CSEA
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline leading-none">
              • Idea Investment Arena
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] rounded-xl"
        aria-label="PITCH AND PROSPER by CSEA Home"
      >
        {content}
      </Link>
    );
  }

  return content;
};
