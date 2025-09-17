import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { PoolConfig } from "pg";
import type { AppMode } from "../app";

export const SESSION_COOKIE_NAME = "securevote.sid";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours

const PgSessionStore = connectPgSimple(session);

let sessionStore: InstanceType<typeof PgSessionStore> | null = null;

function resolveSessionStore() {
  if (sessionStore) {
    return sessionStore;
  }

  const connectionString =
    process.env.SESSION_STORE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "SESSION_STORE_URL or DATABASE_URL must be defined to configure the session store.",
    );
  }

  const sslMode = (process.env.SESSION_STORE_SSLMODE ?? "require").toLowerCase();

  let ssl: PoolConfig["ssl"];
  switch (sslMode) {
    case "disable":
    case "false":
    case "off":
      ssl = undefined;
      break;
    case "verify-full":
    case "true":
    case "strict":
      ssl = { rejectUnauthorized: true };
      break;
    default:
      ssl = { rejectUnauthorized: false };
      break;
  }

  const ttlSeconds = Math.floor(SESSION_MAX_AGE_MS / 1000);
  const shouldCreateTable =
    (process.env.SESSION_STORE_CREATE_TABLE ?? "true").toLowerCase() !== "false";
  const tableName = process.env.SESSION_STORE_TABLE ?? "session";
  const schemaName = process.env.SESSION_STORE_SCHEMA;

  const storeOptions: connectPgSimple.PGStoreOptions = {
    createTableIfMissing: shouldCreateTable,
    tableName,
    schemaName,
    ttl: ttlSeconds,
    conObject: buildPoolConfig(connectionString, ssl),
  };

  sessionStore = new PgSessionStore(storeOptions);

  return sessionStore;
}

function buildPoolConfig(
  connectionString: string,
  ssl: PoolConfig["ssl"],
): PoolConfig {
  const poolConfig: PoolConfig = {
    connectionString,
  };

  if (ssl !== undefined) {
    poolConfig.ssl = ssl;
  }

  return poolConfig;
}

export function createSessionMiddleware(mode: AppMode) {
  const isProduction = mode === "production";

  return session({
    secret: process.env.SESSION_SECRET ?? "securevote-dev-secret", // Override via SESSION_SECRET in production
    resave: false,
    saveUninitialized: false,
    name: SESSION_COOKIE_NAME,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? "strict" : "lax",
      secure: isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
    store: resolveSessionStore(),
  });
}
