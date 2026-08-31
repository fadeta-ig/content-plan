import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // Async loaders intentionally set loading state before their first await;
      // this is synchronization with an external API, not a derived-state loop.
      'react-hooks/set-state-in-effect': 'off',
      // Keep legacy provider payload debt visible without disabling the gate.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
