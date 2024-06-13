import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  dts: true, // Generate declaration file (.d.ts)
  entry: ['./sitemap.ts', './seo.ts'],
  format: ['cjs', 'esm'], // Build for commonJS and ESmodules
  minify: true,
  sourcemap: true,
  splitting: false,
  target: ['chrome100', 'firefox100', 'node20'],
})
