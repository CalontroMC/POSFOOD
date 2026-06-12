import crypto from "node:crypto";

export function newTableToken() {
  return crypto.randomBytes(12).toString("hex");
}

// Rotate a table's QR token so the previous QR becomes invalid.
// Called after a bill is settled (table freed) so the next customer
// always scans a fresh QR and the old one can't be reused.
export function rotateTableToken(database, tableId) {
  if (!tableId) return;
  database
    .prepare("UPDATE tables SET qr_token = ? WHERE id = ?")
    .run(newTableToken(), tableId);
}
