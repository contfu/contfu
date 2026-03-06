import * as v from "valibot";

// --- Sources ---

export const CreateSourceSchema = v.object({
  name: v.string(),
  type: v.picklist([0, 1, 2]),
  url: v.optional(v.nullable(v.string())),
  includeRef: v.optional(v.boolean()),
});

export const UpdateSourceSchema = v.object({
  name: v.optional(v.string()),
  url: v.optional(v.nullable(v.string())),
  includeRef: v.optional(v.boolean()),
});

// --- Collections ---

export const CreateCollectionSchema = v.object({
  displayName: v.string(),
  name: v.optional(v.string()),
  includeRef: v.optional(v.boolean()),
});

export const UpdateCollectionSchema = v.object({
  displayName: v.optional(v.string()),
  name: v.optional(v.string()),
  includeRef: v.optional(v.boolean()),
  schema: v.optional(v.record(v.string(), v.number())),
  refTargets: v.optional(v.nullable(v.record(v.string(), v.array(v.string())))),
});

// --- Consumers ---

export const CreateConsumerSchema = v.object({
  name: v.string(),
  includeRef: v.optional(v.boolean()),
});

export const UpdateConsumerSchema = v.object({
  name: v.optional(v.string()),
  includeRef: v.optional(v.boolean()),
});

// --- Connections ---

export const CreateConnectionSchema = v.object({
  consumerId: v.number(),
  collectionId: v.number(),
  includeRef: v.optional(v.boolean()),
});

export const UpdateConnectionSchema = v.object({
  includeRef: v.optional(v.boolean()),
});

// --- Influxes ---

const FilterSchema = v.object({
  property: v.string(),
  operator: v.picklist([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
  value: v.optional(v.unknown()),
});

const MappingRuleSchema = v.object({
  source: v.string(),
  target: v.optional(v.string()),
  default: v.optional(v.unknown()),
  cast: v.optional(v.string()),
});

export const CreateInfluxSchema = v.object({
  collectionId: v.number(),
  sourceCollectionId: v.number(),
  filters: v.optional(v.array(FilterSchema)),
  schema: v.optional(v.record(v.string(), v.number())),
  includeRef: v.optional(v.boolean()),
});

export const UpdateInfluxSchema = v.object({
  filters: v.optional(v.nullable(v.array(FilterSchema))),
  mappings: v.optional(v.nullable(v.array(MappingRuleSchema))),
  schema: v.optional(v.nullable(v.record(v.string(), v.number()))),
  includeRef: v.optional(v.boolean()),
});
