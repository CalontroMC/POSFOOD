import { Router } from "express";
import db from "../db.js";
import { GoogleGenAI } from "@google/genai";
import { adminRequired } from "../middleware/auth.js";

const r = Router();
r.use(adminRequired);

r.post("/test", async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: "Missing API Key" });
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Hello",
    });
    res.json({ ok: true, text: response.text });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

r.post("/", async (req, res) => {
  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "messages array required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get();
    const apiKey = setting?.value || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.write(`data: ${JSON.stringify({ error: "กรุณาใส่ Gemini API Key ในหน้า 'ตั้งค่าร้าน' ก่อนใช้งาน" })}\n\n`);
      return res.end();
    }
    
    const ai = new GoogleGenAI({ apiKey });

    // 1. Fetch context
    const summary = db.prepare("SELECT COUNT(*) as bills, SUM(total) as revenue FROM orders WHERE status != 'ยกเลิก' AND status != 'พักบิล'").get();
    const items = db.prepare("SELECT name, SUM(qty) as qty FROM order_items GROUP BY name ORDER BY qty DESC LIMIT 10").all();
    const lowStock = db.prepare("SELECT name, quantity, unit FROM ingredients WHERE threshold > 0 AND quantity <= threshold").all();
    
    const dbContext = `
    คุณคือผู้ช่วย AI ชื่อ "FoodPOS AI" สำหรับช่วยเจ้าของร้านอาหารวิเคราะห์ข้อมูล ตอบคำถามสั้นๆ สุภาพ เป็นกันเอง
    ข้อมูลร้านปัจจุบัน:
    - ยอดขายรวม: ${summary.revenue || 0} บาท
    - จำนวนบิล: ${summary.bills || 0} บิล
    - 10 อันดับเมนูขายดี: ${items.map(i => `${i.name} (${i.qty})`).join(", ")}
    - วัตถุดิบใกล้หมด: ${lowStock.length > 0 ? lowStock.map(i => `${i.name} เหลือ ${i.quantity.toFixed(1)} ${i.unit}`).join(", ") : "ไม่มี"}
    `;

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    
    const promptMessage = history.pop();
    const promptText = promptMessage.parts[0].text;

    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [...history, { role: 'user', parts: [{ text: promptText }] }],
        config: { systemInstruction: dbContext }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
         res.write(`data: ${JSON.stringify({ content: chunk.text })}\n\n`);
      }
    }
    
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Gemini Error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default r;
