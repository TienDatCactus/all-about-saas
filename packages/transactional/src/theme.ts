import type { TailwindConfig } from "react-email";
import plugin from "tailwindcss/plugin";
const colors = {
  // Core shadcn Luma + Taupe tokens (mapped directly from styles.css)
  background: "#ffffff",
  foreground: "#242422",
  card: "#ffffff",
  "card-foreground": "#242422",
  popover: "#ffffff",
  "popover-foreground": "#242422",

  primary: {
    DEFAULT: "#005fe3",
    foreground: "#ffffff",
  },
  secondary: {
    DEFAULT: "#f8f8fa",
    foreground: "#323235",
  },
  muted: {
    DEFAULT: "#f5f4f0",
    foreground: "#8a8982",
  },
  accent: {
    DEFAULT: "#f5f4f0",
    foreground: "#383835",
  },
  destructive: {
    DEFAULT: "#ef4444",
    foreground: "#ffffff",
  },
  border: "#eaeae8",
  input: "#eaeae8",
  ring: "#b7b6ad",

  // Semantic aliases matching email layout class naming convention
  canvas: "#f5f4f0", // matches --muted
  brand: "#005fe3", // matches --primary
  bg: "#ffffff", // matches --background
  "bg-2": "#f5f4f0", // matches --muted
  fg: "#242422", // matches --foreground
  "fg-2": "#575754", // intermediate text
  "fg-3": "#8a8982", // matches --muted-foreground
  "fg-inverted": "#ffffff",
  stroke: "#eaeae8", // matches --border
} as const;

const fontScale = {
  11: {
    fontSize: "11px",
    lineHeight: "1.5",
    letterSpacing: "-0.033px",
    fontWeight: "300",
  },
  13: {
    fontSize: "13px",
    lineHeight: "1.5",
    letterSpacing: "-0.039px",
    fontWeight: "300",
  },
  14: { fontSize: "14px", lineHeight: "1.5" },
  15: {
    fontSize: "15px",
    lineHeight: "1.5",
    letterSpacing: "-0.075px",
    fontWeight: "500",
  },
  20: { fontSize: "20px", lineHeight: "1.2", letterSpacing: "-0.2px" },
  32: { fontSize: "32px", lineHeight: "1.2", letterSpacing: "-0.6px" },
  48: { fontSize: "48px", lineHeight: "1", letterSpacing: "-1.44px" },
  58: { fontSize: "58px", lineHeight: "1", letterSpacing: "-1.74px" },
  88: { fontSize: "88px", lineHeight: "1", letterSpacing: "-2.64px" },
} as const;

export const emailTailwindConfig: TailwindConfig = {
  plugins: [
    plugin(({ addUtilities, addVariant }) => {
      addVariant("mobile", "@media (max-width: 600px)");
      const utilities: Record<string, Record<string, string>> = {};
      for (const [step, token] of Object.entries(fontScale)) {
        utilities[`.font-${step}`] = token;
      }
      addUtilities(utilities);
    }),
  ],
  theme: {
    extend: {
      colors,
      boxShadow: {
        "collage-card":
          "0px 76px 21px 0px rgba(193,195,193,0), 0px 49px 19px 0px rgba(193,195,193,0.01), 0px 27px 16px 0px rgba(193,195,193,0.05), 0px 12px 12px 0px rgba(193,195,193,0.09), 0px 3px 7px 0px rgba(193,195,193,0.1)",
      },
      fontFamily: {
        sans: [
          "Figtree",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "10px", // matches var(--radius): 0.625rem
        md: "8px", // calc(var(--radius) * 0.8)
        sm: "6px", // calc(var(--radius) * 0.6)
      },
    },
  },
};
