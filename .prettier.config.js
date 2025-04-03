/** @type {import("prettier").Config} */

export default {
  printWidth: 120,
  tabWidth: 2,
  singleQuote: false,
  trailingComma: "es5",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
};
