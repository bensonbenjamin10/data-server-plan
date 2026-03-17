/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        neutral: "var(--color-neutral)",
        "neutral-dark": "var(--color-neutral-dark)",
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
      },
      fontFamily: {
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        display: ["DM Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
