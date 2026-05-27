import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(DATA_DIR, "foodpos.db");
const db = new Database(dbPath);

// --- Production PRAGMAs (Skill Pack v4) ---------------------------------
// Order matters: journal_mode first, then perf flags, then integrity.
db.pragma("journal_mode = WAL");        // concurrent reader/writer
db.pragma("synchronous = NORMAL");      // 3x faster than FULL, safe under WAL
db.pragma("busy_timeout = 5000");       // wait up to 5s on locked DB instead of throwing
db.pragma("cache_size = -64000");       // 64MB read cache (negative = KB)
db.pragma("mmap_size = 268435456");     // 256MB memory-mapped I/O
db.pragma("temp_store = MEMORY");       // temp tables in RAM, not disk
db.pragma("foreign_keys = ON");         // referential integrity

export default db;
