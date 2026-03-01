import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'runtime/index': 'src/index.ts',
    'vite/index': 'src/vite/index.ts',
  },
  dts: true,
  sourcemap: true,
  external: ['vite', '@swc/core'],
})
