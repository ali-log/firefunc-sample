export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(
  level: LogLevel = "info",
  bindings: Record<string, unknown> = {},
): Logger {
  const threshold = LEVEL_ORDER[level];

  function emit(
    lvl: LogLevel,
    msg: string,
    meta?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[lvl] < threshold) return;
    const line = {
      level: lvl,
      time: new Date().toISOString(),
      msg,
      ...bindings,
      ...meta,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  }

  return {
    debug: (msg, meta) => emit("debug", msg, meta),
    info: (msg, meta) => emit("info", msg, meta),
    warn: (msg, meta) => emit("warn", msg, meta),
    error: (msg, meta) => emit("error", msg, meta),
    child: (childBindings) =>
      createLogger(level, { ...bindings, ...childBindings }),
  };
}

export const logger: Logger = createLogger(
  (process.env.LOG_LEVEL as LogLevel) ?? "info",
);
