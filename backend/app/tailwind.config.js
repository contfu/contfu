/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,ts,svelte}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eefbfc",
          100: "#d4f3f6",
          200: "#ade5ed",
          300: "#7dd2e0",
          400: "#44acbc",
          500: "#3590a0",
          600: "#2d7584",
          700: "#285e6b",
          800: "#254c57",
          900: "#234149",
          950: "#132a30",
        },
      },
    },
  },
  plugins: [],
};
