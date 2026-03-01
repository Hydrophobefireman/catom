import { generateHash } from './hash.js'
import type { CSSRule } from './types.js'

const KEBAB_CASE_REGEX = /([a-z0-9]|(?=[A-Z]))([A-Z])/g

export function toKebabCase(property: string): string {
  return property.replace(KEBAB_CASE_REGEX, '$1-$2').toLowerCase()
}

export function createRuleIdentity(
  property: string,
  value: string,
  media?: string,
  pseudo?: string
): string {
  const mediaPrefix = media ? `@${media.trim()}` : ''
  const pseudoPrefix = pseudo ? pseudo.trim() : ''
  const kebabProp = toKebabCase(property)
  return `${mediaPrefix}${pseudoPrefix}${kebabProp}:${value};`
}

export function createCSSRule(
  property: string,
  value: string | number,
  media?: string,
  pseudo?: string
): CSSRule {
  const stringValue = String(value).trim()
  const kebabProperty = toKebabCase(property.trim())
  const identity = createRuleIdentity(property, stringValue, media, pseudo)
  const hash = generateHash(identity)

  return {
    hash,
    property: kebabProperty,
    value: stringValue,
    media: media?.trim(),
    pseudo: pseudo?.trim(),
  }
}

export function deduplicateRules(rules: CSSRule[]): CSSRule[] {
  const seen = new Map<string, CSSRule>()

  for (const rule of rules) {
    const identity = createRuleIdentity(rule.property, rule.value, rule.media, rule.pseudo)
    if (!seen.has(identity)) {
      seen.set(identity, rule)
    }
  }

  return Array.from(seen.values())
}

interface GroupedRule {
  declaration: string
  hashes: Set<string>
  media?: string
  pseudo?: string
}

function groupRulesByDeclaration(rules: CSSRule[]): GroupedRule[] {
  const groups = new Map<string, GroupedRule>()

  for (const rule of rules) {
    const declaration = `${rule.property}:${rule.value};`
    const groupKey = `${rule.media || ''}|${rule.pseudo || ''}|${declaration}`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        declaration,
        hashes: new Set(),
        media: rule.media,
        pseudo: rule.pseudo,
      })
    }
    groups.get(groupKey)!.hashes.add(rule.hash)
  }

  return Array.from(groups.values())
}

export function generateCSS(rules: CSSRule[]): string {
  const dedupedRules = deduplicateRules(rules)

  const regularRules: CSSRule[] = []
  const pseudoRules: CSSRule[] = []
  const mediaRules = new Map<string, CSSRule[]>()

  for (const rule of dedupedRules) {
    if (rule.media) {
      const existing = mediaRules.get(rule.media) || []
      existing.push(rule)
      mediaRules.set(rule.media, existing)
    } else if (rule.pseudo) {
      pseudoRules.push(rule)
    } else {
      regularRules.push(rule)
    }
  }

  const cssLines: string[] = []

  const regularGroups = groupRulesByDeclaration(regularRules)
  for (const group of regularGroups.sort((a, b) => a.declaration.localeCompare(b.declaration))) {
    const selectors = Array.from(group.hashes)
      .sort()
      .map((h) => `.${h}`)
      .join(',\n')
    cssLines.push(`${selectors} { ${group.declaration} }`)
  }

  const pseudoGroups = groupRulesByDeclaration(pseudoRules)
  for (const group of pseudoGroups.sort((a, b) => a.declaration.localeCompare(b.declaration))) {
    const selectors = Array.from(group.hashes)
      .sort()
      .map((h) => `.${h}${group.pseudo}`)
      .join(',\n')
    cssLines.push(`${selectors} { ${group.declaration} }`)
  }

  const sortedMediaQueries = Array.from(mediaRules.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  for (const [query, rules] of sortedMediaQueries) {
    const mediaGroups = groupRulesByDeclaration(rules)
    const mediaLines: string[] = []

    for (const group of mediaGroups.sort((a, b) => a.declaration.localeCompare(b.declaration))) {
      const suffix = group.pseudo || ''
      const selectors = Array.from(group.hashes)
        .sort()
        .map((h) => `.${h}${suffix}`)
        .join(',\n')
      mediaLines.push(`  ${selectors} { ${group.declaration} }`)
    }

    cssLines.push(`@media ${query} {\n${mediaLines.join('\n')}\n}`)
  }

  return cssLines.join('\n')
}
