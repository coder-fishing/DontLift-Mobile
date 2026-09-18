/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './prototype/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#0F172A',
          850: '#1E293B',
          650: '#475569',
        },
        acrylic: {
          base: 'rgba(255, 255, 255, 0.35)',
          chrome: 'rgba(255, 255, 255, 0.45)',
          active: 'rgba(255, 255, 255, 0.60)',
          specular: 'rgba(255, 255, 255, 0.95)',
          bottom: 'rgba(255, 255, 255, 0.25)',
        },
      },
      fontFamily: {
        sans: ['PlusJakartaSans-Regular', 'system-ui', 'sans-serif'],
        mono: ['JetBrainsMono-Regular', 'monospace'],
        display: ['PlusJakartaSans-Bold', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
