// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts}',
    './node_modules/@keijo/ui/**/*.{mjs,js}',
  ],
  // Classes referenced dynamically by @keijo/ui components (e.g. via [ngClass])
  // that Tailwind's content scanner may miss when reading bundled .mjs.
  // Keep this list in sync with the runtime-built class strings inside
  // @keijo/ui (notably <keijo-chart-card>'s sizeClass getter).
  safelist: [
    // chart-card sizes — runtime-built class strings (see <keijo-chart-card>'s
    // sizeClass getter inside node_modules/@keijo/ui).
    'w-full', 'aspect-[2/1]',
    'h-80', 'md:h-80', 'md:w-80', 'md:w-[40rem]', 'md:aspect-auto',
    // chart-card layout container
    'flex-col', 'md:flex-row', 'md:flex-wrap',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
