"use client";

import confetti from "canvas-confetti";

export function fireConfetti(intensity: "small" | "big" = "small") {
  const colors = ["#FF375F", "#BF5AF2", "#64D2FF", "#FFD60A", "#30D158"];
  if (intensity === "big") {
    const duration = 1400;
    const end = Date.now() + duration;
    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  } else {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.65 },
      colors,
      scalar: 0.9,
    });
  }
}
