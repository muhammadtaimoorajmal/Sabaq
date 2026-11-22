/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,jsonc,yml,yaml,css,html}': ['prettier --write'],
  '*.md': ['markdownlint-cli2 --fix'],
};
