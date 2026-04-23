import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        solana: {
          purple: "#9945FF",
          green: "#14F195",
          teal: "#00C2FF",
        },
        bg: {
          DEFAULT: "#08080E",
          card: "#111118",
          border: "#1E1E2E",
        },
        glass: {
          surface: "rgba(255,255,255,0.04)",
          border: "rgba(255,255,255,0.08)",
        },
        brand: {
          purple: "#9945FF",
          "purple-light": "#C084FC",
          "purple-muted": "#F3EEFF",
          beige: "#F7F3ED",
          "beige-dark": "#EDE6DB",
          card: "#FFFFFF",
          gold: "#F4C009",
          "gold-light": "#FEF3C7",
          "gold-muted": "#FEF9E7",
          orange: "#FF6B2B",
          "orange-light": "#FF8F5A",
          "orange-muted": "#FFF0E8",
          ink: "#1A1028",
          "ink-soft": "#4A3A6A",
          muted: "#8B7AA0",
          border: "#E8DFF5",
          "border-dark": "#D1C4E9",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },
      backgroundImage: {
        "gradient-solana": "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
        "gradient-card": "linear-gradient(135deg, #111118 0%, #1A1A2E 100%)",
        "gradient-mesh":
          "radial-gradient(at 20% 0%, rgba(153,69,255,0.18) 0px, transparent 50%), radial-gradient(at 80% 100%, rgba(20,241,149,0.12) 0px, transparent 50%)",
      },
      boxShadow: {
        glow: "0 0 40px rgba(153, 69, 255, 0.35)",
        "glow-green": "0 0 40px rgba(20, 241, 149, 0.25)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "orb-float": "orbFloat 10s ease-in-out infinite",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        orbFloat: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(20px, -20px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
