"use strict";

const BACKEND_INFRA_DB_PREFIX = "@contfu/svc-backend/infra/db";
const APP_SRC_MARKER = "/packages/service/app/src/";

function importSource(node) {
  if (node.source?.type === "Literal" && typeof node.source.value === "string") {
    return node.source.value;
  }
  return null;
}

function isBackendInfraDbImport(source) {
  return source === BACKEND_INFRA_DB_PREFIX || source.startsWith(`${BACKEND_INFRA_DB_PREFIX}/`);
}

function isRestrictedAppFile(filename) {
  const normalized = filename.replaceAll("\\", "/");
  const markerIndex = normalized.indexOf(APP_SRC_MARKER);
  if (markerIndex === -1) return false;

  const relativePath = normalized.slice(markerIndex + APP_SRC_MARKER.length);
  if (relativePath.startsWith("lib/server/")) return false;

  return relativePath.startsWith("lib/remote/") || relativePath.startsWith("routes/");
}

module.exports = {
  "no-backend-infra-db-import": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow @contfu/svc-backend/infra/db imports from svc-app remote functions and routes.",
      },
      messages: {
        noImport:
          "Do not import `@contfu/svc-backend/infra/db` from svc-app remote functions or routes. Call a @contfu/svc-backend/features/* function (#421) or use lib/server bootstrap code instead.",
      },
    },
    create(context) {
      if (!isRestrictedAppFile(context.filename)) {
        return {};
      }

      return {
        ImportDeclaration(node) {
          const source = importSource(node);
          if (source && isBackendInfraDbImport(source)) {
            context.report({ node, messageId: "noImport" });
          }
        },
      };
    },
  },
};
