import { Effect, Layer, Logger, type LogLevel, ManagedRuntime, References } from "effect";
import { getLogContext } from "./log-context";

const isDev = process.env.NODE_ENV !== "production";
const level = (process.env.LOG_LEVEL ?? (isDev ? "Debug" : "Info")) as LogLevel.LogLevel;

export const LoggerLive = Layer.mergeAll(
  Logger.layer([isDev ? Logger.consolePretty() : Logger.consoleJson]),
  Layer.succeed(References.MinimumLogLevel)(level),
);

const logRuntime = ManagedRuntime.make(LoggerLive);

export function createLogger(module: string) {
  return {
    info(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logInfo(message).pipe(
          Effect.annotateLogs({ ...getLogContext(), module, ...annotations }),
        ),
      );
    },
    warn(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logWarning(message).pipe(
          Effect.annotateLogs({ ...getLogContext(), module, ...annotations }),
        ),
      );
    },
    error(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logError(message).pipe(
          Effect.annotateLogs({ ...getLogContext(), module, ...annotations }),
        ),
      );
    },
    debug(dataOrMsg: Record<string, unknown> | string, msg?: string) {
      const [message, annotations] = parseArgs(dataOrMsg, msg);
      logRuntime.runSync(
        Effect.logDebug(message).pipe(
          Effect.annotateLogs({ ...getLogContext(), module, ...annotations }),
        ),
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
