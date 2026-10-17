import type { Config } from "tailwindcss";

const config: Config = {
  // Shared workspace appearance. Export artwork retains explicit deck colors.
  darkMode: ["selector", ".screenova-dark"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: "hsl(var(--success))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // Apple HIG type ramp. Named roles, not pixel guesses — see
      // root DESIGN.md. Floor is 12px (caption); any control a user
      // reads to make a choice is `footnote` (13px) or larger.
      fontSize: {
        caption: ["12px", { lineHeight: "1.4" }],
        footnote: ["13px", { lineHeight: "1.4", letterSpacing: "0" }],
        subhead: ["15px", { lineHeight: "1.45" }],
        body: ["17px", { lineHeight: "1.5" }],
        title3: ["17px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        title2: ["21px", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        title1: ["28px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        display: ["54px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
      // Explicit radius hierarchy. The old scale derived md/sm from --radius,
      // which made `rounded-lg` and Tailwind's stock `rounded-xl` both resolve
      // to 12px — two names, one size, and no way to read intent from the code.
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        // Tinted, layered shadows — never pure black (single light source from above).
        card: "0 1px 2px hsl(240 10% 8% / 0.05), 0 8px 24px -4px hsl(240 10% 8% / 0.08)",
        pop: "0 2px 6px hsl(240 10% 8% / 0.06), 0 16px 40px -8px hsl(240 10% 8% / 0.16)",
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
