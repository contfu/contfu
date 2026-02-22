import { Layer } from "effect";

/**
 * Telemetry layer stub.
 *
 * OpenTelemetry via @effect/opentelemetry is not yet enabled because the
 * packages trigger a Bun segfault when bundled into the SvelteKit app.
 * Feature functions already have Effect.withSpan annotations; once the
 * Bun/Effect-OTel compatibility is resolved, replace this with:
 *
 *   Otlp.layerJson({ ... }).pipe(Layer.provide(FetchHttpClient.layer))
 */
export const TelemetryLive: Layer.Layer<never> = Layer.empty;
