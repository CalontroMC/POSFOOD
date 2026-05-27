import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { ensureDb } from "./init-db.js";
import authRouter from "./routes/auth.js";
import menuRouter from "./routes/menu.js";
import tablesRouter from "./routes/tables.js";
import ordersRouter from "./routes/orders.js";
import membersRouter from "./routes/members.js";
import settingsRouter from "./routes/settings.js";
import uploadsRouter, { UPLOAD_DIR } from "./routes/uploads.js";
import employeesRouter from "./routes/employees.js";
import shiftsRouter from "./routes/shifts.js";
import ingredientsRouter from "./routes/ingredients.js";
import reportsRouter from "./routes/reports.js";
import timeclockRouter from "./routes/timeclock.js";
import printersRouter from "./routes/printers.js";
import billRequestsRouter from "./routes/billRequests.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
ensureDb();

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(cors());
app.use(morgan("tiny"));

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/menu", menuRouter);
app.use("/api/tables", tablesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/members", membersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/ingredients", ingredientsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/timeclock", timeclockRouter);
app.use("/api/printers", printersRouter);
app.use("/api/bill-requests", billRequestsRouter);

app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "30d",
    setHeaders: (res) => res.set("Cache-Control", "public, max-age=2592000"),
  })
);

// Serve built frontend in production
const distDir = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "internal error" });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`FoodPOS server listening on http://localhost:${PORT}`);
});
