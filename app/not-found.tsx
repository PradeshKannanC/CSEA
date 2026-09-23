"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FC] px-4 text-center select-none">
      <div className="bg-white rounded-3xl p-10 sm:p-12 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] max-w-md w-full flex flex-col items-center">
        {/* TCE CSEA Emblem */}
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

        <div className="font-display font-black text-6xl text-slate-200 tracking-tight leading-none mb-1">
          404
        </div>

        <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
          This page doesn&apos;t exist.
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-8">
          The page you&apos;re looking for may have moved or no longer exists.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <Link href="/dashboard" className="w-full">
            <Button
              variant="primary"
              size="md"
              pill
              className="w-full justify-center"
              icon={<Home className="w-4 h-4" />}
            >
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/" className="w-full">
            <Button
              variant="secondary"
              size="md"
              pill
              className="w-full justify-center"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
