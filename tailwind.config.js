const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), surface2: c('surface2'),
        fg: c('fg'), muted: c('muted'), border: c('border'), strong: c('border-strong'),
        accent: c('accent'), 'accent-fg': c('accent-fg'), 'accent-soft': c('accent-soft'),
        success: c('success'), danger: c('danger'), warn: c('warn'),
        cs: c('cs'), engineering: c('engineering'), math: c('math'), physics: c('physics'),
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
