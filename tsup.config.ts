import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['component/index.tsx'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
});
