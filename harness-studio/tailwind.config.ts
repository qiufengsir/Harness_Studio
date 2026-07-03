import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#fafafa',
        bg2: '#f4f4f5',
        bg3: '#e4e4e7',
        line: '#e4e4e7',
        line2: '#d4d4d8',
        ink: '#18181b',
        ink2: '#3f3f46',
        ink3: '#a1a1aa',
        ink4: '#c4c4c8',
        black: '#09090b',
        accent: '#2563eb',
        good: '#16a34a',
        warn: '#d97706',
        bad: '#dc2626',
        purple: '#7c3aed',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      borderRadius: { sm: '4px', md: '6px', lg: '10px', xl: '14px' },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,.05)',
        md: '0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04)',
        lg: '0 4px 16px rgba(0,0,0,.08)',
        xl: '0 8px 32px rgba(0,0,0,.1)',
      },
      transitionDuration: { '150': '150ms' },
    },
  },
  plugins: [],
};
export default config;
