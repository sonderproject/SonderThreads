"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  // Read the real state after mount rather than during the initial render,
  // since the server has no way to know what the blocking script in
  // app/layout.tsx already set on <html> before hydration.
  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="rounded px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
    >
      {isLight ? "☾" : "☀"}
    </button>
  );
}
