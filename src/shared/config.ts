export interface AppConfig {
  env: "development" | "test" | "production";
  host: string;
  port: number;
  databasePath: string;
  logLevel: "debug" | "info" | "warn" | "error";
  jwtSecret: string;
}

function envStr(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function loadConfig(): AppConfig {
  const env = envStr("NODE_ENV", "development") as AppConfig["env"];
  return {
    env,
    host: envStr("HOST", "0.0.0.0"),
    port: envInt("PORT", 3000),
    databasePath: envStr("DATABASE_PATH", "firefunc-sample.db"),
    logLevel: envStr("LOG_LEVEL", "info") as AppConfig["logLevel"],
    jwtSecret: envStr("JWT_SECRET", "dev-insecure-secret"),
  };
}

export const config: AppConfig = loadConfig();
