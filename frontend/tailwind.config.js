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
        primary: {
          light: '#7C3AED', // Violet
          dark: '#8B5CF6',  // Vibrant Violet
          DEFAULT: '#7C3AED',
        },
        background: {
          light: '#FAF5FF', // Soft Lavender White
          dark: '#0B0A1A',  // Deep Midnight Violet
          DEFAULT: '#FAF5FF',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#16142E',  // Dark Violet Slate
          DEFAULT: '#FFFFFF',
          hover: {
            light: '#F3E8FF',
            dark: '#242145',
            DEFAULT: '#F3E8FF',
          }
        },
        text: {
          light: '#1E1B4B', // Deep Navy
          dark: '#F8FAFC',  // Ghost White
          DEFAULT: '#1E1B4B',
        },
        muted: {
          light: '#64748b',  // slate-500 — readable on light backgrounds
          dark: '#94a3b8',   // slate-400 — readable on dark backgrounds
          DEFAULT: '#475569', // slate-600 — readable on both light and dark backgrounds
        },
        alert: {
          red: '#EF4444',
          orange: '#F59E0B',
          green: '#10B981',
        }
      },
      fontFamily: {
        heading: ['Fira Code', 'monospace'],
        body: ['Fira Sans', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
