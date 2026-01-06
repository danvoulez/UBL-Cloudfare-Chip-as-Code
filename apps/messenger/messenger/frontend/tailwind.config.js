/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background hierarchy
        bg: {
          base: '#0f0f0f',
          elevated: '#161616',
          surface: '#1c1c1c',
          hover: '#242424',
          active: '#2a2a2a',
          card: '#1a1a1a',
          sidebar: '#141414',
        },
        
        // Accent - Warm Coral/Terracotta
        accent: {
          DEFAULT: '#e07a5f',
          hover: '#c96a52',
          active: '#b35a45',
          subtle: 'rgba(224, 122, 95, 0.15)',
          glow: 'rgba(224, 122, 95, 0.25)',
        },
        
        // Secondary - Warm Cream
        cream: {
          DEFAULT: '#f4e4bc',
          muted: 'rgba(244, 228, 188, 0.7)',
        },
        
        // Text hierarchy
        text: {
          primary: '#f5f5f5',
          secondary: '#a8a8a8',
          tertiary: '#6b6b6b',
          inverse: '#0f0f0f',
        },
        
        // Semantic
        success: {
          DEFAULT: '#4ade80',
          subtle: 'rgba(74, 222, 128, 0.15)',
        },
        warning: {
          DEFAULT: '#fbbf24',
          subtle: 'rgba(251, 191, 36, 0.15)',
        },
        error: {
          DEFAULT: '#f87171',
          subtle: 'rgba(248, 113, 113, 0.15)',
        },
        info: {
          DEFAULT: '#60a5fa',
          subtle: 'rgba(96, 165, 250, 0.15)',
        },
        
        // Border
        border: {
          subtle: 'rgba(255, 255, 255, 0.04)',
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.12)',
        },
      },
      
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '1rem' }],     // 10px
        'xs': ['0.6875rem', { lineHeight: '1rem' }],     // 11px
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],  // 13px
      },
      
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      
      boxShadow: {
        'glow': '0 0 20px rgba(224, 122, 95, 0.25)',
        'glow-sm': '0 0 10px rgba(224, 122, 95, 0.15)',
        'glow-lg': '0 0 40px rgba(224, 122, 95, 0.35)',
        'inner-glow': 'inset 0 0 20px rgba(224, 122, 95, 0.1)',
      },
      
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.3s ease forwards',
        'slide-in-right': 'slideInRight 0.3s ease forwards',
        'pulse-soft': 'pulseSoft 2s infinite',
        'shimmer': 'shimmer 2s infinite',
        'typing': 'typing 1.5s steps(3) infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        typing: {
          '0%': { content: '.' },
          '33%': { content: '..' },
          '66%': { content: '...' },
        },
      },
      
      spacing: {
        'sidebar': '340px',
        'header': '64px',
      },
    },
  },
  plugins: [],
}

