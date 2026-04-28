/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        void: '#050508',
        panel: '#0c0c14',
        edge: '#12121e',
        neon: '#7fff6e',
        plasma: '#a259ff',
        signal: '#ff6b35',
        ice: '#38d9f5',
        gold: '#f5c842',
        ghost: 'rgba(255,255,255,0.06)',
        'ghost-border': 'rgba(255,255,255,0.1)',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'fade-in': 'fadeIn 0.3s ease',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'spin-slow': 'spin 3s linear infinite',
        'count-down': 'countDown 1s ease-in-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'tx-progress': 'txProgress 1.6s ease-in-out infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 5px #7fff6e, 0 0 20px #7fff6e33' },
          '50%': { boxShadow: '0 0 15px #7fff6e, 0 0 40px #7fff6e55' },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        bounceIn: {
          from: { opacity: 0, transform: 'scale(0.7)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        countDown: {
          '0%': { transform: 'scale(1.5)', opacity: 0 },
          '50%': { transform: 'scale(1)', opacity: 1 },
          '100%': { transform: 'scale(0.9)', opacity: 0.7 },
        },
        glowPulse: {
          '0%, 100%': { textShadow: '0 0 8px #a259ff, 0 0 20px #a259ff44' },
          '50%': { textShadow: '0 0 20px #a259ff, 0 0 50px #a259ff88' },
        },
        txProgress: {
          '0%':   { transform: 'translateX(-100%)', width: '40%' },
          '50%':  { transform: 'translateX(50%)',   width: '60%' },
          '100%': { transform: 'translateX(250%)',  width: '40%' },
        },
      },
    },
  },
  plugins: [],
}
