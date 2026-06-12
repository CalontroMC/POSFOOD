// PromptPay (Thai QR Payment) EMVCo payload generator.
// Pure JS — runs in browser and Node. Produces the string that is encoded
// into the QR; feed the result to an ESC/POS qr() or any QR renderer.
//
// Supports: mobile number (→ tag 01), national ID 13 digits (→ tag 02),
// e-wallet ID 15 digits (→ tag 03). Optional amount makes it a dynamic QR.

function tlv(id, value) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function sanitize(id) {
  return String(id || "").replace(/[^0-9]/g, "");
}

// Mobile → 13-digit "0066xxxxxxxxx"; 13/15-digit IDs pass through unchanged.
function formatTarget(id) {
  const n = sanitize(id);
  if (n.length >= 13) return n;
  return ("0000000000000" + n.replace(/^0/, "66")).slice(-13);
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — uppercase 4-hex
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Build a PromptPay EMVCo payload string.
 * @param {string} id     mobile / national ID / e-wallet ID
 * @param {number} amount optional THB amount (dynamic QR)
 * @returns {string} payload (empty string if id is invalid/blank)
 */
export function promptPayPayload(id, amount) {
  const target = sanitize(id);
  if (!target) return "";
  const tag = target.length >= 15 ? "03" : target.length >= 13 ? "02" : "01";
  const merchant = tlv("00", "A000000677010111") + tlv(tag, formatTarget(id));

  let payload =
    tlv("00", "01") +
    tlv("01", amount && Number(amount) > 0 ? "12" : "11") +
    tlv("29", merchant) +
    tlv("58", "TH") +
    tlv("53", "764");
  if (amount && Number(amount) > 0) payload += tlv("54", Number(amount).toFixed(2));
  payload += "6304";
  return payload + crc16(payload);
}
