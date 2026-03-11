import { Otlp } from "effect/unstable/observability";
import { FetchHttpClient } from "effect/unstable/http";
import { Layer } from "effect";

const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

/**
 * OTLP telemetry layer using Effect-native transport (no @opentelemetry/* SDK).
 *
 * Enabled when OTEL_EXPORTER_OTLP_ENDPOINT is set, e.g.:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 *
 * Uses Otlp.layerJson which is pure Effect + fetch — no Node-specific
 * OpenTelemetry SDK packages that cause Bun segfaults.
 */
export const TelemetryLive: Layer.Layer<never> = OTLP_ENDPOINT
  ? Otlp.layerJson({
      baseUrl: OTLP_ENDPOINT,
      resource: {
        serviceName: process.env.OTEL_SERVICE_NAME ?? "contfu",
        serviceVersion: process.env.npm_package_version,
      },
    }).pipe(Layer.provide(FetchHttpClient.layer))
  : Layer.empty;
