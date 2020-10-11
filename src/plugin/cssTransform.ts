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
const sanitizeRegExp = /([^\w]|_)/g;

export function createValueHash(
  key: string,
  unparsed: string | number,
  hashable?: Hashable
) {
  key = key.trim();
  const value = String(unparsed).trim();
  const MEDIA_QUERY = hashable && hashable.media;
  const PSEUDO_SELECTOR = hashable && hashable.pseudo;
  const isSpec = MEDIA_QUERY || PSEUDO_SELECTOR;
  // example: const rawCSSRule  = "margin:auto;"
  let prefix = "";
  const rawCSSRule = `${toCSSProp(key)}:${value};`;
  if (process.env.NODE_ENV !== "production")
    prefix = `${rawCSSRule.replace(sanitizeRegExp, "_")}____`;

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
  Array.from(m.values())
    .map((v) => `.${v.class} { ${v.cssRule} }`)
    .join("\n");

function mergeDuplicateRules(
  value: CSSProps,
  dedupedPropMap: Map<string, Set<string>>,
  suffix: string = ""
) {
  const cls = `.${value.class}${suffix}`;
  const rule = value.cssRule;
  let arr = dedupedPropMap.get(rule);
  if (!arr) {
    arr = new Set<string>();
    dedupedPropMap.set(rule, arr);
  }
  arr.add(cls);
}

export function emitCSS(): string {
  const dedupedPropMap = new Map<string, Set<string>>();

  Array.from(CSS_PROPERTY_MAP.values()).forEach((v) =>
    mergeDuplicateRules(v, dedupedPropMap)
  );
  Array.from(PSEUDO_SELECTOR_MAP.entries()).forEach(([k, v]) =>
    Array.from(v.values()).forEach((prop) =>
      mergeDuplicateRules(prop, dedupedPropMap, k)
    )
  );

  const mediaQueries = Array.from(MEDIA_QUERY_MAP.entries())
    .map(([k, v]) => `@media ${k} {\n${toCSS(v)}\n}\n`)
    .join("\n");
  const cssProps = Array.from(dedupedPropMap.entries())
    .map(
      ([rule, classNames]) => `${Array.from(classNames).join(",\n")}{ ${rule} }`
    )
    .join("\n");
  return [cssProps, mediaQueries].join("\n");
}
