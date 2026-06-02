/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        // Light theme: white surfaces, soft-blue accent.
        canvas: '#f4f5f7', // app background
        panel: 'rgba(255, 255, 255, 0.82)', // overlay glass
        accent: {
          DEFAULT: '#2f7ff0',
          soft: 'rgba(47, 127, 240, 0.12)',
          dim: 'rgba(47, 127, 240, 0.5)'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        '4xl': '1.75rem'
      },
      boxShadow: {
        glass: '0 16px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 0.5px rgba(15,23,42,0.05)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite'
      }
    }
  },
  plugins: []
}
