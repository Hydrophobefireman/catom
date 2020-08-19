import * as babel from "@babel/types";
import * as template from "@babel/template";
import { Visitor, NodePath } from "@babel/traverse";
import { parseObjectExpression } from "./plugin/astObject";

export default function catomBabelPlugin(): { visitor: Visitor } {
  let removeName = "css";
  return {
    visitor: {
      ImportDeclaration(decl) {
        if (decl.node.source.value === "catom") {
          const { specifiers } = decl.node;
          const spec = specifiers[0];
          if (spec.type === "ImportSpecifier") {
            removeName = spec.local.name;
          }
          decl.remove();
        }
      },
      ExportNamedDeclaration(path) {
        const node = path.node;
        const declaration = node.declaration;
        if (declaration) {
          if (declaration.type === "VariableDeclaration") {
            const kind = declaration.kind;
            _declarations(path, declaration.declarations, kind, removeName);
          }
        }
      },
      VariableDeclaration(path) {
        const { kind, declarations } = path.node;
        return _declarations(path, declarations, kind, removeName);
      },
      ExpressionStatement(path) {
        const expression = path.node.expression;
        if (expression && expression.type === "AssignmentExpression") {
          const { left, right } = expression;
          if (left.type === "Identifier" && right.type === "CallExpression") {
            return commonInject(path, left.name, right, "", removeName);
          }
        }
      },
    },
  };
}

function _declarations(
  path: NodePath<any>,
  x: babel.VariableDeclarator[],
  kind: string,
  name: string
) {
  x && x.forEach((d) => handleDeclaration(path, d, kind, name));
}

function handleDeclaration(
  path: NodePath<any>,
  d: babel.VariableDeclarator,
  kind: string,
  name: string
) {
  const { id, init } = d;
  if (id.type === "Identifier" && init) {
    const variableName = id.name;
    if (init.type === "CallExpression") {
      return commonInject(path, variableName, init, kind, name);
    }
  }
}

function commonInject(
  path: NodePath<any>,
  left: string,
  right: babel.CallExpression,
  kind: string,
  name: string
) {
  const callee = right.callee;
  if (callee && callee.type === "Identifier") {
    if (callee.name === name) {
      const arg0 = right.arguments[0];
      return injectDependency(path, left, arg0 as any, kind);
    }
  }
}

function injectDependency(
  path: NodePath<any>,
  left: string,
  arg0: babel.Expression | babel.SpreadElement,
  kind: string
) {
  if (arg0.type === "ObjectExpression") {
    let retArray: string[] = [];
    parseObjectExpression(arg0 as any, retArray);

    path.replaceWith(
      template.statement.ast(
        `/** __INJECTED STYLE__ */${kind} ${left} ${
          left ? "=" : ""
        } ${JSON.stringify(retArray.join(" "))}${kind ? ";" : ""}`
      )
    );
  }
}
