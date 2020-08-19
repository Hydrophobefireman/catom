import * as babel from "@babel/types";
import * as template from "@babel/template";
import { Visitor, NodePath } from "@babel/traverse";
import { parseObjectExpression } from "./plugin/astObject";

interface InternalOpts {
  kind: string;
  name: string;
  isExport: boolean;
}

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
            _declarations(path, declaration.declarations, {
              kind,
              name: removeName,
              isExport: true,
            });
          }
        }
      },
      VariableDeclaration(path) {
        const { kind, declarations } = path.node;
        return _declarations(path, declarations, {
          kind,
          name: removeName,
          isExport: false,
        });
      },
      ExpressionStatement(path) {
        const expression = path.node.expression;
        if (expression && expression.type === "AssignmentExpression") {
          const { left, right } = expression;
          if (left.type === "Identifier" && right.type === "CallExpression") {
            return commonInject(path, left.name, right, {
              kind: "",
              name: removeName,
              isExport: false,
            });
          }
        }
      },
    },
  };
}

function _declarations(
  path: NodePath<any>,
  x: babel.VariableDeclarator[],
  options: InternalOpts
) {
  x && x.forEach((d) => handleDeclaration(path, d, options));
}

function handleDeclaration(
  path: NodePath<any>,
  d: babel.VariableDeclarator,
  options: InternalOpts
) {
  const { id, init } = d;
  if (id.type === "Identifier" && init) {
    const variableName = id.name;
    if (init.type === "CallExpression") {
      return commonInject(path, variableName, init, options);
    }
  }
}

function commonInject(
  path: NodePath<any>,
  left: string,
  right: babel.CallExpression,
  options: InternalOpts
) {
  const callee = right.callee;
  if (callee && callee.type === "Identifier") {
    if (callee.name === options.name) {
      const arg0 = right.arguments[0];
      return injectDependency(path, left, arg0 as any, options);
    }
  }
}

function injectDependency(
  path: NodePath<any>,
  left: string,
  arg0: babel.Expression | babel.SpreadElement,
  options: InternalOpts
) {
  const { kind, isExport } = options;
  if (arg0.type === "ObjectExpression") {
    let retArray: string[] = [];
    parseObjectExpression(arg0 as any, retArray);

    path.replaceWith(
      template.statement.ast(
        `/**INJECTED STYLE*/
        ${
          isExport ? "/**ESM_EXPORT**/export" : "/**VARIABLE DECLARATION**/"
        } ${kind} ${left} ${left ? "=" : ""} ${JSON.stringify(
          retArray.join(" ")
        )}${kind ? ";" : ""}`,
        { preserveComments: true }
      )
    );
  }
}
