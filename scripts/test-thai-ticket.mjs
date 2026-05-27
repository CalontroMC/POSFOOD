// End-to-end test: build a real kitchen ticket via escpos.js (project lib),
// send via TCP to the WiFi-connected POS-80.
import net from "node:net";
import { buildOrderTicket, buildFinalReceipt } from "../src/lib/escpos.js";

const IP = process.env.PRINTER_IP || "192.168.68.208";
const PORT = Number(process.env.PRINTER_PORT) || 9100;

const order = {
  order_number: "ORD03-007",
  table_number: "A1",
  label: "ปกติ",
  created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  note: "รีบนิดนึง ขอบคุณค่ะ",
  subtotal: 240,
  discount: 0,
  total: 240,
  payment_method: "cash",
};
const items = [
  { name: "ผัดกะเพราหมูสับ", qty: 2, price: 60, options: [{ name: "เผ็ดน้อย" }, { name: "ไข่ดาว" }], note: "ไม่ใส่ผัก" },
  { name: "ต้มยำกุ้งน้ำข้น",   qty: 1, price: 90, options: [],                                       note: "" },
  { name: "ข้าวเปล่า",          qty: 3, price: 10, options: [],                                       note: "" },
];

function send(payload) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(6000);
    sock.once("timeout", () => { sock.destroy(); reject(new Error("timeout")); });
    sock.once("error", reject);
    sock.once("connect", () => {
      sock.write(payload, () => setTimeout(() => { sock.destroy(); resolve(); }, 700));
    });
    sock.connect(PORT, IP);
  });
}

const width = 48; // 80mm
const ticket = buildOrderTicket({ title: "ใบสั่งครัว", order, items, width });
const receipt = buildFinalReceipt({
  order, items,
  storeName: "FoodPOS",
  storeAddress: "ทดสอบที่อยู่ร้าน",
  storePhone: "081-234-5678",
  footer: "ขอบคุณที่ใช้บริการครับ",
  paid: 250,
  change: 10,
  width,
});

console.log(`Connecting to ${IP}:${PORT}...`);
await send(Buffer.from(ticket));
console.log(`Sent kitchen ticket (${ticket.length} bytes)`);
await new Promise(r => setTimeout(r, 1500));
await send(Buffer.from(receipt));
console.log(`Sent final receipt (${receipt.length} bytes)`);
