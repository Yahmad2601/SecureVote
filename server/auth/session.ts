import session from "express-session";
import memorystore from "memorystore";
import type { AppMode } from "../app";

const MemoryStore = memorystore(session);

export const SESSION_COOKIE_NAME = "securevote.sid";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours

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
    store: new MemoryStore({
      checkPeriod: SESSION_MAX_AGE_MS,
    }),
  });
}
