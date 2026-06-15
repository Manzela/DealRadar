import type { Config } from 'tailwindcss';

/**
 * Design tokens — DealRadar.
 * White base, indigo accent (interactive), semantic red reserved for the
 * discount badge only. Neutral grays from Tailwind's `zinc` ramp.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#4F46E5', // indigo-600
          hover: '#4338CA',   // indigo-700
          soft: '#EEF2FF',    // indigo-50
        },
        deal: {
          DEFAULT: '#DC2626', // red-600 — discount badge only
          soft: '#FEF2F2',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 4px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        // ~2x the card-hover shadow — used for the deal-card hover lift cue.
        'card-hover-lg': '0 8px 24px -4px rgb(0 0 0 / 0.20), 0 4px 12px -4px rgb(0 0 0 / 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
