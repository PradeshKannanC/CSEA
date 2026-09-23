"use client";

import React, { useEffect } from 'react';
import Image from 'next/image';
import { RotateCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client exceptions without exposing stack traces to UI
    console.error("Global application error captured:", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FC] px-4 text-center font-sans antialiased select-none">
        <div className="bg-white rounded-3xl p-10 sm:p-12 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] max-w-md w-full flex flex-col items-center">
          {/* Official TCE CSEA Emblem */}
          <div className="w-20 h-20 rounded-full bg-white p-1 border border-slate-200 shadow-sm mb-6 flex items-center justify-center">
            <Image
              src="/branding/tce-csea-logo.png"
              alt="TCE CSEA"
              width={80}
              height={80}
              className="rounded-full object-contain"
            />
          </div>

          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#635BFF] mb-2">
            TCE CSEA · PITCH AND PROSPER
          </div>

          <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
            Something went wrong.
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-8">
            We couldn&apos;t complete that request. Please try again.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#635BFF] hover:bg-[#5046E5] text-white font-bold text-xs sm:text-sm shadow-[0_4px_16px_rgba(99,91,255,0.25)] transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Try Again</span>
            </button>

            <a
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all active:scale-95"
            >
              <Home className="w-4 h-4" />
              <span>Go Home</span>
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
