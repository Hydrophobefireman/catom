/**
 * Simple test for the transform logic
 * Run with: npx tsx test/transform.test.ts
 */

import { transformCode } from '../src/vite/transform.js'
import { generateCSS, deduplicateRules } from '../src/core/css-generator.js'

function runTests() {
  console.log('Running catom transform tests...\n')

  // Test 1: Basic CSS properties
  {
    console.log('Test 1: Basic CSS properties')
    const code = `
      import { css } from 'catom'
      const btn = css({ color: 'red', padding: '8px' })
    `
    const result = transformCode(code, 'test.ts', 'css')
    
    console.log('  Transformed:', result.transformed)
    console.log('  Rules count:', result.cssRules.length)
    console.log('  Rules:', result.cssRules.map(r => `${r.property}: ${r.value}`).join(', '))
    console.log('  Import removed:', !result.code.includes("import { css } from 'catom'"))
    console.log('  css() replaced:', result.code.includes('"'))
    console.log()
  }

  // Test 2: Media queries
  {
    console.log('Test 2: Media queries')
    const code = `
      const responsive = css({
        color: 'blue',
        media: {
          '(max-width: 768px)': { color: 'red' }
        }
      })
    `
    const result = transformCode(code, 'test.ts', 'css')
    
    console.log('  Rules count:', result.cssRules.length)
    console.log('  Has media rule:', result.cssRules.some(r => r.media))
    console.log('  Media query:', result.cssRules.find(r => r.media)?.media)
    console.log()
  }

  // Test 3: Pseudo selectors
  {
    console.log('Test 3: Pseudo selectors')
    const code = `
      const hoverable = css({
        color: 'green',
        pseudo: {
          ':hover': { color: 'blue' }
        }
      })
    `
    const result = transformCode(code, 'test.ts', 'css')
    
    console.log('  Rules count:', result.cssRules.length)
    console.log('  Has pseudo rule:', result.cssRules.some(r => r.pseudo))
    console.log('  Pseudo selector:', result.cssRules.find(r => r.pseudo)?.pseudo)
    console.log()
  }

  // Test 4: Deduplication
  {
    console.log('Test 4: Deduplication across multiple css() calls')
    const code = `
      const btn1 = css({ color: 'red', padding: '8px' })
      const btn2 = css({ color: 'red', margin: '4px' })
    `
    const result = transformCode(code, 'test.ts', 'css')
    
    const dedupedRules = deduplicateRules(result.cssRules)
    console.log('  Total rules:', result.cssRules.length)
    console.log('  After dedup:', dedupedRules.length)
    console.log('  (color: red appears twice but dedupes to one)')
    console.log()
  }

  // Test 5: CSS Generation
  {
    console.log('Test 5: CSS generation')
    const code = `
      const a = css({ color: 'red' })
      const b = css({ color: 'red', padding: '8px' })
      const c = css({ 
        backgroundColor: 'blue',
        pseudo: { ':hover': { backgroundColor: 'darkblue' } }
      })
    `
    const result = transformCode(code, 'test.ts', 'css')
    const css = generateCSS(result.cssRules)
    
    console.log('  Generated CSS:')
    console.log('  ' + css.split('\n').join('\n  '))
    console.log()
  }

  // Test 6: Error on dynamic value
  {
    console.log('Test 6: Error on dynamic value')
    const code = `
      const dynamic = someVariable
      const bad = css({ color: dynamic })
    `
    try {
      transformCode(code, 'test.ts', 'css')
      console.log('  ERROR: Should have thrown!')
    } catch (e) {
      console.log('  Correctly threw error:', (e as Error).message.substring(0, 80) + '...')
    }
    console.log()
  }

  // Test 7: TSX support
  {
    console.log('Test 7: TSX support')
    const code = `
      import { css } from 'catom'
      
      export function Button() {
        const styles = css({ color: 'white', backgroundColor: 'blue' })
        return <button className={styles}>Click</button>
      }
    `
    const result = transformCode(code, 'Button.tsx', 'css')
    
    console.log('  Transformed:', result.transformed)
    console.log('  Rules count:', result.cssRules.length)
    console.log()
  }

  // Test 8: Media queries with pseudo selectors
  {
    console.log('Test 8: Media queries with pseudo selectors')
    const code = `
      const responsive = css({
        color: 'blue',
        media: {
          '(max-width: 768px)': { 
            color: 'red',
            pseudo: { 
              ':hover': { color: 'darkred' },
              ':focus': { outline: '2px solid red' }
            }
          }
        }
      })
    `
    const result = transformCode(code, 'test.ts', 'css')
    const generatedCSS = generateCSS(result.cssRules)
    
    console.log('  Rules count:', result.cssRules.length)
    console.log('  Rules with media+pseudo:', result.cssRules.filter(r => r.media && r.pseudo).length)
    console.log('  Generated CSS:')
    console.log('  ' + generatedCSS.split('\n').join('\n  '))
    console.log()
  }

  // Test 9: Import removal - full import
  {
    console.log('Test 9: Import removal - full import')
    const code = `import { css } from 'catom'
const btn = css({ color: 'red' })`
    const result = transformCode(code, 'test.ts', 'css')
    
    console.log('  Import removed:', !result.code.includes('import'))
    console.log('  Code:', result.code.trim())
    console.log()
  }

  // Test 10: Import removal - mixed imports (should only remove css)
  {
    console.log('Test 10: Import removal - keeps other imports')
    const code = `import { css } from 'catom'
import { useState } from 'react'
const btn = css({ color: 'red' })`
    const result = transformCode(code, 'test.ts', 'css')
    
    console.log('  catom import removed:', !result.code.includes("from 'catom'"))
    console.log('  react import kept:', result.code.includes("from 'react'"))
    console.log()
  }

  console.log('All tests completed!')
}

try {
  runTests()
} catch (e) {
  console.error(e)
}
