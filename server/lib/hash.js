import crypto from "node:crypto";

/**
 * Hash a 4-digit PIN using Node.js native scrypt.
 * Returns a salt:hash string.
 * @param {string} pin
 * @returns {string}
 */
export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a 4-digit PIN against the stored hash.
 * Supports migration (plain 4-digit PIN fallback).
 * @param {string} pin
 * @param {string} stored
 * @returns {boolean}
 */
export function verifyPin(pin, stored) {
  if (!stored) return false;

  // Plaintext migration fallback (e.g. "1234")
  if (/^\d{4}$/.test(stored)) {
    return String(pin) === String(stored);
  }

  // Hashed format: salt:hash
  const parts = stored.split(":");
  if (parts.length !== 2) return false;

  const [salt, hash] = parts;
  const verifyHash = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  
  // Timing attack resistant comparison
  const bufHash = Buffer.from(hash, "hex");
  const bufVerify = Buffer.from(verifyHash, "hex");
  if (bufHash.length !== bufVerify.length) return false;
  return crypto.timingSafeEqual(bufHash, bufVerify);
}
