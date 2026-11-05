import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFAF3",
        foreground: "#171717",
        card: {
          DEFAULT: "#FFF2DB",
          foreground: "#171717",
        },
        border: "#E8DFD1",
        muted: {
          DEFAULT: "#FFE5BF",
          foreground: "#78716C",
        },
        primary: {
          DEFAULT: "#171717",
          foreground: "#FFFAF3",
        },
        accent: {
          DEFAULT: "#F62440",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#16A34A",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#F62440",
          foreground: "#FFFFFF",
        },
        // Color Hunt Palette tokens
        palette: {
          cream: "#FFFAF3",
          sand: "#FFF2DB",
          tan: "#FFE5BF",
          red: "#F62440",
          border: "#E8DFD1",
          dark: "#171717",
          muted: "#78716C",
          green: "#16A34A",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
