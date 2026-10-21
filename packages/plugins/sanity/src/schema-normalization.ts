import {
  encodeRefTarget,
  PropertyType,
  type CollectionSchema,
  type RefTargets,
} from "@contfu/core";
import { addDiagnostic, inspectField } from "./schema-diagnostics";
import { indexSchemaDefinitions, isFieldDefinition, resolveFieldType } from "./schema-definitions";
import {
  SanitySchemaDiagnosticCode,
  type ResolvedFieldType,
  type SanitySchemaDefinition,
  type SanitySchemaDiagnostic,
  type SanitySchemaSyncPayload,
  type SanitySchemaSyncResult,
  type SchemaDefinitionIndex,
} from "./schema-types";

/**
 * Build the schema-push wire payload and report unsupported source semantics separately.
 */
export function buildSanitySchemaSyncResult(
  dataset: string,
  schemaTypes: SanitySchemaDefinition[],
  projectId?: string,
): SanitySchemaSyncResult {
  const definitions = indexSchemaDefinitions(schemaTypes);
  const diagnostics: SanitySchemaDiagnostic[] = [];
  const schemas: Record<string, CollectionSchema> = {};
  const refTargets: Record<string, RefTargets> = {};

  for (const document of schemaTypes) {
    if (document.type !== "document" || typeof document.name !== "string") continue;
    const schema: CollectionSchema = { $draft: PropertyType.BOOLEAN };
    for (const field of Array.isArray(document.fields) ? document.fields : []) {
      if (!isFieldDefinition(field) || typeof field.name !== "string") continue;
      const normalized = normalizeFieldType(
        field,
        definitions,
        diagnostics,
        document.name,
        field.name,
        true,
        projectId,
      );
      if (normalized !== null) {
        schema[field.name] = normalized;
        const targets = referenceTargets(field, definitions, dataset, projectId);
        if (targets.length) (refTargets[document.name] ??= {})[field.name] = targets;
      }
    }
    schemas[document.name] = schema;
  }

  return {
    payload: {
      dataset,
      environment: dataset,
      schemas,
      ...(Object.keys(refTargets).length ? { refTargets } : {}),
    },
    diagnostics,
  };
}

/** Backwards-compatible payload-only builder. */
export function buildSanitySchemaSyncPayload(
  dataset: string,
  schemaTypes: SanitySchemaDefinition[],
  projectId?: string,
): SanitySchemaSyncPayload {
  return buildSanitySchemaSyncResult(dataset, schemaTypes, projectId).payload;
}

function normalizeFieldType(
  field: Parameters<typeof inspectField>[0],
  definitions: SchemaDefinitionIndex,
  diagnostics: SanitySchemaDiagnostic[],
  document: string,
  fieldPath: string,
  topLevel: boolean,
  projectId: string | undefined,
): number | null {
  const required = inspectField(
    field,
    definitions,
    diagnostics,
    document,
    fieldPath,
    topLevel,
    new Set(),
  );
  const resolved = resolveFieldType(field, definitions);
  if (!resolved.field || !resolved.type) return null;

  let type: number | null;
  if (resolved.type === "array") {
    type = normalizeArrayType(
      resolved.field.of,
      definitions,
      diagnostics,
      document,
      fieldPath,
      projectId,
    );
    if (type !== null) type = applyOptional(type);
  } else {
    type = normalizeResolvedScalarType(resolved, diagnostics, document, fieldPath, projectId);
    if (type !== null) type = applyOptional(type);
  }
  if (type === null) return null;

  if (topLevel && resolved.valid && required) type &= ~PropertyType.OPTIONAL;
  return type;
}

function normalizeResolvedScalarType(
  resolved: ResolvedFieldType,
  diagnostics: SanitySchemaDiagnostic[],
  document: string,
  fieldPath: string,
  _projectId: string | undefined,
): number | null {
  if (
    resolved.type === "globalDocumentReference" &&
    (resolved.field?.resourceType !== "dataset" ||
      typeof resolved.field.resourceId !== "string" ||
      !/^[^.:\s]+\.[^:\s]+$/.test(resolved.field.resourceId))
  ) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.UNSUPPORTED_FIELD_SEMANTICS,
      reason:
        "Only dataset global document references can be represented as Contfu item references.",
      sourceType: resolved.type,
    });
    return null;
  }
  return resolved.type ? normalizeScalarType(resolved.type) : null;
}

function normalizeScalarType(type: string): number | null {
  if (type === "string" || type === "text" || type === "slug" || type === "url" || type === "email")
    return PropertyType.STRING;
  if (type === "number") return PropertyType.NUMBER;
  if (type === "color") return PropertyType.COLOR;
  if (type === "boolean") return PropertyType.BOOLEAN;
  if (type === "datetime") return PropertyType.DATE;
  if (type === "date") return PropertyType.PLAINDATE;
  if (type === "geopoint") return PropertyType.GEOPOINT;
  if (
    type === "reference" ||
    type === "crossDatasetReference" ||
    type === "globalDocumentReference"
  )
    return PropertyType.REF;
  if (type === "image" || type === "file") return PropertyType.FILE;
  if (type === "block") return PropertyType.BLOCK;
  if (type === "object") return PropertyType.OBJECT;
  return null;
}

function normalizeArrayType(
  of: unknown,
  definitions: SchemaDefinitionIndex,
  diagnostics: SanitySchemaDiagnostic[],
  document: string,
  fieldPath: string,
  projectId: string | undefined,
): number | null {
  if (!Array.isArray(of) || of.length === 0) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.AMBIGUOUS_ARRAY_MEMBERS,
      reason: "The array has no resolvable member definitions.",
    });
    return null;
  }

  const memberTypes: number[] = [];
  let unresolvedMember = false;
  for (let index = 0; index < of.length; index++) {
    const member = of[index];
    if (!isFieldDefinition(member)) {
      unresolvedMember = true;
      addDiagnostic(diagnostics, {
        document,
        fieldPath: `${fieldPath}[${index}]`,
        code: SanitySchemaDiagnosticCode.UNSUPPORTED_FIELD_TYPE,
        reason: "The array member is not a Sanity field definition.",
      });
      continue;
    }
    const resolved = resolveFieldType(member, definitions);
    if (!resolved.field || !resolved.type) {
      unresolvedMember = true;
      continue;
    }
    const baseType =
      resolved.type === "array"
        ? null
        : normalizeResolvedScalarType(
            resolved,
            diagnostics,
            document,
            `${fieldPath}[${index}]`,
            projectId,
          );
    const arrayType =
      baseType === PropertyType.STRING
        ? PropertyType.STRINGS
        : baseType === PropertyType.NUMBER
          ? PropertyType.NUMBERS
          : baseType === PropertyType.REF
            ? PropertyType.REFS
            : baseType === PropertyType.FILE
              ? PropertyType.FILES
              : baseType === PropertyType.BLOCK || baseType === PropertyType.OBJECT
                ? baseType
                : null;
    if (arrayType === null) {
      unresolvedMember = true;
      addDiagnostic(diagnostics, {
        document,
        fieldPath: `${fieldPath}[${index}]`,
        code: SanitySchemaDiagnosticCode.UNSUPPORTED_ARRAY_MEMBER,
        reason: `Sanity array members of type "${resolved.type}" have no faithful Contfu array representation.`,
        sourceType: resolved.type,
      });
      continue;
    }
    memberTypes.push(arrayType);
  }

  if (unresolvedMember) return null;
  const uniqueTypes = [...new Set(memberTypes)];
  if (
    uniqueTypes.includes(PropertyType.BLOCK) &&
    uniqueTypes.every(
      (type) =>
        type === PropertyType.BLOCK || type === PropertyType.OBJECT || type === PropertyType.FILES,
    )
  ) {
    // Portable Text can combine text blocks with inline objects and images. Contfu has
    // one supported representation for that heterogeneous shape: BLOCK.
    return PropertyType.BLOCK;
  }
  if (uniqueTypes.length !== 1) {
    addDiagnostic(diagnostics, {
      document,
      fieldPath,
      code: SanitySchemaDiagnosticCode.AMBIGUOUS_ARRAY_MEMBERS,
      reason: "Mixed Sanity array member types cannot be represented by one Contfu property type.",
    });
    return null;
  }
  return uniqueTypes[0] ?? null;
}

function applyOptional(type: number): number {
  return type | PropertyType.OPTIONAL;
}

function referenceTargets(
  field: Parameters<typeof inspectField>[0],
  definitions: SchemaDefinitionIndex,
  dataset: string,
  projectId: string | undefined,
): string[] {
  const resolved = resolveFieldType(field, definitions);
  if (!resolved.field) return [];
  if (resolved.type === "array")
    return [
      ...new Set(
        (Array.isArray(resolved.field.of) ? resolved.field.of : []).flatMap((member) =>
          isFieldDefinition(member)
            ? referenceTargets(member, definitions, dataset, projectId)
            : [],
        ),
      ),
    ];
  if (
    resolved.type !== "reference" &&
    resolved.type !== "crossDatasetReference" &&
    resolved.type !== "globalDocumentReference"
  )
    return [];
  const global =
    resolved.type === "globalDocumentReference" &&
    resolved.field.resourceType === "dataset" &&
    typeof resolved.field.resourceId === "string"
      ? /^([^.:\s]+)\.([^:\s]+)$/.exec(resolved.field.resourceId)
      : null;
  const connection =
    global?.[1] ??
    (typeof resolved.field.projectId === "string" ? resolved.field.projectId : undefined);
  const scope =
    global?.[2] ?? (typeof resolved.field.dataset === "string" ? resolved.field.dataset : dataset);
  return [
    ...new Set(
      (Array.isArray(resolved.field.to) ? resolved.field.to : []).flatMap((target) => {
        if (!isFieldDefinition(target) || typeof target.type !== "string") return [];
        return [
          encodeRefTarget({
            connection: connection !== projectId ? connection : undefined,
            scope:
              (connection !== undefined && connection !== projectId) || scope !== dataset
                ? scope
                : undefined,
            collection: target.type,
          }),
        ];
      }),
    ),
  ];
}
