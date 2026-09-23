/**
 * PITCH AND PROSPER by CSEA - Motion Design System
 * Defines standard easing curves, durations, and spring configurations
 * to ensure consistent, premium, and institutional physics across the platform.
 */

// Premium Cubic-Bezier Curves
export const EASE_PREMIUM: [number, number, number, number] = [0.22, 1, 0.36, 1]; // Smooth ease-out with soft settle
export const EASE_SMOOTH_DECEL: [number, number, number, number] = [0, 0, 0.2, 1]; // Fluid deceleration
export const EASE_ORGANIC: [number, number, number, number] = [0.4, 0, 0.2, 1]; // Natural organic curve
export const EASE_IN_OUT_PREMIUM: [number, number, number, number] = [0.65, 0, 0.35, 1];

// Duration Tiers (in seconds for Framer Motion)
export const DURATION = {
  INSTANT: 0.1,
  FAST: 0.2,
  STANDARD: 0.35,
  EMPHASIS: 0.6,
  SIGNATURE: 0.85,
  EXTENDED: 1.2,
} as const;

// Orbital System Constants
export const ORBITAL_CONFIG = {
  INNER: {
    radius: 68, // px
    period: 28, // seconds (clockwise)
    nodeColor: '#22C7A9', // Emerald / Teal
    strokeColor: 'rgba(34, 199, 169, 0.35)',
    entranceDelay: 0.15,
  },
  MIDDLE: {
    radius: 88, // px
    period: -17, // seconds (counter-clockwise)
    nodeColor: '#F5B942', // Amber / Gold
    strokeColor: 'rgba(245, 185, 66, 0.35)',
    entranceDelay: 0.35,
  },
  OUTER: {
    radius: 112, // px
    period: 24, // seconds (clockwise)
    nodeColor: '#635BFF', // Indigo / Brand
    strokeColor: 'rgba(99, 91, 255, 0.3)',
    entranceDelay: 0.55,
  },
} as const;

// Accessible Animation Variants (Collapse cleanly when reduced-motion is preferred)
export const createSafeVariants = (reducedMotion: boolean) => ({
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reducedMotion ? 0.05 : DURATION.STANDARD, ease: EASE_PREMIUM },
  },
  cardEntrance: {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reducedMotion ? 0.05 : DURATION.STANDARD, ease: EASE_PREMIUM },
  },
  modalWindow: {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 },
    transition: { duration: reducedMotion ? 0.05 : DURATION.STANDARD, ease: EASE_PREMIUM },
  },
});
