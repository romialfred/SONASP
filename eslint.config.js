import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  { ignores: ['dist'] },
  // Hygiène globale : interdit les imports inutilisés sur tout le code source (audit F7/F10).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'unused-imports': unusedImports },
    languageOptions: { parser: tseslint.parser },
    rules: { 'unused-imports/no-unused-imports': 'error' },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: [
      'src/components/common/**/*.{ts,tsx}',
      'src/lib/apiClient.ts',
      'src/lib/schemas/**/*.{ts,tsx}',
      'src/pages/sales/SaleDetails.tsx',
      'src/pages/sales/SalesDashboard.tsx',
      'src/pages/sales/__tests__/**/*.{ts,tsx}',
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: [
      'src/components/common/**/*.{ts,tsx}',
      'src/lib/apiClient.ts',
      'src/lib/schemas/**/*.{ts,tsx}',
      'src/pages/sales/SaleDetails.tsx',
      'src/pages/sales/SalesDashboard.tsx',
      'src/pages/sales/__tests__/**/*.{ts,tsx}',
    ],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
    },
  }
);
