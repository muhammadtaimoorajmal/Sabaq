import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/coverage/',
      '.course/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Accessibility rules for every user interface file
    files: ['**/*.{jsx,tsx}'],
    ...jsxA11y.flatConfigs.strict,
    languageOptions: {
      ...jsxA11y.flatConfigs.strict.languageOptions,
      globals: { ...globals.browser },
    },
  },
  {
    // React's rules of hooks and the React Compiler's correctness checks
    files: ['**/*.{jsx,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    // Command-line scripts may print to the console
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
