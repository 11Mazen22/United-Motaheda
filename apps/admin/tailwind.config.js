/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#E6F4F3',
          100: '#C0E4E1',
          500: '#0E7E74',
          600: '#0A5E57',
          700: '#074740',
        },
        pharmacy: {
          primary: '#0E7E74',
          primaryDark: '#0A5F58',
          primaryLight: '#E6F4F2',
          ink: '#0A1220',
          inkSoft: '#475569',
          inkFaint: '#64748B',
          canvas: '#F4F7FA',
          surface: '#FFFFFF',
          line: '#E2E8F0',
        },
        accent: '#F59E0B',
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
