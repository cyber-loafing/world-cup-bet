import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        grass: "#0f8a5f",
        mint: "#dff6e9",
        coral: "#ff6b5f",
        gold: "#f3b33d",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 33, 28, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
