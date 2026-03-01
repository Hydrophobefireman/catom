import type { ViteDevServer, HmrContext, ModuleNode } from "vite";
import { createFilter } from "vite";

import { generateCSS } from "../core/css-generator.js";
import { transformCode } from "./transform.js";
import type {
  CSSRule,
  CatomPluginOptions,
  ModuleCSSState,
} from "../core/types.js";

export type { CatomPluginOptions, CSSRule, CSSInput } from "../core/types.js";

const VIRTUAL_MODULE_ID = "virtual:catom.css";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

export default function catomPlugin(options: CatomPluginOptions = {}) {
  const {
    include = /\.[jt]sx?$/,
    exclude = /node_modules/,
    functionName = "css",
  } = options;

  const moduleCSS = new Map<string, ModuleCSSState>();
  let filter: (id: string) => boolean;
  let server: ViteDevServer | null = null;

  return {
    name: "vite-plugin-catom",

    enforce: "pre" as const,

    configureServer(devServer: ViteDevServer) {
      server = devServer;
    },

    configResolved() {
      filter = createFilter(include, exclude);
    },

    buildStart() {
      moduleCSS.clear();
    },

    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      return null;
    },

    load(id: string) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const allRules: CSSRule[] = [];
        for (const state of moduleCSS.values()) {
          allRules.push(...state.rules);
        }
        return generateCSS(allRules);
      }
      return null;
    },

    transform(code: string, id: string) {
      if (!filter(id)) return null;
      if (!code.includes(functionName + "(")) return null;

      const result = transformCode(code, id, functionName);
      if (!result.transformed) return null;

      moduleCSS.set(id, {
        rules: result.cssRules,
        timestamp: Date.now(),
      });

      return {
        code: result.code,
        map: null,
      };
    },

    handleHotUpdate(ctx: HmrContext) {
      if (!filter(ctx.file)) return;

      const hasOrHadCSS =
        moduleCSS.has(ctx.file) ||
        ctx.modules.some((m: ModuleNode) => moduleCSS.has(m.id || ""));

      if (hasOrHadCSS) {
        // Invalidate modules so they get re-transformed
        ctx.modules.forEach((mod: ModuleNode) => {
          server?.moduleGraph.invalidateModule(mod);
        });

        // Invalidate the virtual CSS module so it gets regenerated
        const virtualMod = server?.moduleGraph.getModuleById(
          RESOLVED_VIRTUAL_MODULE_ID,
        );
        if (virtualMod) {
          server?.moduleGraph.invalidateModule(virtualMod);
        }

        moduleCSS.delete(ctx.file);

        server?.ws.send({ type: "full-reload" });
        return [];
      }
    },
  };
}

// Also export as named export for flexibility
export { catomPlugin };
