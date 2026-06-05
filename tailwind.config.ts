import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Accent — brighter indigo so it pops on dark surfaces.
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        // Dark dashboard surfaces.
        surface: {
          DEFAULT: "#0a0e17", // app background
          base: "#0a0e17",
          raised: "#0f1521", // slightly raised panels
          card: "#141b2b", // cards / sidebar
          input: "#0f1626", // form fields
          border: "#232c40", // hairline borders
          hover: "#1b2333", // hover / table stripes
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.5), 0 1px 2px -1px rgb(0 0 0 / 0.4)",
        "card-md": "0 4px 12px -2px rgb(0 0 0 / 0.5), 0 2px 6px -2px rgb(0 0 0 / 0.4)",
        "card-lg": "0 12px 28px -6px rgb(0 0 0 / 0.6), 0 6px 12px -6px rgb(0 0 0 / 0.4)",
        glow: "0 0 0 1px rgb(99 102 241 / 0.25), 0 6px 20px -6px rgb(99 102 241 / 0.45)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
