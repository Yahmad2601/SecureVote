import { randomBytes, scrypt as asyncScryptFn, scryptSync, timingSafeEqual } from "crypto";
import { promisify } from "util";

const SCRYPT_KEY_LENGTH = 64;
const asyncScrypt = promisify(asyncScryptFn);

function encodeHash(salt: Buffer, derivedKey: Buffer): string {
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

function decodeHash(storedHash: string): { salt: Buffer; derivedKey: Buffer } | null {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex) {
    return null;
  }

  try {
    return {
      salt: Buffer.from(saltHex, "hex"),
      derivedKey: Buffer.from(keyHex, "hex"),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await asyncScrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return encodeHash(salt, derivedKey);
}

export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return encodeHash(salt, derivedKey);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const decoded = decodeHash(storedHash);
  if (!decoded) {
    return false;
  }

  try {
    const derivedKey = (await asyncScrypt(password, decoded.salt, SCRYPT_KEY_LENGTH)) as Buffer;
    if (derivedKey.length !== decoded.derivedKey.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, decoded.derivedKey);
  } catch {
    return false;
  }
}

export function isPasswordHash(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const decoded = decodeHash(value);
  return decoded !== null;
}
