/** Raised when an item arrives before the runtime has the schema for all props. */
export class UnknownSchemaPropertyError extends Error {
  readonly properties: string[];

  constructor(properties: string[]) {
    super(`Item contains properties absent from the stored schema: ${properties.join(", ")}`);
    this.name = "UnknownSchemaPropertyError";
    this.properties = properties;
  }
}
