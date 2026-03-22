import { Config, Effect, Layer, ServiceMap } from "effect";

export class AppConfig extends ServiceMap.Service<AppConfig>()("@contfu/AppConfig", {
  make: Effect.gen(function* () {
    return {
      databaseUrl: yield* Config.string("DATABASE_URL"),
      natsServer: yield* Config.option(Config.string("NATS_SERVER")),
      contfuSecret: yield* Config.option(Config.redacted("CONTFU_SECRET")),
      betterAuthSecret: yield* Config.option(Config.redacted("BETTER_AUTH_SECRET")),
      testMode: yield* Config.string("NODE_ENV").pipe(Config.map((env) => env === "test")),
      smtpHost: yield* Config.option(Config.string("SMTP_HOST")),
      smtpUser: yield* Config.option(Config.string("SMTP_USER")),
      smtpFromEmail: yield* Config.option(Config.string("SMTP_FROM_EMAIL")),
      smtpFromName: yield* Config.option(Config.string("SMTP_FROM_NAME")),
      origin: yield* Config.withDefault(Config.string("ORIGIN"), "https://localhost:5173"),
      otelEndpoint: yield* Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")),
      maxCollectionPullSize: yield* Config.withDefault(
        Config.number("MAX_COLLECTION_PULL_SIZE").pipe(Config.map(Math.trunc)),
        10_000,
      ),
      minFetchInterval: yield* Config.withDefault(
        Config.number("MIN_FETCH_INTERVAL").pipe(Config.map(Math.trunc)),
        10_000,
      ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}
