import * as webpack from "webpack";
import {
  ObjectExpression,
  Expression,
  SpreadElement,
  VariableDeclarator,
} from "estree";
import ConstDep from "webpack/lib/dependencies/ConstDependency";
import NullFactory from "webpack/lib/NullFactory";
import { murmur2 } from "./hash";

const name = "CreateAtomicCssWebpackPlugin";

type JavascriptParser = Parameters<
  typeof webpack.HotModuleReplacementPlugin.getParserHooks
>[0];
interface AtomicCssOptions {
  transpileFunctionName?: string;
}

const defaultOptions: AtomicCssOptions = { transpileFunctionName: "css" };

const KEBAB_CASE_REGEXP = /([a-z0-9]|(?=[A-Z]))([A-Z])/g;

const cssProperties = new Map<string, string>();

const PREFIX_WITH_UNDERSCORE = "1234567890-".split("");

export class CreateAtomicCssWebpackPlugin {
  options: AtomicCssOptions;
  constructor(options?: AtomicCssOptions) {
    this.options = Object.assign(options || {}, defaultOptions);
  }
  _toCssProp(prop: string): string {
    return prop.replace(KEBAB_CASE_REGEXP, "$1-$2").toLowerCase();
  }
  _createValueHash(key: string, unparsed: string): string {
    key = key.trim();
    const value = unparsed.trim();
    const uniqueCSSRule = `{${this._toCssProp(key)} : ${value};}`;
    const get = cssProperties.get(uniqueCSSRule);
    if (get) return get;
    let hash = murmur2(uniqueCSSRule);
    if (PREFIX_WITH_UNDERSCORE.includes(hash[0])) hash = `_${hash}`;
    cssProperties.set(uniqueCSSRule, hash);
    return hash;
  }
  emitCSS() {
    return [...cssProperties.entries()].map(([k, v]) => `.${v}${k}`).join("\n");
  }
  parseObject(obj: ObjectExpression, clsArr: Array<string>) {
    const rtrn: Record<string, string> = {};
    obj.properties.forEach((propertyOrSpread) => {
      if (propertyOrSpread.type === "SpreadElement") {
        if (propertyOrSpread.argument.type === "ObjectExpression") {
          return this.parseObject(propertyOrSpread.argument, clsArr);
        }
        throw Error(
          `Cannot parse ${propertyOrSpread.type}. Catom compiler only accepts compile time constant values`
        );
      }
      const { key, value } = propertyOrSpread;
      if (
        (key.type === "Identifier" || key.type === "Literal") &&
        value.type === "Literal"
      ) {
        const keyName = (key as any).name || (key as any).value;
        rtrn[keyName] = this._createValueHash(keyName, value.value as string);
      } else
        throw TypeError(
          "Catom only accepts literals and compile time constant values"
        );
    });
    clsArr.push(...Object.values(rtrn));
  }
  handler(parser: JavascriptParser) {
    parser.hooks.program.tap(name, (ast) => {
      ast.body.forEach((x) => {
        const _parseDecl = (
          left: string,
          arg0: Expression | SpreadElement,
          kind: string,
          range?: [number, number]
        ) => {
          if (arg0.type !== "ObjectExpression") return;

          let clsArr: Array<string> = [];

          if (arg0.type === "ObjectExpression") {
            this.parseObject(arg0, clsArr);

            parser.state.current.addDependency(
              new ConstDep(
                `/** __INJECTED STYLE__ */
                ${kind} ${left} ${left ? "=" : ""} ${JSON.stringify(
                  clsArr.join(" ")
                )}${kind ? ";" : ""}`,
                range || x.range
              )
            );
          }
        };

        const transformDeclaration = (
          decl: VariableDeclarator,
          kind: string
        ) => {
          const { id, init } = decl;
          if (id.type === "Identifier" && init) {
            const name = id.name;
            if (
              init.type === "CallExpression" &&
              init.callee &&
              init.callee.type === "Identifier" &&
              init.callee.name === this.options.transpileFunctionName
            ) {
              const arg0 = init.arguments[0];
              _parseDecl(name, arg0, kind);
            }
          }
        };
        switch (x.type) {
          case "ExportNamedDeclaration":
          case "VariableDeclaration":
            const array =
              x.type === "VariableDeclaration"
                ? x.declarations
                : x.declaration && x.declaration.type === "VariableDeclaration"
                ? x.declaration.declarations
                : null;
            if (!array) return;
            const kind =
              "kind" in x
                ? x.kind
                : x.declaration.type === "VariableDeclaration"
                ? x.declaration.kind
                : "";
            array.forEach((a) => transformDeclaration(a, kind));

            break;
          case "ExportDefaultDeclaration":
          case "ExpressionStatement":
            const expression = "expression" in x ? x.expression : x.declaration;
            if (expression.type === "AssignmentExpression") {
              const { right, left } = expression;

              if (
                left.type === "Identifier" &&
                right.type === "CallExpression" &&
                right.callee.type === "Identifier" &&
                right.callee.name === this.options.transpileFunctionName
              ) {
                const arg0 = right.arguments[0];
                _parseDecl(left.name, arg0, "");
              }
            } else if (expression.type === "CallExpression") {
              const callee = expression.callee;

              if (
                callee.type === "Identifier" &&
                callee.name === this.options.transpileFunctionName
              ) {
                _parseDecl("", expression.arguments[0], "", expression.range);
              }
            }
            break;
        }
      });
    });
  }
  apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(
      name,
      (compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(ConstDep, new NullFactory());
        compilation.dependencyTemplates.set(ConstDep, new ConstDep.Template());
        const method = this.handler.bind(this);
        ["auto", "dynamic", "esm"].forEach((x) =>
          normalModuleFactory.hooks.parser
            .for(`javascript/${x}`)
            .tap(name, method)
        );
      }
    );
  }
}
