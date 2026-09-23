import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "420px",
      },
      colors: {
        background: "#F7F8FC",
        foreground: "#111827",
        ventura: {
          bg: "#F7F8FC",
          dark: "#111827",
          darker: "#0B0F19",
          slate: "#0F172A",
          surface: "#FFFFFF",
          purple: {
            DEFAULT: "#635BFF",
            hover: "#5046E5",
            light: "#F0EEFF",
            soft: "#E0DEFF",
            dark: "#4338CA",
          },
          teal: {
            DEFAULT: "#22C7A9",
            light: "#E6FBF5",
            dark: "#0F9D82",
          },
          gold: {
            DEFAULT: "#F5B942",
            light: "#FFF8E6",
            border: "#FDE68A",
            dark: "#D97706",
          },
          border: "#E5E7EB",
          muted: "#6B7280",
          subtle: "#94A3B8",
          success: "#16A34A",
          error: "#DC2626",
          warning: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-manrope)", "sans-serif"],
      },
      borderRadius: {
        "xl": "16px",
        "2xl": "20px",
        "3xl": "24px",
        "4xl": "28px",
      },
      boxShadow: {
        "ventura-sm": "0 2px 8px rgba(17, 24, 39, 0.04)",
        "ventura-card": "0 4px 20px rgba(17, 24, 39, 0.04), 0 1px 3px rgba(17, 24, 39, 0.02)",
        "ventura-elevated": "0 12px 36px rgba(17, 24, 39, 0.08), 0 4px 12px rgba(17, 24, 39, 0.03)",
        "ventura-purple": "0 8px 24px rgba(99, 91, 255, 0.25)",
        "ventura-gold": "0 8px 24px rgba(245, 185, 66, 0.25)",
        "ventura-teal": "0 8px 24px rgba(34, 199, 169, 0.25)",
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
