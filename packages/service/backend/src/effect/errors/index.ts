import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{ cause: unknown }> {
  override get message() {
    return `DatabaseError: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`;
  }
}

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
}> {
  override get message() {
    return `AuthenticationError: ${this.reason}`;
  }
}

export class AuthorizationError extends Data.TaggedError("AuthorizationError")<{
  reason: string;
}> {
  override get message() {
    return `AuthorizationError: ${this.reason}`;
  }
}

export class CryptoError extends Data.TaggedError("CryptoError")<{
  cause: unknown;
  operation: "encrypt" | "decrypt";
}> {
  override get message() {
    return `CryptoError(${this.operation}): ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`;
  }
}

export class NatsError extends Data.TaggedError("NatsError")<{ cause: unknown }> {
  override get message() {
    return `NatsError: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`;
  }
}

export class SourceFetchError extends Data.TaggedError("SourceFetchError")<{
  cause: unknown;
  sourceType?: number;
}> {
  override get message() {
    return `SourceFetchError: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`;
  }
}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  field: string;
  message: string;
}> {}

export class StreamConnectionError extends Data.TaggedError("StreamConnectionError")<{
  code: "E_AUTH" | "E_ACCESS" | "E_STALLED";
}> {
  override get message() {
    return `StreamConnectionError: ${this.code}`;
  }
}

export class QuotaError extends Data.TaggedError("QuotaError")<{
  resource: string;
  current: number;
  max: number;
}> {
  override get message() {
    return `QuotaError: ${this.resource} limit exceeded (${this.current}/${this.max})`;
  }
}

export class ConflictError extends Data.TaggedError("ConflictError")<{
  entity: string;
  field: string;
  value: string;
}> {
  override get message() {
    return `ConflictError: ${this.entity}.${this.field} = ${this.value}`;
  }
}
