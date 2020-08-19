export { Program } from "estree";

export type PropMap = Map<string, CSSProps>;

export interface AtomicCSSOptions {
  transpileFunctionName: "css";
}

export interface CSSProps {
  class: string;
  cssRule: string;
}
export interface Hashable {
  media?: string;
  pseudo?: string;
}

export const NAME = "AtomicCssWebpackPlugin";

export const defaultOptions: AtomicCSSOptions = {
  transpileFunctionName: "css",
};

export const KEBAB_CASE_REGEXP = /([a-z0-9]|(?=[A-Z]))([A-Z])/g;

export const PREFIX_WITH_UNDERSCORE = "1234567890-".split("");
