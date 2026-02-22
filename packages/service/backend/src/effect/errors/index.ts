import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{ cause: unknown }> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  entity: string;
  id: number | string;
}> {
  override get message() {
    return `${this.entity} not found`;
  }
}

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  reason: string;
}> {}

export class AuthorizationError extends Data.TaggedError("AuthorizationError")<{
  reason: string;
}> {}

export class CryptoError extends Data.TaggedError("CryptoError")<{
  cause: unknown;
  operation: "encrypt" | "decrypt";
}> {}

export class NatsError extends Data.TaggedError("NatsError")<{ cause: unknown }> {}

export class SourceFetchError extends Data.TaggedError("SourceFetchError")<{
  cause: unknown;
  sourceType?: number;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  field: string;
  message: string;
}> {}

export class StreamConnectionError extends Data.TaggedError("StreamConnectionError")<{
  code: "E_AUTH" | "E_ACCESS" | "E_STALLED";
}> {}
