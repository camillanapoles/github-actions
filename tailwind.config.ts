import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07080c",
          900: "#0b0e14",
          800: "#10141c",
          700: "#161c27",
          600: "#1c2433",
        },
        line: "#243044",
        mute: "#8b95a8",
        paper: "#e8edf5",
        runtime: "#3dff9a",
        object: "#6ea8ff",
        agent: "#ffb020",
        cache: "#c084fc",
        danger: "#ff5d73",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(61, 255, 154, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
