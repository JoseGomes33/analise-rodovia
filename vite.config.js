import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base relativa + JS/CSS embutidos no index.html: o mesmo build roda na Vercel
// e abrindo dist/index.html direto do disco (file://).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', target: 'es2020' },
});
