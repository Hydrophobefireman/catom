import * as webpack from "webpack";

import { PrivateAtomicCSSOptions, defaultOptions, NAME } from "./constants";

import ConstDep from "webpack/lib/dependencies/ConstDependency";
import NullFactory from "webpack/lib/NullFactory";
import { handleJavascriptParser } from "./astHandler";

export class AtomicCssWebpackPlugin {
  options: PrivateAtomicCSSOptions;
  constructor(options?: PrivateAtomicCSSOptions) {
    this.options = Object.assign({}, options, defaultOptions);
  }
  apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(
      NAME,
      (compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(ConstDep, new NullFactory());
        compilation.dependencyTemplates.set(ConstDep, new ConstDep.Template());

        ["auto", "dynamic", "esm"].forEach((x) =>
          normalModuleFactory.hooks.parser
            .for(`javascript/${x}`)
            .tap(NAME, (parser) => handleJavascriptParser(parser, this.options))
        );
      }
    );
  }
}
