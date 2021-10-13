import {
  CSSProps,
  Hashable,
  KEBAB_CASE_REGEXP,
  MapObj,
  PREFIX_WITH_UNDERSCORE,
  PropMap,
} from "./constants";
import { murmur2 } from "./hash";

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
  hashable: Hashable,
  { mediaQueryMap, pseudoSelectorMap, cssPropertyMap }: MapObj
) {
  key = key.trim();
  const value = String(unparsed).trim();
  const isMediaQuery = hashable && hashable.media;
  const PSEUDO_SELECTOR = hashable && hashable.pseudo;
  const isSpec = isMediaQuery || PSEUDO_SELECTOR;
  // example: const rawCSSRule  = "margin:auto;"
  let prefix = "";
  const rawCSSRule = `${toCSSProp(key)}:${value};`;
  if (process.env.NODE_ENV !== "production")
    prefix = `${rawCSSRule.replace(sanitizeRegExp, "_")}____`;

  // a unique rule will be one with a different media/pseudo rule + key&value
  const identity =
    ((hashable && (isMediaQuery || PSEUDO_SELECTOR)) || "").trim() + rawCSSRule;

  let cache: CSSProps;
  const $map = isSpec && isMediaQuery ? mediaQueryMap : pseudoSelectorMap;
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
    cache = cssPropertyMap.get(identity);
  }
  if (cache) return cache.class;

  const hash = prefix + makeCSSCompat(murmur2(identity));

  const obj: CSSProps = { class: hash, cssRule: rawCSSRule };

  if (isSpec) {
    fetchMap.set(identity, obj);
  } else {
    cssPropertyMap.set(identity, obj);
  }
  return hash;
}

const toCSS = (m: Map<string, CSSProps>) =>
  Array.from(m.values())
    .map((v) => `.${v.class} { ${v.cssRule} }`)
    .sort()
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

export function emitCSS({
  mediaQueryMap,
  pseudoSelectorMap,
  cssPropertyMap,
}: MapObj): string {
  const dedupedPropMap = new Map<string, Set<string>>();

  Array.from(cssPropertyMap.values()).forEach((v) =>
    mergeDuplicateRules(v, dedupedPropMap)
  );
  Array.from(pseudoSelectorMap.entries()).forEach(([k, v]) =>
    Array.from(v.values())
      .sort()
      .forEach((prop) => mergeDuplicateRules(prop, dedupedPropMap, k))
  );

  const mediaQueries = Array.from(mediaQueryMap.entries())
    .map(([k, v]) => `@media ${k} {\n${toCSS(v)}\n}\n`)
    .sort()
    .join("\n");
  const cssProps = Array.from(dedupedPropMap.entries())
    .map(
      ([rule, classNames]) => `${Array.from(classNames).join(",\n")}{ ${rule} }`
    )
    .sort()
    .join("\n");
  return [cssProps, mediaQueries].join("\n");
}
