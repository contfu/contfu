import { Effect, Layer, Logger, LogLevel, ManagedRuntime } from "effect";

type LogLevelLiteral = "All" | "Fatal" | "Error" | "Warning" | "Info" | "Debug" | "Trace" | "None";

const isDev = process.env.NODE_ENV !== "production";
const level = (process.env.LOG_LEVEL ?? (isDev ? "Debug" : "Info")) as LogLevelLiteral;

export const LoggerLive = Layer.mergeAll(
  isDev ? Logger.pretty : Logger.logFmt,
  Logger.minimumLogLevel(LogLevel.fromLiteral(level)),
);

const logRuntime = ManagedRuntime.make(LoggerLive);

export function createLogger(module: string) {
  return {
    info(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logInfo(message).pipe(Effect.annotateLogs({ module, ...annotations })),
      );
    },
    warn(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logWarning(message).pipe(Effect.annotateLogs({ module, ...annotations })),
      );
    },
    error(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logError(message).pipe(Effect.annotateLogs({ module, ...annotations })),
      );
    },
    debug(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logDebug(message).pipe(Effect.annotateLogs({ module, ...annotations })),
      );
    },
  };
}

function parseArgs(
  dataOrMsg: Record<string, unknown> | string,
  msg?: string,
): [string, Record<string, unknown>] {
  if (typeof dataOrMsg === "string") return [dataOrMsg, {}];
  return [msg ?? "", dataOrMsg];
}
