/** @type {import('tailwindcss').Config} */
const { colors, spacing, borderRadius } = require('../../packages/theme/src');

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: colors.light,
      spacing,
      borderRadius,
    },
  },
  plugins: [],
};
