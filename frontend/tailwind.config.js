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
        // IQM Primary — Blue theme
        primary: {
          800:     '#0C275E',
          700:     '#123787',
          600:     '#134AC1',
          500:     '#346EEC',
          400:     '#4F84F7',
          300:     '#78A1FC',
          200:     '#B1CAFE',
          100:     '#D2E0FE',
          75:      '#E2EBFF',
          50:      '#F2F6FF',
          light:   '#134AC1',
          dark:    '#134AC1',
          DEFAULT: '#134AC1',
        },
        // IQM Neutral scale
        neutral: {
          1000: '#121212',
          600:  '#4D4D4D',
          500:  '#666666',
          400:  '#999999',
          300:  '#CCCCCC',
          200:  '#E6E6E6',
          100:  '#F2F2F2',
          75:   '#FAFAFA',
          0:    '#FFFFFF',
        },
        // IQM Semantic
        danger: {
          700: '#8C0000',
          500: '#CC0909',
          200: '#F29696',
          75:  '#FCDEDE',
          50:  '#FFF2F2',
        },
        success: {
          700: '#003B27',
          500: '#007B51',
          100: '#8EE6C9',
          75:  '#B0EFDA',
          50:  '#ECFFFD',
        },
        warning: {
          700: '#472D00',
          500: '#A36701',
          100: '#F0CB89',
          75:  '#F7D8A3',
          50:  '#FFF3DE',
        },
        info: {
          700: '#003B59',
          500: '#0874AA',
          100: '#B0D9EE',
          75:  '#D7EBF5',
          50:  '#F2FAFF',
        },
        // Legacy aliases — keep so existing view classes resolve correctly
        background: {
          light:   '#FAFAFA',
          dark:    '#FAFAFA',
          DEFAULT: '#FAFAFA',
        },
        surface: {
          light:   '#FFFFFF',
          dark:    '#FFFFFF',
          DEFAULT: '#FFFFFF',
          hover: {
            light:   '#E6E6E6',
            dark:    '#E6E6E6',
            DEFAULT: '#E6E6E6',
          },
        },
        text: {
          light:   '#121212',
          dark:    '#121212',
          DEFAULT: '#121212',
        },
        muted: {
          light:   '#666666',
          dark:    '#666666',
          DEFAULT: '#666666',
        },
        alert: {
          red:    '#CC0909',
          orange: '#A36701',
          green:  '#007B51',
        },
      },
      fontFamily: {
        heading: ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body:    ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
