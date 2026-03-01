import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'runtime/index': 'src/index.ts',
    'vite/index': 'src/vite/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['vite', '@swc/core'],
  treeshake: true,
})
