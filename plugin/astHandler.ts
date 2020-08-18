import { PrivateAtomicCSSOptions, JavascriptParser, NAME } from "./constants";
import {
  ExportNamedDeclaration,
  Expression,
  Program,
  SpreadElement,
  VariableDeclaration,
  Directive,
  SimpleCallExpression,
  ExpressionStatement,
  VariableDeclarator,
} from "estree";

import ConstDep from "webpack/lib/dependencies/ConstDependency";
import { parseObjectExpression } from "./astObject";

export function handleJavascriptParser(
  _parser: JavascriptParser,
  options: PrivateAtomicCSSOptions
) {
  _parser.hooks.program.tap(NAME, (p) =>
    tapJSParser(p, { ...options, _parser })
  );
}

function tapJSParser(ast: Program, options: PrivateAtomicCSSOptions) {
  ast.body.forEach((x) => handleAst(x, { ...options, _range: x.range }));
}

function handleAst(x: Program["body"][0], options: PrivateAtomicCSSOptions) {
  switch (x.type) {
    case "ExportNamedDeclaration":
      return handleExportNamedDeclaration(x, options);
    case "VariableDeclaration":
      return handleVariableDeclaration(x, options);
    //   case "ExportDefaultDeclaration":
    case "ExpressionStatement":
      return handleExpressionStatement(x, options);
  }
}

function handleExportNamedDeclaration(
  x: ExportNamedDeclaration,
  options: PrivateAtomicCSSOptions
) {
  const declaration = x.declaration;
  if (declaration && declaration.type === "VariableDeclaration") {
    const decls = declaration.declarations;
    _declarationHandler(decls, declaration.kind, options);
  }
}

function handleVariableDeclaration(
  x: VariableDeclaration,
  options: PrivateAtomicCSSOptions
) {
  const { kind, declarations } = x;
  return _declarationHandler(declarations, kind, options);
}

function handleExpressionStatement(
  x: Directive | ExpressionStatement,
  options: PrivateAtomicCSSOptions
) {
  const expression = x.expression;
  if (expression && expression.type === "AssignmentExpression") {
    const { left, right } = expression;
    if (left.type === "Identifier" && right.type === "CallExpression") {
      return commonInject(left.name, right, "", options);
    }
  }
}

function handleDeclaration(
  d: VariableDeclarator,
  kind: string,
  options: PrivateAtomicCSSOptions
) {
  const { id, init } = d;
  if (id.type === "Identifier" && init) {
    const name = id.name;
    if (init.type === "CallExpression") {
      return commonInject(name, init, kind, options);
    }
  }
}
function commonInject(
  left: string,
  right: SimpleCallExpression,
  kind: string,
  options: PrivateAtomicCSSOptions
) {
  const callee = right.callee;
  if (callee && callee.type === "Identifier") {
    if (callee.name === options.transpileFunctionName) {
      const arg0 = right.arguments[0];
      return injectDependency(left, arg0, kind, options);
    }
  }
}
function _declarationHandler(
  decls: VariableDeclarator[],
  kind: string,
  options: PrivateAtomicCSSOptions
) {
  return decls && decls.forEach((d) => handleDeclaration(d, kind, options));
}

function injectDependency(
  left: string,
  arg0: Expression | SpreadElement,
  kind: string,
  options: PrivateAtomicCSSOptions
) {
  if (arg0.type === "ObjectExpression") {
    let retArray: string[] = [];
    const parser = options._parser;
    parseObjectExpression(arg0, retArray);
    parser.state.current.addDependency(
      new ConstDep(
        `/** __INJECTED STYLE__ */${kind} ${left} ${
          left ? "=" : ""
        } ${JSON.stringify(retArray.join(" "))}${kind ? ";" : ""}`,
        options._range
      )
    );
  }
}
