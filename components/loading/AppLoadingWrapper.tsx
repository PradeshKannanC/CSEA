"use client";

import React, { useState, useEffect } from 'react';
import { AppLoadingScreen } from './AppLoadingScreen';
import { RouteTransitionLoader } from './RouteTransitionLoader';

export const AppLoadingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showInitialLoader, setShowInitialLoader] = useState(true);

  useEffect(() => {
    // Check if initial loader already ran in this tab session
    try {
      const alreadyLoaded = sessionStorage.getItem('tce_csea_pnp_loaded');
      if (alreadyLoaded) {
        setShowInitialLoader(false);
      }
    } catch (e) {
      console.warn("Storage access restricted", e);
    }
  }, []);

  const handleLoadingComplete = () => {
    setShowInitialLoader(false);
    try {
      sessionStorage.setItem('tce_csea_pnp_loaded', 'true');
    } catch (e) {
      console.warn("Could not save session flag", e);
    }
  };

  return (
    <>
      {showInitialLoader && (
        <AppLoadingScreen onComplete={handleLoadingComplete} />
      )}
      <RouteTransitionLoader />
      {children}
    </>
  );
};
