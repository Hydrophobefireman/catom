import {
  CSSProps,
  Hashable,
  KEBAB_CASE_REGEXP,
  PREFIX_WITH_UNDERSCORE,
  PropMap,
} from "./constants";

import { murmur2 } from "./hash";

const CSS_PROPERTY_MAP: PropMap = new Map();
const MEDIA_QUERY_MAP = new Map<string, PropMap>();
const PSEUDO_SELECTOR_MAP = new Map<string, PropMap>();

// function clearMaps(): void {
//   CSS_PROPERTY_MAP.clear();
//   MEDIA_QUERY_MAP.clear();
//   PSEUDO_SELECTOR_MAP.clear();
// }

function toCSSProp(prop: string): string {
  return prop.replace(KEBAB_CASE_REGEXP, "$1-$2").toLowerCase();
}

function makeCSSCompat(str: string): string {
  if (PREFIX_WITH_UNDERSCORE.indexOf(str[0]) > -1) return `_${str}`;
  return str;
}

export function createValueHash(
  key: string,
  unparsed: string | number,
  left: string,
  hashable?: Hashable
) {
  key = key.trim();
  const value = String(unparsed).trim();
  const MEDIA_QUERY = hashable && hashable.media;
  const PSEUDO_SELECTOR = hashable && hashable.pseudo;
  const isSpec = MEDIA_QUERY || PSEUDO_SELECTOR;
  // example: const rawCSSRule  = "margin:auto;"
  let prefix = "";
  if (process.env.NODE_ENV !== "production")
    prefix = `${left || ""}_____`;
  const rawCSSRule = `${toCSSProp(key)}:${value};`;

  // a unique rule will be one with a different media/pseudo rule + key&value
  const identity =
    ((hashable && (MEDIA_QUERY || PSEUDO_SELECTOR)) || "").trim() + rawCSSRule;

  let cache: CSSProps;
  const $map = isSpec && MEDIA_QUERY ? MEDIA_QUERY_MAP : PSEUDO_SELECTOR_MAP;
  let fetchMap: PropMap;
  if ($map) {
    fetchMap = $map.get(isSpec);
    if (!fetchMap) {
      fetchMap = new Map();
      $map.set(isSpec, fetchMap);
    }
  }
  if (isSpec) {
    cache = fetchMap.get(identity);
  } else {
    cache = CSS_PROPERTY_MAP.get(identity);
  }
  if (cache) return cache.class;

  const hash = prefix + makeCSSCompat(murmur2(identity));

  const obj: CSSProps = { class: hash, cssRule: rawCSSRule };

  if (isSpec) {
    fetchMap.set(identity, obj);
  } else {
    CSS_PROPERTY_MAP.set(identity, obj);
  }
  return hash;
}

const toCSS = (m: Map<string, CSSProps>) =>
  [...m.values()].map((v) => `.${v.class} { ${v.cssRule} }`).join("\n");
export function emitCSS(): string {
  const cssProps = toCSS(CSS_PROPERTY_MAP);
  const pseudoProps = [...PSEUDO_SELECTOR_MAP.entries()].map(([k, v]) =>
    [...v.values()].map(($) => `.${$.class}${k} { ${$.cssRule} }`).join("\n")
  );
  const mediaQueries = [...MEDIA_QUERY_MAP.entries()]
    .map(([k, v]) => `@media ${k} {\n${toCSS(v)}\n}\n`)
    .join("\n");

  return [cssProps].concat(pseudoProps, mediaQueries).join("\n");
}
