"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const NetworkStatusToast: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showRestoredNotice, setShowRestoredNotice] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestoredNotice(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleManualRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      if (typeof window !== 'undefined' && navigator.onLine) {
        setIsOnline(true);
        setShowRestoredNotice(true);
        setTimeout(() => setShowRestoredNotice(false), 3000);
      }
    }, 600);
  };

  return (
    <aside aria-label="Network Status" className="fixed top-4 right-4 z-50 pointer-events-none select-none">
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-toast"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto bg-[#111827] text-white border border-rose-500/40 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 max-w-sm"
            role="alert"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-bold text-white">Connection lost</div>
              <div className="text-[11px] text-slate-400">Some information may be outdated.</div>
            </div>
            <button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </motion.div>
        )}

        {isOnline && showRestoredNotice && (
          <motion.div
            key="online-toast"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto bg-[#111827] text-white border border-emerald-500/40 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3"
            role="status"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-[#22C7A9] flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">Connection restored</div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
