"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Draws its children at a fixed design width (like a real screen) and scales them
 * down to fit the space, so the app replica keeps its real proportions at any size.
 */
export function ScaleFrame({ width, height, className = "", children }: { width: number; height: number; className?: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / width);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={box} className={`relative overflow-hidden ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <div
        className="absolute left-0 top-0 origin-top-left transition-opacity duration-500"
        style={{ width, height, transform: `scale(${scale ?? 0.5})`, opacity: scale === null ? 0 : 1 }}
        aria-hidden
        inert
      >
        {children}
      </div>
    </div>
  );
}
