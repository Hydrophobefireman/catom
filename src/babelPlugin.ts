import { join } from "path";

import { writeFile } from "fs/promises";

import type { PluginItem } from "@babel/core";
import * as template from "@babel/template";
import { NodePath } from "@babel/traverse";
import * as babel from "@babel/types";

import { emitCSS } from "./css";
import { parseObjectExpression } from "./plugin/astObject";
import { MapObj, PropMap } from "./plugin/constants";

interface InternalOpts {
  name: string;
  mapObj: MapObj;
}

function handleExpression(
  path: NodePath<any>,
  expression: babel.Expression,
  removeName: string,
  mapObj: MapObj
) {
  if (!expression) return;
  if (expression.type === "CallExpression") {
    return commonInject(path, expression, {
      name: removeName,
      mapObj,
    });
  }
}
export default function catomBabelPlugin(): PluginItem {
  let removeName = "css";
  const cssPropertyMap = new Map() as PropMap;
  const mediaQueryMap = new Map<string, PropMap>();
  const pseudoSelectorMap = new Map<string, PropMap>();

  const mapObj: MapObj = {
    cssPropertyMap: cssPropertyMap,
    mediaQueryMap: mediaQueryMap,
    pseudoSelectorMap: pseudoSelectorMap,
  };
  let last: string;
  return {
    post() {
      const css = emitCSS(mapObj);
      if (css == last) return;
      last = css;
      if (!this.__emitFile) return;
      const f = join("./", this.__emitFile);
      writeFile(f, css);
    },
    visitor: {
      Program(_, state) {
        if (!(state?.opts as any).emitFile)
          throw new Error("No emit file provided!");

        this.__emitFile = this.__emitFile || (state.opts as any).emitFile;
      },
      CallExpression(path) {
        return handleExpression(path, path.node, removeName, mapObj);
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
      return injectDependency(path, arg0 as any, options.mapObj);
    }
  }
}

function injectDependency(
  path: NodePath<any>,
  arg0: babel.Expression | babel.SpreadElement,
  mapObj: MapObj
) {
  if (arg0.type === "ObjectExpression") {
    let retArray: string[] = [];
    parseObjectExpression(arg0 as any, retArray, null, mapObj);
    path.replaceWith(
      template.statement.ast(JSON.stringify(retArray.join(" ")))
    );
  }
}
