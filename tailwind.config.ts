import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0a",
          raised: "#121212",
          hover: "#1a1a1a",
        },
        border: {
          DEFAULT: "#262626",
          subtle: "#1c1c1c",
        },
        text: {
          DEFAULT: "#e8e8e6",
          muted: "#8a8a86",
          faint: "#5c5c58",
        },
        accent: {
          DEFAULT: "#5eead4",
          dim: "#2dd4bf",
        },
        danger: "#f87171",
        warn: "#fbbf24",
      },
      fontFamily: {
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
