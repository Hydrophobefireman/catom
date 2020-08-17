import * as webpack from "webpack";
import { ObjectExpression, Expression, SpreadElement } from "estree";
import ConstDep from "webpack/lib/dependencies/ConstDependency";
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
    const value = JSON.parse(unparsed).trim();
    const uniqueCSSRule = `{key : ${this._toCssProp(value)};}`;
    const get = cssProperties.get(uniqueCSSRule);
    if (get) return get;
    const hash = murmur2(uniqueCSSRule);
    cssProperties.set(uniqueCSSRule, hash);
    return hash;
  }
  emitCSS() {
    return [...cssProperties.entries()]
      .map(([k, v]) => `\n.${k}${v};`)
      .join("\n");
  }
  parseObject(obj: ObjectExpression, clsArr: Array<string>) {
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
      if (key.type === "Identifier" && value.type === "Literal") {
        clsArr.push(this._createValueHash(key.name, value.raw));
      } else
        throw TypeError(
          "Catom only accepts literals and compile time constant values"
        );
    });
  }
  handler(parser: JavascriptParser) {
    parser.hooks.program.tap(name, (ast) => {
      ast.body.forEach((x) => {
        const _parseDecl = (left: string, arg0: Expression | SpreadElement) => {
          if (arg0.type !== "ObjectExpression") return;

          let clsArr: Array<string> = [];

          if (arg0.type === "ObjectExpression") {
            this.parseObject(arg0, clsArr);
            parser.state.current.addDependency(
              new ConstDep(
                `/** __INJECTED STYLE__ */
                const ${left} = ${JSON.stringify(clsArr.join(" "))}`,
                x.range
              )
            );
          }
        };

        if (x.type === "VariableDeclaration") {
          x.declarations.forEach((decl) => {
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
                _parseDecl(name, arg0);
              }
            }
          });
        } else if (
          x.type === "ExpressionStatement" &&
          x.expression.type === "AssignmentExpression"
        ) {
          const { right, left } = x.expression;

          if (
            left.type === "Identifier" &&
            right.type === "CallExpression" &&
            right.callee.type === "Identifier" &&
            right.callee.name === this.options.transpileFunctionName
          ) {
            const arg0 = right.arguments[0];
            _parseDecl(left.name, arg0);
          }
        }
      });
    });
  }
  apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(
      name,
      (_compilation, { normalModuleFactory }) => {
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
