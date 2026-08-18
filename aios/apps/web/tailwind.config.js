/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sidebar
        sidebar: '#0b1220',
        'sidebar-hover': '#1a2640',
        'sidebar-active': '#1e3a5f',
        'sidebar-border': '#1e2d45',

        // Navy — Trust & Authority
        navy: {
          50:  '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#1e3a8a',
          900: '#0F2654',
          950: '#0a1a3d',
        },

        // Teal
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0D9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },

        // Semantic
        error:   { DEFAULT: '#DC2626', light: '#FEE2E2', dark: '#991B1B' },
        success: { DEFAULT: '#16A34A', light: '#DCFCE7', dark: '#14532D' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7', dark: '#92400E' },

        // Neutral surface
        bg:      '#f5f6fa',
        surface: '#FFFFFF',
        border:  '#E2E8F0',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      boxShadow: {
        card:   '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10)',
        modal:  '0 20px 60px rgba(0, 0, 0, 0.15)',
        input:  '0 0 0 3px rgba(13, 148, 136, 0.15)',
        sidebar: '2px 0 8px rgba(0,0,0,0.15)',
      },

      borderRadius: {
        btn:  '8px',
        card: '12px',
        modal:'16px',
        chip: '100px',
      },

      maxWidth: {
        content:   '1200px',
        modal:     '640px',
        'modal-sm':'480px',
      },

      spacing: {
        sidebar: '248px',
      },

      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'count-up': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },

      animation: {
        'fade-in':  'fade-in 0.35s ease-out both',
        'slide-in': 'slide-in 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};
