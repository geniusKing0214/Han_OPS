import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "rgba(20, 22, 28, 0.1)",
        background: "#F7F7F5",
        foreground: "#14161C",
        surface: {
          DEFAULT: "#FFFFFF",
          hover: "#EEF0F3",
        },
        muted: {
          DEFAULT: "#EEF0F3",
          foreground: "#5B6272",
        },
        accent: {
          DEFAULT: "#B8863E",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#5B6272",
          foreground: "#14161C",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#14161C",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
