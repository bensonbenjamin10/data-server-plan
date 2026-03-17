/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        success: "var(--color-success)",
        "success-light": "var(--color-success-light)",
        neutral: "var(--color-neutral)",
        "neutral-dark": "var(--color-neutral-dark)",
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-hover": "var(--color-surface-hover)",
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        error: "var(--color-error)",
        warning: "var(--color-warning)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        card: "var(--shadow-card)",
        dropdown: "var(--shadow-dropdown)",
      },
      ringColor: {
        DEFAULT: "var(--ring-color)",
      },
    },
  },
  plugins: [],
};
