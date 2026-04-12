/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pink: {
          50:  "#fdf2f7",
          100: "#fce7f1",
          200: "#f9c5de",
          400: "#f07ab5",
          500: "#e8639a",
          600: "#d44e84",
          700: "#b83a6d",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)",
        "card-hover": "0 4px 12px 0 rgba(0,0,0,.08)",
      },
    },
  },
  plugins: [],
};
