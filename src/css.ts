const postCSS = require("postcss");

import { MapObj } from "./plugin/constants";
import { emitCSS } from "./plugin/cssTransform";
export default async function transformCSS(maps: MapObj, ...plugins: any) {
  const css = emitCSS(maps);
  const result = await postCSS(...plugins).process(css);
  result.warnings().forEach((warn) => {
    console.warn(warn.toString());
  });
  return result.css;
}

export function autoPrefixCSS(maps: MapObj, ...plugins: any) {
  return transformCSS(maps, ...plugins.concat(require("autoprefixer")));
}

export { emitCSS };
