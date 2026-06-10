"use strict";

const NUMERIC_ENUM_HELPER_NAMES = new Set(["defineEnum"]);
const STRING_ENUM_HELPER_NAMES = new Set(["defineStringEnum"]);

function literalValue(node) {
  if (!node) return undefined;
  if (node.type === "Literal") return node.value;
  if (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument?.type === "Literal"
  ) {
    return typeof node.argument.value === "number" ? -node.argument.value : undefined;
  }
  return undefined;
}

function calleeName(node) {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "MemberExpression" && !node.computed && node.property?.type === "Identifier") {
    return node.property.name;
  }
  return undefined;
}

function propertyName(node) {
  if (!node) return "property";
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal") return String(node.value);
  return "property";
}

function firstObjectArgument(node) {
  const argument = node.arguments?.[0];
  return argument?.type === "ObjectExpression" ? argument : undefined;
}

module.exports = {
  "no-typescript-enum": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow TypeScript enum declarations. Use enum helper const objects instead.",
      },
      messages: {
        noEnum:
          "Use defineEnum(...) or defineStringEnum(...) instead of a TypeScript enum declaration.",
      },
    },
    create(context) {
      return {
        TSEnumDeclaration(node) {
          context.report({ node, messageId: "noEnum" });
        },
      };
    },
  },

  "prefer-enum-helper": {
    meta: {
      type: "problem",
      docs: {
        description: "Require enum-like type aliases to use EnumValue<typeof Name>.",
      },
      messages: {
        preferHelper:
          "Use defineEnum(...) or defineStringEnum(...) and `EnumValue<typeof {{name}}>` for enum-like values.",
      },
    },
    create(context) {
      return {
        Program(node) {
          const text = context.sourceCode.text;
          const aliasPattern =
            /export\s+type\s+([A-Za-z_$][\w$]*)\s*=\s*\(\s*typeof\s+\1\s*\)\s*\[\s*keyof\s+typeof\s+\1\s*\]\s*;?/g;
          for (const match of text.matchAll(aliasPattern)) {
            context.report({
              node,
              message: `Use defineEnum(...) or defineStringEnum(...) and \`EnumValue<typeof ${match[1]}>\` for enum-like values.`,
            });
          }
        },
      };
    },
  },

  "enum-helper-values": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Require enum helper calls to use explicit literal values of the expected kind.",
      },
    },
    create(context) {
      function validateObjectValues(call, expectedType) {
        const object = firstObjectArgument(call);
        if (!object) return;

        const seenValues = new Map();
        for (const property of object.properties ?? []) {
          if (property.type !== "Property") {
            context.report({
              node: property,
              message: "Enum helper values must be explicit object properties.",
            });
            continue;
          }
          if (property.computed) {
            context.report({
              node: property.key,
              message: "Enum helper property names must not be computed.",
            });
            continue;
          }

          const value = literalValue(property.value);
          const name = propertyName(property.key);
          if (typeof value !== expectedType) {
            context.report({
              node: property.value,
              message: `Enum helper property '${name}' must use an explicit ${expectedType} literal value.`,
            });
            continue;
          }

          const seenAt = seenValues.get(value);
          if (seenAt) {
            context.report({
              node: property.value,
              message: `Enum helper value '${value}' duplicates property '${seenAt}'.`,
            });
            continue;
          }
          seenValues.set(value, name);
        }
      }

      return {
        CallExpression(node) {
          const name = calleeName(node.callee);
          if (NUMERIC_ENUM_HELPER_NAMES.has(name)) {
            validateObjectValues(node, "number");
          } else if (STRING_ENUM_HELPER_NAMES.has(name)) {
            validateObjectValues(node, "string");
          }
        },
      };
    },
  },
};
