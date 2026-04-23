/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00E5FF',
        background: '#0B0C10',
        surface: '#181A1F',
        'surface-hover': '#2A2D35',
        text: '#E0E6ED',
        muted: '#848D97',
        alert: {
          red: '#FF1744',
          orange: '#FF9100',
          green: '#00E676',
        }
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'sm': '2px',
      }
    },
  },
  plugins: [],
}
