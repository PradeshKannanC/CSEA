"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export const RouteTransitionLoader: React.FC = () => {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Trigger a sleek, brief 300ms top progress line & micro-logo indicator on route change
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          key="route-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        >
          {/* Top glowing progress line */}
          <div className="h-0.5 w-full bg-slate-100 overflow-hidden relative">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="h-full w-2/3 bg-gradient-to-r from-[#635BFF] via-[#22C7A9] to-[#F5B942]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
