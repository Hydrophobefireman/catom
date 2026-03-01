import { parseSync } from '@swc/core'
import type {
  CallExpression,
  Expression,
  KeyValueProperty,
  ObjectExpression,
  Program,
  StringLiteral,
  NumericLiteral,
} from '@swc/core'
import { createCSSRule } from '../core/css-generator.js'
import type { CSSRule, TransformResult } from '../core/types.js'

function isLiteral(expr: Expression): expr is StringLiteral | NumericLiteral {
  return expr.type === 'StringLiteral' || expr.type === 'NumericLiteral'
}

function getLiteralValue(expr: StringLiteral | NumericLiteral): string | number {
  if (expr.type === 'StringLiteral') {
    return expr.value
  }
  return expr.value
}

function getPropertyKey(prop: KeyValueProperty): string | null {
  if (prop.key.type === 'Identifier') {
    return prop.key.value
  }
  if (prop.key.type === 'StringLiteral') {
    return prop.key.value
  }
  return null
}

function processPropertiesObject(
  obj: ObjectExpression,
  rules: CSSRule[],
  media?: string,
  pseudo?: string
): void {
  for (const prop of obj.properties) {
    if (prop.type === 'SpreadElement') {
      if (prop.arguments.type === 'ObjectExpression') {
        processPropertiesObject(prop.arguments, rules, media, pseudo)
      } else {
        throw new Error(
          `[catom] Spread elements must be object literals. ` +
            `Dynamic spreads are not supported at compile time.`
        )
      }
      continue
    }

    if (prop.type !== 'KeyValueProperty') {
      continue
    }

    const keyName = getPropertyKey(prop)
    if (!keyName) {
      throw new Error(`[catom] Could not determine property key. Only identifiers and string literals are supported.`)
    }

    const value = prop.value

    if (keyName === 'media') {
      if (value.type !== 'ObjectExpression') {
        throw new Error(`[catom] 'media' property must be an object literal.`)
      }
      for (const mediaProp of value.properties) {
        if (mediaProp.type !== 'KeyValueProperty') continue
        const mediaQuery = getPropertyKey(mediaProp)
        if (!mediaQuery) continue
        if (mediaProp.value.type !== 'ObjectExpression') {
          throw new Error(`[catom] Media query '${mediaQuery}' must contain an object literal.`)
        }
        processPropertiesObject(mediaProp.value, rules, mediaQuery, pseudo)
      }
      continue
    }

    if (keyName === 'pseudo') {
      if (value.type !== 'ObjectExpression') {
        throw new Error(`[catom] 'pseudo' property must be an object literal.`)
      }
      for (const pseudoProp of value.properties) {
        if (pseudoProp.type !== 'KeyValueProperty') continue
        const pseudoSelector = getPropertyKey(pseudoProp)
        if (!pseudoSelector) continue
        if (pseudoProp.value.type !== 'ObjectExpression') {
          throw new Error(`[catom] Pseudo selector '${pseudoSelector}' must contain an object literal.`)
        }
        processPropertiesObject(pseudoProp.value, rules, media, pseudoSelector)
      }
      continue
    }

    let actualValue = value
    if (actualValue.type === 'TsAsExpression') {
      actualValue = actualValue.expression
    }

    if (!isLiteral(actualValue)) {
      throw new Error(
        `[catom] Property '${keyName}' has a non-literal value. ` +
          `Only string and number literals are supported at compile time. ` +
          `Got: ${actualValue.type}`
      )
    }

    const rule = createCSSRule(keyName, getLiteralValue(actualValue), media, pseudo)
    rules.push(rule)
  }
}

function processCSSCall(callExpr: CallExpression): { rules: CSSRule[]; classNames: string } {
  const rules: CSSRule[] = []

  if (callExpr.arguments.length === 0) {
    return { rules: [], classNames: '' }
  }

  const arg = callExpr.arguments[0]
  if (arg.expression.type !== 'ObjectExpression') {
    throw new Error(
      `[catom] css() must be called with an object literal. ` +
        `Got: ${arg.expression.type}`
    )
  }

  processPropertiesObject(arg.expression, rules)

  const classNames = rules.map((r) => r.hash).join(' ')
  return { rules, classNames }
}

const METADATA_KEYS = new Set(['span', 'ctxt'])

function isASTNode(value: unknown): value is { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).type === 'string'
  )
}

function walkAndTransform(
  node: unknown,
  functionName: string,
  allRules: CSSRule[],
  replacements: Map<number, string>,
  visited = new WeakSet<object>()
): void {
  if (!node || typeof node !== 'object') return
  
  // Prevent cycles
  if (visited.has(node as object)) return
  visited.add(node as object)

  if (isCallExpression(node)) {
    const callee = node.callee
    if (
      callee.type === 'Identifier' &&
      callee.value === functionName
    ) {
      try {
        const { rules, classNames } = processCSSCall(node)
        allRules.push(...rules)
        replacements.set(node.span.start, classNames)
      } catch (error) {
        const loc = node.span
        const prefix = loc ? `[${loc.start}:${loc.end}]` : ''
        throw new Error(`${prefix} ${(error as Error).message}`)
      }
    }
  }

  for (const key of Object.keys(node as Record<string, unknown>)) {
    if (METADATA_KEYS.has(key)) continue
    
    const value = (node as Record<string, unknown>)[key]
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isASTNode(item)) {
          walkAndTransform(item, functionName, allRules, replacements, visited)
        }
      }
    } else if (isASTNode(value)) {
      walkAndTransform(value, functionName, allRules, replacements, visited)
    }
  }
}

function isCallExpression(node: unknown): node is CallExpression {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'CallExpression'
  )
}

function isTargetImport(spec: unknown, functionName: string): boolean {
  if (typeof spec !== 'object' || spec === null) return false
  const s = spec as Record<string, unknown>
  if (s.type !== 'ImportSpecifier') return false

  const imported = s.imported as Record<string, unknown> | null
  if (imported?.type === 'Identifier' && imported.value === functionName) {
    return true
  }

  const local = s.local as Record<string, unknown> | null
  if (!imported && local?.type === 'Identifier' && local.value === functionName) {
    return true
  }

  return false
}

function findCatomImports(
  ast: Program,
  functionName: string,
  baseOffset: number
): Array<{ start: number; end: number; isFullImport: boolean }> {
  const importsToRemove: Array<{ start: number; end: number; isFullImport: boolean }> = []

  for (const node of ast.body) {
    if (node.type !== 'ImportDeclaration') continue

    const source = node.source.value
    if (source !== 'catom') continue

    const specifiers = node.specifiers || []
    const hasCssImport = specifiers.some((spec) => isTargetImport(spec, functionName))

    if (!hasCssImport) continue

    if (specifiers.length === 1) {
      importsToRemove.push({
        start: node.span.start - 1 - baseOffset,
        end: node.span.end - 1 - baseOffset,
        isFullImport: true,
      })
    } else {
      for (const spec of specifiers) {
        if (isTargetImport(spec, functionName)) {
          const s = spec as { span: { start: number; end: number } }
          importsToRemove.push({
            start: s.span.start - 1 - baseOffset,
            end: s.span.end - 1 - baseOffset,
            isFullImport: false,
          })
        }
      }
    }
  }

  return importsToRemove
}

function removeImportFromCode(
  code: string,
  start: number,
  end: number,
  isFullImport: boolean
): string {
  if (isFullImport) {
    let lineStart = start
    while (lineStart > 0 && code[lineStart - 1] !== '\n') {
      lineStart--
    }
    let lineEnd = end
    while (lineEnd < code.length && code[lineEnd] !== '\n') {
      lineEnd++
    }
    if (code[lineEnd] === '\n') lineEnd++
    return code.slice(0, lineStart) + code.slice(lineEnd)
  } else {
    let removeEnd = end
    while (removeEnd < code.length && /[\s,]/.test(code[removeEnd])) {
      removeEnd++
    }
    return code.slice(0, start) + code.slice(removeEnd)
  }
}

export function transformCode(
  code: string,
  id: string,
  functionName: string = 'css'
): TransformResult {
  const isTypeScript = /\.tsx?$/.test(id)
  const isJSX = /\.[jt]sx$/.test(id)

  let ast: Program
  try {
    ast = parseSync(code, {
      syntax: isTypeScript ? 'typescript' : 'ecmascript',
      tsx: isJSX && isTypeScript,
      jsx: isJSX && !isTypeScript,
      comments: true,
    })
  } catch {
    return { code, cssRules: [], transformed: false }
  }

  const allRules: CSSRule[] = []
  const replacements = new Map<number, string>()

  walkAndTransform(ast, functionName, allRules, replacements)

  if (replacements.size === 0) {
    return { code, cssRules: [], transformed: false }
  }

  // SWC accumulates byte offsets across parseSync calls
  // ast.span.start gives us the base offset we need to subtract
  const baseOffset = ast.span.start - 1 // -1 because spans are 1-indexed

  const importsToRemove = findCatomImports(ast, functionName, baseOffset)
  let result = code

  interface Modification {
    start: number
    end: number
    replacement: string
    type: 'css-call' | 'full-import' | 'import-specifier'
  }

  const modifications: Modification[] = []

  for (const [start, classNames] of replacements) {
    // Adjust span by subtracting base offset (spans are 1-indexed, so -1 then subtract base)
    const adjustedStart = start - 1 - baseOffset
    const cssCallMatch = findCSSCallBounds(result, adjustedStart, functionName)
    if (cssCallMatch) {
      modifications.push({
        start: cssCallMatch.start,
        end: cssCallMatch.end,
        replacement: JSON.stringify(classNames),
        type: 'css-call',
      })
    }
  }

  for (const imp of importsToRemove) {
    modifications.push({
      start: imp.start,
      end: imp.end,
      replacement: '',
      type: imp.isFullImport ? 'full-import' : 'import-specifier',
    })
  }

  modifications.sort((a, b) => b.start - a.start)
  for (const mod of modifications) {
    if (mod.type === 'full-import') {
      result = removeImportFromCode(result, mod.start, mod.end, true)
    } else if (mod.type === 'import-specifier') {
      result = removeImportFromCode(result, mod.start, mod.end, false)
    } else {
      result = result.slice(0, mod.start) + mod.replacement + result.slice(mod.end)
    }
  }

  return {
    code: result,
    cssRules: allRules,
    transformed: true,
  }
}

function findCSSCallBounds(
  code: string,
  startPos: number,
  functionName: string
): { start: number; end: number } | null {
  const searchWindow = 50
  const searchStart = Math.max(0, startPos - searchWindow)
  const searchEnd = Math.min(code.length, startPos + searchWindow)
  const searchRegion = code.slice(searchStart, searchEnd)

  const funcPattern = new RegExp(`\\b${functionName}\\s*\\(`)
  const match = funcPattern.exec(searchRegion)
  if (!match) return null

  const callStart = searchStart + match.index
  const parenStart = callStart + match[0].length - 1

  let depth = 1
  let i = parenStart + 1
  while (i < code.length && depth > 0) {
    const char = code[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    i++
  }

  if (depth !== 0) return null

  return { start: callStart, end: i }
}
