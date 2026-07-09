import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Set SINGLE_FILE=1 to inline all JS/CSS into one self-contained dist/index.html
// that opens by double-clicking (no server, no install) — for non-technical review.
const singleFile = process.env.SINGLE_FILE === '1';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  server: { port: 5173 },
});
