import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const LOG_DIR = path.join(ROOT_DIR, "logs");
const BACKUP_ROOT = path.join(DATA_DIR, "backups");

const DAILY_DIR = path.join(BACKUP_ROOT, "daily");
const WEEKLY_DIR = path.join(BACKUP_ROOT, "weekly");
const MONTHLY_DIR = path.join(BACKUP_ROOT, "monthly");

// Ensure directories exist
fs.mkdirSync(DAILY_DIR, { recursive: true });
fs.mkdirSync(WEEKLY_DIR, { recursive: true });
fs.mkdirSync(MONTHLY_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

const logFile = path.join(LOG_DIR, "backup.log");

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

function getSortedFiles(dir) {
  return fs.readdirSync(dir)
    .filter(file => file.endsWith(".db"))
    .map(file => ({
      name: file,
      path: path.join(dir, file),
      time: fs.statSync(path.join(dir, file)).mtimeMs
    }))
    .sort((a, b) => b.time - a.time); // newest first
}

function pruneBackups(dir, maxCount) {
  const files = getSortedFiles(dir);
  if (files.length > maxCount) {
    const toDelete = files.slice(maxCount);
    for (const f of toDelete) {
      try {
        fs.unlinkSync(f.path);
        log(`Pruned old backup: ${f.name} from ${path.basename(dir)}`);
      } catch (e) {
        log(`Failed to prune ${f.name}: ${e.message}`);
      }
    }
  }
}

async function runBackup() {
  const dbPath = process.env.DB_PATH || path.join(DATA_DIR, "foodpos.db");
  if (!fs.existsSync(dbPath)) {
    log(`Error: Database file not found at ${dbPath}`);
    process.exit(1);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${date}`;

  const dailyFilename = `foodpos-${dateStr}.db`;
  const dailyPath = path.join(DAILY_DIR, dailyFilename);

  // If daily backup already exists for today, remove it first so VACUUM INTO doesn't fail
  if (fs.existsSync(dailyPath)) {
    fs.unlinkSync(dailyPath);
  }

  log(`Starting database backup for ${dateStr}...`);
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
    
    // Safely run VACUUM INTO to create an online backup copy
    db.prepare("VACUUM INTO ?").run(dailyPath);
    log(`Successfully created daily backup: ${dailyFilename}`);

    // GFS Retention Policy
    // 1. Weekly: If today is Sunday (day 0), copy daily backup to weekly folder
    if (now.getDay() === 0) {
      const weeklyPath = path.join(WEEKLY_DIR, dailyFilename);
      if (fs.existsSync(weeklyPath)) fs.unlinkSync(weeklyPath);
      fs.copyFileSync(dailyPath, weeklyPath);
      log(`Copied to weekly backup: ${dailyFilename}`);
    }

    // 2. Monthly: If today is the 1st of the month, copy daily backup to monthly folder
    if (now.getDate() === 1) {
      const monthlyFilename = `foodpos-${year}-${month}.db`;
      const monthlyPath = path.join(MONTHLY_DIR, monthlyFilename);
      if (fs.existsSync(monthlyPath)) fs.unlinkSync(monthlyPath);
      fs.copyFileSync(dailyPath, monthlyPath);
      log(`Copied to monthly backup: ${monthlyFilename}`);
    }

    // Prune excess backups according to retention plan
    pruneBackups(DAILY_DIR, 7);   // Keep 7 days
    pruneBackups(WEEKLY_DIR, 4);  // Keep 4 weeks
    pruneBackups(MONTHLY_DIR, 12); // Keep 12 months

    log("Backup run completed successfully.");
  } catch (err) {
    log(`Backup failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

runBackup();
