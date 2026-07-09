import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'playwright-report',
      'test-results',
      'screenshots',
      '*.config.ts',
      '*.config.js',
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // THE ENGINE STAYS PURE: no renderer, no UI, no store. Contracts and data
    // likewise depend on nothing but zod. This is load-bearing for the medical
    // firewall (SPEC §5.6) and for engine determinism/testability.
    files: ['src/engine/**/*.ts', 'src/contracts/**/*.ts', 'src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: 'engine/contracts/data must not import three' },
            { name: 'react', message: 'engine/contracts/data must not import react' },
            { name: 'react-dom', message: 'engine/contracts/data must not import react-dom' },
            { name: 'zustand', message: 'engine/contracts/data must not import zustand' },
          ],
          patterns: [
            {
              group: [
                'three/*',
                'react/*',
                'react-dom/*',
                'zustand/*',
                '**/world/**',
                '**/ui/**',
                '**/screens/**',
                '**/bridge/**',
                '**/audio/**',
                '**/ai/**',
              ],
              message: 'engine/contracts/data must stay free of renderer/UI/store imports',
            },
          ],
        },
      ],
    },
  },
);
