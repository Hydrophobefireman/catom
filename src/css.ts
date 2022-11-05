import {transform} from "lightningcss";

import {emitCSS} from "./plugin/cssTransform";

export default async function transformCSS(css?: string, ...plugins: any) {
  css = css || emitCSS();
  const {code} = transform({
    code: Buffer.from(css),
    drafts: {customMedia: true, nesting: true},
    minify: true,
    filename: "style.css",
    sourceMap: false,
    // browserslist hardcoded
    // probably change or manually audit
    targets: {
      android: 6422528,
      chrome: 6488064,
      edge: 6488064,
      firefox: 6356992,
      ie: 720896,
      ios_saf: 983552,
      opera: 5439488,
      safari: 983552,
      samsung: 1048576,
    },
  });
  return code;
}

export function autoPrefixCSS(css?: string, ...plugins: any) {
  return transformCSS(css);
}

export {emitCSS};
