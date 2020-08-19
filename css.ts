const postCSS = require("postcss");
import { emitCSS } from "./plugin/cssTransform";
export default async function transformCSS(css?: string, ...plugins: any) {
  css = css || emitCSS();
  const result = await postCSS(...plugins).process(css);
  result.warnings().forEach((warn) => {
    console.warn(warn.toString());
  });
  return result.css;
}

export function autoPrefixCSS(css?: string, ...plugins: any) {
  return transformCSS(css, ...plugins.concat(require("autoprefixer")));
}

export { emitCSS };
