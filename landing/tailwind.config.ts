import type { Config } from 'tailwindcss';
import { SCORE_GREEN, SCORE_AMBER, SCORE_RED } from './src/lib/colors';

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'bg-base':      '#07080a',
        'score-hi':     toHex(SCORE_GREEN),
        'score-mid':    toHex(SCORE_AMBER),
        'score-lo':     toHex(SCORE_RED),
        'text-primary': '#dde2ea',
        'text-muted':   '#7a8394',
        'text-dim':     '#40454f',
        border:         '#262b34',
      },
      fontFamily: {
        display: ['"Archivo"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
