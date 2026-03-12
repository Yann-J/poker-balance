import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
      },
    },
  },
];
