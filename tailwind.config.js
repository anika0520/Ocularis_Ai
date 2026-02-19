/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ["Orbitron", "monospace"],
        "mono-tech": ["Share Tech Mono", "monospace"],
        exo: ["Exo 2", "sans-serif"],
      },
      colors: {
        neon: "#00f5ff",
        "dark-base": "#050810",
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
};
