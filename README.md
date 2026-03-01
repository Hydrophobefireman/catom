# catom

Zero-runtime CSS-in-JS with atomic CSS generation for Vite.

## Install

```bash
npm install catom
```

## Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import catom from 'catom/vite'

export default defineConfig({
  plugins: [catom()]
})
```

Add the virtual module type to your tsconfig:

```json
{
  "compilerOptions": {
    "types": ["catom/virtual"]
  }
}
```

## Usage

```tsx
import { css } from 'catom'
import 'virtual:catom.css'

const button = css({
  backgroundColor: 'blue',
  color: 'white',
  padding: '8px 16px',
  pseudo: {
    ':hover': { backgroundColor: 'darkblue' }
  },
  media: {
    '(max-width: 768px)': { padding: '4px 8px' }
  }
})

export function Button() {
  return <button className={button}>Click me</button>
}
```

The `css()` calls are transformed at build time into class name strings. No runtime overhead.

## Options

```ts
catom({
  include: /\.[jt]sx?$/,  // files to transform
  exclude: /node_modules/, // files to skip
  functionName: 'css'      // function name to transform
})
```

## License

MIT
