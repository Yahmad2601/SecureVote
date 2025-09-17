import session from "express-session";
import memorystore from "memorystore";
import type { AppMode } from "../app";

const MemoryStore = memorystore(session);

export const SESSION_COOKIE_NAME = "securevote.sid";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours
const SESSION_SECRET_MIN_LENGTH = 32;

export function createSessionMiddleware(mode: AppMode) {
  const isProduction = mode === "production";
  const rawSessionSecret = process.env.SESSION_SECRET;
  const normalizedSessionSecret = rawSessionSecret?.trim();

  if (isProduction) {
    if (!normalizedSessionSecret) {
      throw new Error(
        "SESSION_SECRET environment variable must be provided in production."
      );
    }

    if (normalizedSessionSecret.length < SESSION_SECRET_MIN_LENGTH) {
      throw new Error(
        `SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters long to provide sufficient entropy.`
      );
    }
  }

  return session({
    secret: rawSessionSecret ?? "securevote-dev-secret", // Override via SESSION_SECRET in production
    resave: false,
    saveUninitialized: false,
    name: SESSION_COOKIE_NAME,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? "strict" : "lax",
      secure: isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
    store: new MemoryStore({
      checkPeriod: SESSION_MAX_AGE_MS,
    }),
  });
}
