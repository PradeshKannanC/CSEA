import confetti from 'canvas-confetti';

export const triggerCoinCelebration = () => {
  // Gold and purple subtle confetti burst
  confetti({
    particleCount: 45,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#F5B942', '#635BFF', '#22C7A9', '#FEF3C7'],
    disableForReducedMotion: true,
  });
};

export const triggerChampionshipReveal = () => {
  // Grand reveal confetti
  const duration = 2.5 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#F5B942', '#635BFF', '#22C7A9'],
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#F5B942', '#635BFF', '#22C7A9'],
      disableForReducedMotion: true,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};
