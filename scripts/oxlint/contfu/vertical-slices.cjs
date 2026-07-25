"use strict";

const { posix } = require("node:path");

const BACKEND_FEATURE_MARKER = "/packages/service/backend/src/features/";
const CONTFU_FEATURE_MARKER = "/packages/contfu/src/features/";

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function featureLocation(filename) {
  const normalized = normalizePath(filename);
  for (const [packageName, marker] of [
    ["backend", BACKEND_FEATURE_MARKER],
    ["contfu", CONTFU_FEATURE_MARKER],
  ]) {
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex === -1) continue;
    const relativePath = normalized.slice(markerIndex + marker.length);
    return {
      packageName,
      marker,
      normalized,
      relativePath,
      slice: relativePath.split("/")[0],
    };
  }
  return null;
}

function isSpecFile(filename) {
  return /\.spec\.[cm]?[jt]sx?$/.test(filename);
}

function importedFeatureSlice(location, source) {
  const aliases = {
    backend: "@contfu/svc-backend/features/",
    contfu: "@contfu/contfu/features/",
  };
  const alias = aliases[location.packageName];
  if (source.startsWith(alias)) return source.slice(alias.length).split("/")[0];
  if (!source.startsWith(".")) return null;

  const resolved = posix.normalize(posix.join(posix.dirname(location.normalized), source));
  const match = resolved.match(/\/packages\/(?:service\/backend|contfu)\/src\/features\/([^/]+)/);
  return match?.[1] ?? null;
}

function importSource(node) {
  return node.source?.type === "Literal" && typeof node.source.value === "string"
    ? node.source.value
    : null;
}

function exportedCallableNames(node) {
  const declaration = node.declaration;
  if (declaration?.type === "FunctionDeclaration") {
    return declaration.id ? [declaration.id.name] : [];
  }
  if (declaration?.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((item) =>
      item.id.type === "Identifier" &&
      (item.init?.type === "ArrowFunctionExpression" || item.init?.type === "FunctionExpression")
        ? [item.id.name]
        : [],
    );
  }
  if (!declaration && node.exportKind !== "type") {
    return node.specifiers
      .filter((specifier) => specifier.exportKind !== "type")
      .map((specifier) => specifier.exported.name ?? specifier.exported.value);
  }
  return [];
}

module.exports = {
  "no-cross-slice-imports": {
    meta: {
      type: "problem",
      docs: { description: "Disallow imports between vertical feature slices." },
      messages: {
        crossSlice:
          "VSA: the `{{from}}` slice must not import the `{{to}}` slice. Move shared behavior to domain/, shared/, or infra/, then import it directly.",
      },
    },
    create(context) {
      const location = featureLocation(context.filename);
      if (!location || isSpecFile(location.normalized)) return {};
      return {
        ImportDeclaration(node) {
          const source = importSource(node);
          if (!source) return;
          const importedSlice = importedFeatureSlice(location, source);
          if (!importedSlice || importedSlice === location.slice) return;
          context.report({
            node,
            messageId: "crossSlice",
            data: { from: location.slice, to: importedSlice },
          });
        },
      };
    },
  },

  "one-feature-export-per-module": {
    meta: {
      type: "problem",
      docs: { description: "Require every exported feature function to have its own module." },
      messages: {
        multipleFeatures:
          "VSA: a feature module may export only one callable feature. Move `{{name}}` to its own directly imported module.",
      },
    },
    create(context) {
      const location = featureLocation(context.filename);
      if (!location || isSpecFile(location.normalized)) return {};
      const exports = [];
      return {
        ExportNamedDeclaration(node) {
          for (const name of exportedCallableNames(node)) exports.push({ name, node });
        },
        "Program:exit"() {
          for (const exported of exports.slice(1)) {
            context.report({
              node: exported.node,
              messageId: "multipleFeatures",
              data: { name: exported.name },
            });
          }
        },
      };
    },
  },
};
