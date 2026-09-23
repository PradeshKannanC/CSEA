"use client";

import React from 'react';
import { LoadingRings } from '@/components/loading/LoadingRings';
import { LoadingLogo } from '@/components/loading/LoadingLogo';
import { LoadingProgress } from '@/components/loading/LoadingProgress';

interface VenturaLoadingScreenProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
}

export const VenturaLoadingScreen: React.FC<VenturaLoadingScreenProps> = ({
  message = "PITCH AND PROSPER",
  subtext = "Preparing your workspace",
  fullScreen = true,
}) => {
  return (
    <div
      className={`${
        fullScreen ? 'fixed inset-0 z-50' : 'w-full py-16'
      } flex flex-col items-center justify-center bg-[#F7F8FC] select-none px-6 text-center`}
      role="status"
      aria-live="polite"
    >
      {/* Center Logo with Hairline Concentric Orbital System */}
      <div className="relative flex items-center justify-center w-[230px] h-[230px] sm:w-[250px] sm:h-[250px] mb-5">
        <LoadingRings />
        <LoadingLogo size={68} />
      </div>

      {/* Brand & Context Title */}
      <div className="text-center space-y-1 mb-5 flex flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          CSEA
        </span>
        <h2 className="font-sans font-bold tracking-tight text-xl sm:text-2xl text-[#111827]">
          {message}
        </h2>
        <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.25em] text-slate-400 pt-0.5">
          LEARN · BUILD · GROW
        </span>
      </div>

      {/* Hairline Indicator */}
      <LoadingProgress statusText={subtext} />
    </div>
  );
};
