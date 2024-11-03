export enum PropertyType {
  NULL = 0,
  STRING = 2,
  STRINGS = 4,
  NUMBER = 8,
  NUMBERS = 16,
  BOOLEAN = 32,
  REF = 64,
  REFS = 128,
  FILE = 256,
  FILES = 512,
  DATE = 1024,
}

export type CollectionSchema = Record<string, number>;
