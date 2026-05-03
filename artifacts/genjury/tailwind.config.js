/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        brand:   ['Space Grotesk', 'sans-serif'],
        display: ['Satoshi', 'sans-serif'],
        sans:    ['Satoshi', 'sans-serif'],
        body:    ['Satoshi', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        void: '#050508',
        panel: '#0c0c14',
        edge: '#12121e',
        neon: '#7fff6e',
        plasma: '#a259ff',
        signal: '#c05b30',
        ice: '#38d9f5',
        gold: '#f5c842',
        crimson: '#a0324b',
        ghost: 'rgba(255,255,255,0.06)',
        'ghost-border': 'rgba(255,255,255,0.1)',
      },
      animation: {
        'pulse-neon':   'pulseNeon 2s ease-in-out infinite',
        'slide-up':     'slideUp 0.45s cubic-bezier(0.16,1,0.3,1)',
        'slide-down':   'slideDown 0.45s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':      'fadeIn 0.3s ease',
        'shimmer':      'shimmer 2.5s linear infinite',
        'bounce-in':    'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'spin-slow':    'spin 3s linear infinite',
        'count-down':   'countDown 1s ease-in-out',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'tx-progress':  'txProgress 1.8s ease-in-out infinite',
        'float':        'float 4s ease-in-out infinite',
        'float-slow':   'float 7s ease-in-out infinite',
        'scan':         'scanLine 3s ease-in-out infinite',
        'ring-expand':  'ringExpand 2s ease-out infinite',
        'border-flow':  'borderFlow 3s linear infinite',
        'scale-in':     'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'gradient-x':   'gradientX 4s ease infinite',
        'glow-rotate':  'glowRotate 6s linear infinite',
        'icon-bounce':  'iconBounce 2.5s ease-in-out infinite',
        'hero-glow':    'heroGlow 8s ease-in-out infinite',
        'pulse-crimson': 'pulseCrimson 2.5s ease-in-out infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 6px #7fff6e, 0 0 20px #7fff6e33' },
          '50%':      { boxShadow: '0 0 18px #7fff6e, 0 0 50px #7fff6e55' },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(22px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: 0, transform: 'translateY(-12px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        bounceIn: {
          from: { opacity: 0, transform: 'scale(0.65)' },
          to:   { opacity: 1, transform: 'scale(1)' },
        },
        countDown: {
          '0%':   { transform: 'scale(1.5)', opacity: 0 },
          '50%':  { transform: 'scale(1)',   opacity: 1 },
          '100%': { transform: 'scale(0.9)', opacity: 0.7 },
        },
        glowPulse: {
          '0%, 100%': { textShadow: '0 0 8px #a259ff, 0 0 20px #a259ff44' },
          '50%':      { textShadow: '0 0 20px #a259ff, 0 0 50px #a259ff88' },
        },
        txProgress: {
          '0%':   { transform: 'translateX(-100%)', width: '40%' },
          '50%':  { transform: 'translateX(50%)',   width: '60%' },
          '100%': { transform: 'translateX(250%)',  width: '40%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-9px)' },
        },
        scanLine: {
          '0%':   { top: '-2px', opacity: 0 },
          '10%':  { opacity: 0.5 },
          '90%':  { opacity: 0.5 },
          '100%': { top: '100%', opacity: 0 },
        },
        ringExpand: {
          '0%':   { transform: 'scale(1)', opacity: 0.6 },
          '100%': { transform: 'scale(2.4)', opacity: 0 },
        },
        borderFlow: {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        scaleIn: {
          from: { opacity: 0, transform: 'scale(0.94)' },
          to:   { opacity: 1, transform: 'scale(1)' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        glowRotate: {
          '0%':   { filter: 'hue-rotate(0deg)' },
          '100%': { filter: 'hue-rotate(360deg)' },
        },
        iconBounce: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '40%':      { transform: 'translateY(-10px) scale(1.05)' },
          '60%':      { transform: 'translateY(-6px) scale(1.02)' },
        },
        heroGlow: {
          '0%, 100%': { opacity: 0.04, transform: 'scale(1)' },
          '50%':      { opacity: 0.09, transform: 'scale(1.1)' },
        },
        pulseCrimson: {
          '0%, 100%': { boxShadow: '0 0 6px #a0324b44, 0 0 16px #a0324b18' },
          '50%':      { boxShadow: '0 0 16px #a0324b70, 0 0 36px #a0324b30' },
        },
      },
    },
  },
  plugins: [],
}
