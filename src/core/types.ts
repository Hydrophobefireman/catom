import type { Properties } from 'csstype'

/**
 * Input type for the css() function
 */
export interface CSSInput extends Properties {
  media?: { [query: string]: Properties }
  pseudo?: { [selector: string]: Properties }
}

/**
 * A single atomic CSS rule
 */
export interface CSSRule {
  /** Unique class name (hash) */
  hash: string
  /** CSS property in kebab-case */
  property: string
  /** CSS value */
  value: string
  /** Optional media query */
  media?: string
  /** Optional pseudo selector (e.g., ':hover') */
  pseudo?: string
}

/**
 * Result from transforming a single file
 */
export interface TransformResult {
  /** Transformed code with css() calls replaced */
  code: string
  /** Extracted CSS rules from this file */
  cssRules: CSSRule[]
  /** Whether the file was modified */
  transformed: boolean
}

/**
 * Plugin options
 */
export interface CatomPluginOptions {
  /**
   * File patterns to include for transformation
   * @default /\.[jt]sx?$/
   */
  include?: string | RegExp | (string | RegExp)[]

  /**
   * File patterns to exclude from transformation
   * @default /node_modules/
   */
  exclude?: string | RegExp | (string | RegExp)[]

  /**
   * Name of the css function to transform
   * @default 'css'
   */
  functionName?: string
}

/**
 * Internal module state for tracking CSS rules per file
 */
export interface ModuleCSSState {
  /** CSS rules extracted from this module */
  rules: CSSRule[]
  /** Last modification timestamp */
  timestamp: number
}
