import {
  defineStringEnum,
  type CollectionSchema,
  type RefTargets,
  type EnumValue,
} from "@contfu/core";

export type SanitySchemaSyncPayload = {
  dataset: string;
  environment: string;
  schemas: Record<string, CollectionSchema>;
  refTargets?: Record<string, RefTargets>;
};

export const SanitySchemaDiagnosticCode = defineStringEnum({
  UNSUPPORTED_FIELD_TYPE: "unsupported_field_type",
  AMBIGUOUS_ARRAY_MEMBERS: "ambiguous_array_members",
  UNSUPPORTED_ARRAY_MEMBER: "unsupported_array_member",
  UNSUPPORTED_FIELD_SEMANTICS: "unsupported_field_semantics",
  UNSUPPORTED_VALIDATION: "unsupported_validation",
  CUSTOM_VALIDATION: "custom_validation",
  UNEVALUABLE_VALIDATION: "unevaluable_validation",
  UNSUPPORTED_INPUT_SEMANTICS: "unsupported_input_semantics",
});
export type SanitySchemaDiagnosticCode = EnumValue<typeof SanitySchemaDiagnosticCode>;

/** A normalization warning kept local to the plugin; diagnostics are never posted to Contfu. */
export type SanitySchemaDiagnostic = {
  document: string;
  /** Field path relative to the document, with array members written as `[index]`. */
  fieldPath: string;
  code: SanitySchemaDiagnosticCode;
  reason: string;
  rule?: string;
  sourceType?: string;
};

export type SanitySchemaSyncResult = {
  payload: SanitySchemaSyncPayload;
  diagnostics: SanitySchemaDiagnostic[];
};

export type UpdateContfuSchemaOptions = {
  webhookSecret: string;
  dataset: string;
  /** Source project used to qualify explicitly declared reference destinations. */
  projectId?: string;
  schemaTypes: SanitySchemaDefinition[];
  signal?: AbortSignal;
  /** Called once for each lossy or unsupported schema behavior found before posting. */
  onDiagnostic?: (diagnostic: SanitySchemaDiagnostic) => void;
};

export type SanitySchemaDefinition = {
  name?: unknown;
  type?: unknown;
  fields?: unknown;
  [key: string]: unknown;
};

export type SanityFieldDefinition = {
  name?: unknown;
  type?: unknown;
  of?: unknown;
  fields?: unknown;
  validation?: unknown;
  hidden?: unknown;
  readOnly?: unknown;
  components?: unknown;
  [key: string]: unknown;
};

export type SchemaDefinitionIndex = {
  byName: Map<string, SanitySchemaDefinition>;
  ambiguous: Set<string>;
};

export type ResolvedFieldType = {
  type: string | null;
  field: SanityFieldDefinition | null;
  definitions: SanitySchemaDefinition[];
  valid: boolean;
  reason?: string;
};
