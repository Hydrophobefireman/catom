import type { Properties } from 'csstype'

export interface CSSPropertiesWithPseudo extends Properties {
  pseudo?: { [selector: string]: Properties }
}

export interface CSSInput extends Properties {
  media?: { [query: string]: CSSPropertiesWithPseudo }
  pseudo?: { [selector: string]: Properties }
}

export function css(_styles: CSSInput): string {
  throw new Error(
    '[catom] css() was called at runtime. ' +
      'This usually means the catom vite plugin is not configured correctly. ' +
      'Make sure to add the plugin to your vite.config.ts: import catom from "catom/vite"'
  )
}

export type { Properties as CSSProperties } from 'csstype'
