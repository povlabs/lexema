// The module hook of the flight process (rscFlight.tsx), loaded with
// `--import` after tsx. Each `"use client"` module, once tsx has compiled it,
// is replaced by client references to its exports, as the build's RSC plugin
// replaces it: the server render never runs a client component, and passes its
// props into the flight stream instead. The replacement is the one React's own
// Node loader (`react-server-dom-webpack/node-loader`) writes; that loader
// cannot be chained after tsx, whose hooks wrap every hook registered with
// `module.register`, so this one runs in-thread, outside tsx.

import { createRequire, registerHooks } from "node:module";

const require = createRequire(import.meta.url);
const fromRsc = createRequire(require.resolve("react-server-dom-webpack/package.json"));
const { parse } = fromRsc(fromRsc.resolve("acorn-loose"));

/** Whether a module's directive prologue says `"use client"`. */
function isClientModule(program) {
  for (const node of program.body) {
    if (node.type !== "ExpressionStatement" || node.directive === undefined) return false;
    if (node.directive === "use client") return true;
  }
  return false;
}

/** The names a compiled module exports. */
function exportNames(program, url) {
  const names = [];
  for (const node of program.body) {
    if (node.type === "ExportDefaultDeclaration") names.push("default");
    if (node.type === "ExportAllDeclaration") throw new Error(`${url}: a client module re-exports with export *`);
    if (node.type !== "ExportNamedDeclaration") continue;
    const declaration = node.declaration;
    if (declaration?.type === "VariableDeclaration") for (const { id } of declaration.declarations) names.push(id.name);
    else if (declaration) names.push(declaration.id.name);
    for (const specifier of node.specifiers) names.push(specifier.exported.name ?? specifier.exported.value);
  }
  return names;
}

function clientReferences(names, url) {
  let source = 'import { registerClientReference } from "react-server-dom-webpack/server";\n';
  for (const name of names) {
    const reference = `registerClientReference(function () { throw new Error(${JSON.stringify(`${name} is on the client`)}); }, ${JSON.stringify(url)}, ${JSON.stringify(name)})`;
    source += name === "default" ? `export default ${reference};\n` : `export const ${name} = ${reference};\n`;
  }
  return source;
}

registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (loaded.format !== "module" || loaded.source == null || !url.startsWith("file:")) return loaded;
    const text = typeof loaded.source === "string" ? loaded.source : Buffer.from(loaded.source).toString("utf8");
    if (!text.includes("use client")) return loaded;
    const program = parse(text, { ecmaVersion: "latest", sourceType: "module" });
    if (!isClientModule(program)) return loaded;
    return { ...loaded, source: clientReferences(exportNames(program, url), url) };
  },
});
