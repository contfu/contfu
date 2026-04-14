// Re-export everything from @contfu/svc-core so external consumers
// only need to depend on @contfu/svc-api.
export {
  // API types
  ApiError,
  type ApiStatus,
  type ApiConnection,
  type CreateConnectionBody,
  type UpdateConnectionBody,
  type CreateCollectionBody,
  type UpdateCollectionBody,
  type CreateFlowBody,
  type UpdateFlowBody,
  // Domain types
  type ServiceCollection,
  type ServiceFlow,
  type ServiceFlowWithDetails,
  type Filter,
  type MappingRule,
  type CollectionSchema,
  type SchemaValue,
  type RefTargets,
  type TypeGenerationInput,
  type ScannedCollection,
  type AddedScannedCollection,
  type AddScannedCollectionsBody,
  type AddScannedCollectionsResult,
  // Constants & utilities
  ConnectionType,
  ConnectionTypeMeta,
  WebAuthType,
  PropertyType,
  schemaType,
  schemaEnumValues,
  mergeSchemaValues,
  generateTypeScript,
  generateConsumerTypes,
  FilterOperator,
} from "@contfu/svc-core";
