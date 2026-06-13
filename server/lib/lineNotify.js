import fetch from "node-fetch"; // or use global fetch if available
import db from "../db.js";

export async function sendLineNotify(message) {
  try {
    // Fetch token from database settings
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'line_notify_token'").get();
    if (!setting || !setting.value) {
      return false; // Token not configured
    }

    const token = setting.value;
    const url = "https://notify-api.line.me/api/notify";

    // LINE Notify expects form-urlencoded data
    const params = new URLSearchParams();
    params.append("message", message);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${token}`
      },
      body: params
    });

    if (!response.ok) {
      console.error(`LINE Notify failed: ${response.status} ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending LINE Notify:", error);
    return false;
  }
}
