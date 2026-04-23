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
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        Image: 'readonly',
        navigator: 'readonly',
        ClipboardItem: 'readonly',
        setTimeout: 'readonly',
        HTMLButtonElement: 'readonly',
      },
    },
  },
];
