import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Les tests de rendu (jsdom + Testing Library) dépassent parfois les 5 s par défaut
    // lorsque la suite complète s'exécute en parallèle : le délai est relevé pour éviter
    // des échecs qui ne traduisent aucune régression.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    /**
     * Execution en threads plutot qu'en processus.
     *
     * Avec le pool `forks`, des workers n'arrivaient pas a demarrer sur cette machine
     * (« Timeout waiting for worker to respond ») : vitest retirait alors les fichiers
     * concernes du decompte et annoncait un resultat vert portant sur moins de tests
     * qu'il n'en existe — une perte de couverture invisible. Borner le nombre de forks
     * a 6 n'a pas suffi. Les threads evitent le cout de creation de processus, qui est
     * precisement l'etape qui echouait.
     */
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 8,
        minThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
