"use client";

import { useEffect, useState } from "react";

// No stored choice = follow the system setting. A pick sets data-theme on <html>.
function currentlyDark() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  // Read the real state after mount rather than during the initial render,
  // since the server has no way to know what the blocking script in
  // app/layout.tsx already set on <html> before hydration.
  useEffect(() => {
    setIsDark(currentlyDark());
  }, []);

  function toggle() {
    const next = currentlyDark() ? "light" : "dark";
    setIsDark(next === "dark");
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
  }

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
