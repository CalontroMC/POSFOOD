import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPin, verifyPin } from "./hash.js";

test("hashPin: generates correct salt:hash format", () => {
  const pin = "1234";
  const stored = hashPin(pin);
  
  assert.ok(stored.includes(":"), "Hash must contain salt separator ':'");
  const parts = stored.split(":");
  assert.equal(parts.length, 2, "Hash must have exactly 2 parts");
  assert.equal(parts[0].length, 32, "Salt must be 32 hex characters (16 bytes)");
  assert.equal(parts[1].length, 128, "Hash must be 128 hex characters (64 bytes)");
});

test("verifyPin: verifies valid hashed PIN", () => {
  const pin = "5829";
  const stored = hashPin(pin);
  
  assert.equal(verifyPin(pin, stored), true, "Valid PIN must verify to true");
  assert.equal(verifyPin("0000", stored), false, "Invalid PIN must verify to false");
  assert.equal(verifyPin("", stored), false, "Empty PIN must verify to false");
});

test("verifyPin: fallback validation for plaintext PINs", () => {
  const plaintextPin = "9999";
  
  assert.equal(verifyPin("9999", plaintextPin), true, "Plaintext PIN must verify to true if stored as plaintext");
  assert.equal(verifyPin("1234", plaintextPin), false, "Incorrect PIN must verify to false");
});

test("verifyPin: handles edge cases gracefully", () => {
  assert.equal(verifyPin("1234", null), false, "Null stored value must verify to false");
  assert.equal(verifyPin("1234", undefined), false, "Undefined stored value must verify to false");
  assert.equal(verifyPin("1234", ""), false, "Empty stored value must verify to false");
  assert.equal(verifyPin("1234", "bad_format"), false, "Bad format stored value must verify to false");
});
