import express from "express";

export const router = express.Router();
const clients = new Set();

router.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Keep alive payload
  res.write("data: {}\n\n");

  clients.add(res);

  req.on("close", () => {
    clients.delete(res);
  });
});

export function sendSSE(type, data = {}) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    try {
      client.write(`event: ${type}\ndata: ${payload}\n\n`);
    } catch (err) {
      clients.delete(client);
    }
  }
}
