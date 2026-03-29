/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1020',
        panel: '#121a2f',
        panelSoft: '#18233f',
        line: '#28365f',
        lime: '#d8ff52',
        aqua: '#4be9d4',
        coral: '#ff7a59',
        fog: '#97a6cf',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['Segoe UI', 'sans-serif'],
        mono: ['Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 20px 60px rgba(75, 233, 212, 0.12)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
