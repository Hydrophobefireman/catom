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
import { css } from ".";

const name = "AtomicCssWebpackPlugin";

type JavascriptParser = Parameters<
  typeof webpack.HotModuleReplacementPlugin.getParserHooks
>[0];
interface AtomicCssOptions {
  transpileFunctionName?: string;
}

const defaultOptions: AtomicCssOptions = { transpileFunctionName: "css" };

const KEBAB_CASE_REGEXP = /([a-z0-9]|(?=[A-Z]))([A-Z])/g;

interface CSSProps {
  class: string;
  cssRule: string;
}

const cssProperties = new Map<string, CSSProps>();

const mediaQueries = new Map<string, Map<string, CSSProps>>();

const PREFIX_WITH_UNDERSCORE = "1234567890-".split("");

export class AtomicCssWebpackPlugin {
  options: AtomicCssOptions;
  constructor(options?: AtomicCssOptions) {
    this.options = Object.assign(options || {}, defaultOptions);
  }
  _toCssProp(prop: string): string {
    return prop.replace(KEBAB_CASE_REGEXP, "$1-$2").toLowerCase();
  }
  _createValueHash(
    key: string,
    unparsed: string | number,
    media?: string
  ): string {
    key = key.trim();
    const value = String(unparsed).trim();
    const cssRule = `{${this._toCssProp(key)} : ${value};}`;
    const hashObj = (media || "").trim() + cssRule;
    let cssProps = media && mediaQueries.get(media);
    let get: CSSProps;
    if (media) {
      if (cssProps) get = cssProps.get(cssRule);
    } else get = cssProperties.get(hashObj);
    if (get) return get.class;
    let hash = murmur2(hashObj);
    if (PREFIX_WITH_UNDERSCORE.includes(hash[0])) hash = `_${hash}`;

    const setVal = { class: hash, cssRule };
    if (media) {
      if (!cssProps) {
        cssProps = new Map<string, CSSProps>();
        mediaQueries.set(media, cssProps);
      }
      cssProps.set(hashObj, setVal);
    } else {
      cssProperties.set(hashObj, setVal);
    }
    return hash;
  }

  parseObject(obj: ObjectExpression, clsArr: Array<string>, media?: string) {
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
        (value.type === "Literal" || value.type === "ObjectExpression")
      ) {
        const keyName = (key as any).name || (key as any).value;
        if (keyName === "media") {
          if (value.type === "ObjectExpression") {
            value.properties.forEach((mediaQuery) => {
              if (mediaQuery.type === "Property") {
                const { key, value } = mediaQuery;
                if (key.type === "Literal" || key.type === "Identifier") {
                  if (value.type === "ObjectExpression") {
                    const query = (key.type === "Literal"
                      ? key.value
                      : key.name) as string;
                    return this.parseObject(value, clsArr, query);
                  }
                }
              }
            });
          }
        } else {
          if (value.type === "ObjectExpression")
            throw new TypeError("Objects only excepted in media queries");
          clsArr.push(
            this._createValueHash(
              keyName,
              value.value as string | number,
              media
            )
          );
        }
      } else
        throw TypeError(
          "Catom only accepts literals and compile time constant values"
        );
    });
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

export function emitCSS(): string {
  const toCSS = (m: Map<string, CSSProps>) =>
    [...m.values()].map((v) => `.${v.class}${v.cssRule}`).join("\n");

  return (
    toCSS(cssProperties) +
    [...mediaQueries.entries()]
      .map(([k, v]) => {
        return `@media ${k}{\n${toCSS(v)}\n}\n`;
      })
      .join("\n")
  );
}
