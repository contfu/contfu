import {
  SanitySchemaDiagnosticCode,
  type SanityFieldDefinition,
  type SanitySchemaDiagnostic,
  type SchemaDefinitionIndex,
} from "./schema-types";
import { isFieldDefinition, resolveFieldType } from "./schema-definitions";

const CONSTRAINT_RULES = new Set([
  "min",
  "max",
  "length",
  "precision",
  "positive",
  "negative",
  "integer",
  "greaterThan",
  "lessThan",
  "valid",
  "regex",
  "email",
  "uri",
  "uppercase",
  "lowercase",
  "unique",
]);

export function inspectField(
  field: SanityFieldDefinition,
  definitions: SchemaDefinitionIndex,
  diagnostics: SanitySchemaDiagnostic[],
  document: string,
  fieldPath: string,
  topLevel: boolean,
  typeAncestry: ReadonlySet<string>,
): boolean {
  const resolved = resolveFieldType(field, definitions);
  let required = false;
  let certain = true;

  if (!resolved.field) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNSUPPORTED_FIELD_TYPE,
      reason: resolved.reason ?? "The Sanity field type could not be resolved.",
      ...(typeof field.type === "string" ? { sourceType: field.type } : {}),
    });
  }

  const validationSources = [field, ...resolved.definitions];
  for (const source of validationSources) {
    const result = inspectValidation(source.validation, fieldPath, diagnostics, document, topLevel);
    required ||= result.required;
    certain &&= result.certain;
    inspectEditorSemantics(source, fieldPath, diagnostics, document);
  }
  if (!resolved.field) return required && certain;

  const ancestry = new Set(typeAncestry);
  for (const alias of resolved.definitions) {
    if (typeof alias.name === "string") ancestry.add(alias.name);
  }

  if (resolved.type === "array") {
    const members = resolved.field.of;
    if (Array.isArray(members)) {
      for (let index = 0; index < members.length; index++) {
        const member = members[index];
        if (isFieldDefinition(member)) {
          inspectField(
            member,
            definitions,
            diagnostics,
            document,
            `${fieldPath}[${index}]`,
            false,
            ancestry,
          );
        }
      }
    }
  }

  if (resolved.type === "object") {
    const alreadyVisitedType = resolved.definitions.some(
      (definition) => typeof definition.name === "string" && typeAncestry.has(definition.name),
    );
    if (!alreadyVisitedType) {
      const nestedFields = Array.isArray(resolved.field.fields) ? resolved.field.fields : [];
      for (const nested of nestedFields) {
        if (isFieldDefinition(nested) && typeof nested.name === "string") {
          inspectField(
            nested,
            definitions,
            diagnostics,
            document,
            `${fieldPath}.${nested.name}`,
            false,
            ancestry,
          );
        }
      }
    }
  }
  return required && certain;
}

function inspectValidation(
  validation: unknown,
  fieldPath: string,
  diagnostics: SanitySchemaDiagnostic[],
  document: string,
  topLevel: boolean,
): { required: boolean; certain: boolean } {
  if (validation === undefined) return { required: false, certain: true };
  if (typeof validation !== "function") {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
      reason: "Validation is not a synchronous Sanity validation callback and was not represented.",
    });
    return { required: false, certain: false };
  }
  if (validation.length > 1) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
      reason: "Validation callbacks requiring Studio context cannot be evaluated by the plugin.",
    });
    return { required: false, certain: false };
  }
  return analyzeValidation(validation, fieldPath, diagnostics, document, topLevel);
}

function analyzeValidation(
  validation: unknown,
  fieldPath: string,
  diagnostics: SanitySchemaDiagnostic[],
  document: string,
  topLevel: boolean,
): { required: boolean; certain: boolean } {
  if (typeof validation !== "function") return { required: false, certain: false };

  let presence: "required" | "optional" | undefined;
  let certain = true;
  const reportedRules = new Set<string>();
  const reportRule = (rule: string): void => {
    if (reportedRules.has(rule)) return;
    reportedRules.add(rule);
    const requiredOnNestedField = rule === "required" && !topLevel;
    const code: SanitySchemaDiagnosticCode =
      rule === "custom"
        ? SanitySchemaDiagnosticCode.CUSTOM_VALIDATION
        : SanitySchemaDiagnosticCode.UNSUPPORTED_VALIDATION;
    if (rule === "required" && topLevel) return;
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code,
      rule,
      reason: requiredOnNestedField
        ? "Required array members and nested object fields are not represented in the flat Contfu collection schema."
        : rule === "custom"
          ? "Custom Sanity validation is not executed or represented by Contfu."
          : `Sanity validation rule "${rule}" has no faithful Contfu schema representation.`,
    });
  };
  const rule = new Proxy(Object.create(null) as object, {
    get: (_target, property) => {
      if (property === "then") return undefined;
      if (property === "required" || property === "optional") {
        return () => {
          const next = property;
          if (presence && presence !== next) {
            certain = false;
            addDiagnostic(diagnostics, {
              document,
              fieldPath,
              code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
              reason:
                "The Sanity validation callback combines conflicting required and optional rules.",
            });
          }
          presence = next;
          if (next === "required") reportRule("required");
          return rule;
        };
      }
      if (typeof property !== "string") {
        certain = false;
        return () => rule;
      }
      return (..._args: unknown[]) => {
        if (property === "custom") reportRule("custom");
        else if (CONSTRAINT_RULES.has(property)) reportRule(property);
        else {
          certain = false;
          addDiagnostic(diagnostics, {
            document,
            fieldPath,
            code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
            rule: property,
            reason: `Unknown Sanity validation method "${property}" could not be evaluated safely.`,
          });
        }
        return rule;
      };
    },
  });

  let contextUsed = false;
  const context = new Proxy(Object.create(null) as object, {
    get: () => {
      contextUsed = true;
      return undefined;
    },
    has: () => {
      contextUsed = true;
      return false;
    },
    ownKeys: () => {
      contextUsed = true;
      return [];
    },
  });

  let result: unknown;
  try {
    result = (validation as (rule: unknown, context: unknown) => unknown)(rule, context);
  } catch {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
      reason: "The Sanity validation callback threw while its supported rules were inspected.",
    });
    return { required: false, certain: false };
  }

  if (contextUsed) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
      reason: "Validation that reads Studio context cannot be evaluated by the plugin.",
    });
    return { required: false, certain: false };
  }

  let thenable = false;
  if (result && (typeof result === "object" || typeof result === "function")) {
    try {
      thenable = typeof Reflect.get(result, "then") === "function";
    } catch {
      addDiagnostic(diagnostics, {
        document,
        fieldPath,
        code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
        reason:
          "The Sanity validation callback returned a value that could not be inspected safely.",
      });
      return { required: false, certain: false };
    }
  }

  if (thenable) {
    void Promise.resolve(result).catch(() => undefined);
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
      reason:
        "Asynchronous Sanity validation callbacks cannot be evaluated without Studio runtime context.",
    });
    return { required: false, certain: false };
  } else if (result === rule || Array.isArray(result)) {
    // A callback can return one rule or several; only the explicit calls above are inspected.
  } else if (result !== undefined && result !== null) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNEVALUABLE_VALIDATION,
      reason: "The Sanity validation callback returned a value that is not a validation rule.",
    });
    certain = false;
  }

  if (!certain && presence === "required") return { required: false, certain: false };
  return { required: presence === "required", certain };
}

function inspectEditorSemantics(
  field: SanityFieldDefinition,
  fieldPath: string,
  diagnostics: SanitySchemaDiagnostic[],
  document: string,
): void {
  for (const key of ["hidden", "readOnly"]) {
    if (field[key] !== true && typeof field[key] !== "function") continue;
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNSUPPORTED_INPUT_SEMANTICS,
      rule: key,
      reason: `Sanity ${key} input behavior is editor-only and is not part of the normalized Contfu schema.`,
    });
  }
  const components = field.components;
  if (components && typeof components === "object" && "input" in components) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNSUPPORTED_INPUT_SEMANTICS,
      rule: "components.input",
      reason:
        "Custom Sanity input components affect Studio editing only and are not part of the normalized Contfu schema.",
    });
  }
}

export function addDiagnostic(
  diagnostics: SanitySchemaDiagnostic[],
  diagnostic: SanitySchemaDiagnostic,
): void {
  diagnostics.push(diagnostic);
}
