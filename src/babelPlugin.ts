import * as babel from "@babel/types";
import * as template from "@babel/template";
import { Visitor, NodePath } from "@babel/traverse";
import { parseObjectExpression } from "./plugin/astObject";

interface InternalOpts {
  name: string;
}

function handleExpression(
  path: NodePath<any>,
  expression: babel.Expression,
  removeName: string
) {
  if (!expression) return;
  if (expression.type === "CallExpression") {
    return commonInject(path, expression, {
      name: removeName,
    });
  }
}
export default function catomBabelPlugin(): { visitor: Visitor } {
  let removeName = "css";
  return {
    visitor: {
      CallExpression(path) {
        return handleExpression(path, path.node, removeName);
      },
    },
  };
}

function commonInject(
  path: NodePath<any>,
  right: babel.CallExpression,
  options: InternalOpts
) {
  const callee = right.callee;
  if (callee && callee.type === "Identifier") {
    if (callee.name === options.name) {
      const arg0 = right.arguments[0];
      return injectDependency(path, arg0 as any);
    }
  }
}

function injectDependency(
  path: NodePath<any>,
  arg0: babel.Expression | babel.SpreadElement
) {
  if (arg0.type === "ObjectExpression") {
    let retArray: string[] = [];
    parseObjectExpression(arg0 as any, retArray);
    path.replaceWith(
      template.statement.ast(JSON.stringify(retArray.join(" ")))
    );
  }
}
