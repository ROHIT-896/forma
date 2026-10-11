/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forma: {
          bg: '#0F1115',
          card: '#181B22',
          cardHover: '#20242D',
          border: '#272B36',
          muted: '#8B949E',
          accent: '#10B981', // Default emerald accent
          accentHover: '#059669',
        }
      }
    },
  },
  plugins: [],
}
