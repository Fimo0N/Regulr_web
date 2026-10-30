import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Read VITE_* variables from the project's main .env file.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
