"use client";

import { useReducedMotion } from "motion/react";

/**
 * CSS-only aurora background — always visible regardless of GPU/WebGL support.
 * Layer this beneath ShaderCanvas for guaranteed dramatic effect.
 */
export function AuroraBackground() {
  const prefersReduced = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden" aria-hidden>
      <div
        className="absolute -inset-[10%]"
        style={{
          backgroundImage: [
            // Dark mask — matches the page base color
            "repeating-linear-gradient(100deg,#0d0e12 0%,#0d0e12 7%,transparent 10%,transparent 12%,#0d0e12 16%)",
            // Aurora colors: indigo → lavender → violet → soft blue → deep indigo
            "repeating-linear-gradient(100deg,#4f46e5 10%,#818cf8 15%,#7c3aed 20%,#a5b4fc 25%,#4338ca 30%)",
          ].join(", "),
          backgroundSize: "300%, 200%",
          backgroundPosition: "50% 50%, 50% 50%",
          filter: "blur(16px)",
          opacity: 0.65,
          animation: prefersReduced ? "none" : "aurora 22s linear infinite",
        }}
      />
      {/* Second pass with offset phase — creates depth */}
      <div
        className="absolute -inset-[10%]"
        style={{
          backgroundImage: [
            "repeating-linear-gradient(100deg,#0d0e12 0%,#0d0e12 7%,transparent 10%,transparent 12%,#0d0e12 16%)",
            "repeating-linear-gradient(100deg,#7c3aed 10%,#4f46e5 15%,#a5b4fc 20%,#818cf8 25%,#6366f1 30%)",
          ].join(", "),
          backgroundSize: "200%, 150%",
          backgroundPosition: "80% 80%, 80% 80%",
          filter: "blur(20px)",
          opacity: 0.35,
          mixBlendMode: "screen",
          animation: prefersReduced ? "none" : "aurora 28s linear infinite reverse",
        }}
      />
    </div>
  );
}
