import crypto from "node:crypto";
import db from "./db.js";

function randomToken(len = 16) {
  return crypto.randomBytes(len).toString("hex");
}

function ensureColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      price INTEGER NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      description TEXT,
      available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_option_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      max_select INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_mog_item ON menu_option_groups(menu_item_id);

    CREATE TABLE IF NOT EXISTS menu_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES menu_option_groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_delta INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_mo_group ON menu_options(group_id);

    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT NOT NULL UNIQUE,
      seats INTEGER NOT NULL DEFAULT 2,
      zone TEXT NOT NULL DEFAULT 'ในร้าน',
      status TEXT NOT NULL DEFAULT 'ว่าง',
      qr_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      spending INTEGER NOT NULL DEFAULT 0,
      visits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'รอรับ',
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    -- v4 composite: status + created_at for "list by status sorted newest first"
    CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
    -- v4 composite: table_id + status for "active orders at this table"
    CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      note TEXT,
      options_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'พนักงาน',
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      opened_by_name TEXT NOT NULL,
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      opening_cash INTEGER NOT NULL DEFAULT 0,
      closing_cash_counted INTEGER,
      expected_cash INTEGER,
      variance INTEGER,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
    CREATE INDEX IF NOT EXISTS idx_shifts_opened ON shifts(opened_at);

    CREATE TABLE IF NOT EXISTS cash_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cash_drops_shift ON cash_drops(shift_id);

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'หน่วย',
      quantity REAL NOT NULL DEFAULT 0,
      threshold REAL NOT NULL DEFAULT 0,
      cost_per_unit REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      qty REAL NOT NULL,
      UNIQUE(menu_item_id, ingredient_id)
    );
    CREATE INDEX IF NOT EXISTS idx_recipes_item ON recipes(menu_item_id);

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      delta REAL NOT NULL,
      reason TEXT,
      ref_order_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sm_ing ON stock_movements(ingredient_id);

    CREATE TABLE IF NOT EXISTS clock_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clock_emp ON clock_events(employee_id);
  `);

  // Discount columns on orders + order_items
  ensureColumn("orders", "discount_type", "TEXT");
  ensureColumn("orders", "discount_value", "INTEGER");
  ensureColumn("order_items", "discount_value", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("order_items", "discount_type", "TEXT");
  // Customer demographics
  ensureColumn("members", "email", "TEXT");
  // KDS: which categories show on the kitchen display (drinks/desserts off)
  ensureColumn("categories", "kitchen", "INTEGER NOT NULL DEFAULT 1");
  // KDS: per-item override (default 1 = show)
  ensureColumn("menu_items", "kitchen", "INTEGER NOT NULL DEFAULT 1");
  // Custom label for held / take-away bills
  ensureColumn("orders", "label", "TEXT");

  // Bill requests (customer presses "Call for bill" from /order page)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
      table_number TEXT,
      table_token TEXT,
      status TEXT NOT NULL DEFAULT 'รอ',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bill_requests_status ON bill_requests(status);
    CREATE INDEX IF NOT EXISTS idx_bill_requests_created ON bill_requests(created_at);
    -- v4 composite: status + created_at for "list open bill requests newest first"
    CREATE INDEX IF NOT EXISTS idx_bill_requests_status_created ON bill_requests(status, created_at);
  `);

  // v4: run ANALYZE so query planner knows index selectivity
  // Cheap to run; SQLite stores stats in sqlite_stat1
  try { db.exec("ANALYZE;"); } catch {}

  // Idempotent ALTER for older DBs
  ensureColumn("menu_items", "description", "TEXT");
  ensureColumn("order_items", "options_json", "TEXT");
  ensureColumn("orders", "shift_id", "INTEGER REFERENCES shifts(id) ON DELETE SET NULL");
  ensureColumn("orders", "payment_method", "TEXT");
  // Loyalty: how many points were redeemed at checkout (1 pt = 1 baht discount)
  ensureColumn("orders", "points_redeemed", "INTEGER NOT NULL DEFAULT 0");

  // --- v6: Loyalty/LINE foundation (extend members, don't duplicate) ---
  ensureColumn("members", "line_user_id", "TEXT");
  ensureColumn("members", "tier", "TEXT NOT NULL DEFAULT 'silver'");
  ensureColumn("members", "last_visit_at", "TEXT");

  // Partial UNIQUE: allow multiple NULLs but enforce uniqueness on real values
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_members_line_user_id
      ON members(line_user_id) WHERE line_user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_members_tier ON members(tier);

    -- Audit trail for every point change. Atomic counterpart to members.points
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      points_delta INTEGER NOT NULL,         -- + earn / - redeem
      balance_after INTEGER NOT NULL,        -- snapshot for audit
      reason TEXT,                           -- 'earn:order' | 'redeem:reward' | 'adjust:admin' ...
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_member ON loyalty_transactions(member_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON loyalty_transactions(order_id);
  `);

  // --- Loyverse sync ---
  ensureColumn("menu_items", "loyverse_variant_id", "TEXT");

  db.exec(`
    CREATE TABLE IF NOT EXISTS loyverse_sync_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id       INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      status         TEXT NOT NULL DEFAULT 'pending',
      receipt_number TEXT,
      error          TEXT,
      payload_json   TEXT,
      attempts       INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_loyverse_sync_status ON loyverse_sync_log(status);
  `);
}

export function seedIfEmpty() {
  const catCount = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
  if (catCount === 0) {
    const cats = [
      "ขนมและของหวาน",
      "เครื่องดื่ม",
      "ของทอด",
      "อาหารจานเดียว",
    ];
    const insertCat = db.prepare(
      "INSERT INTO categories (name, sort_order) VALUES (?, ?)"
    );
    cats.forEach((name, i) => insertCat.run(name, i));
  }

  const itemCount = db.prepare("SELECT COUNT(*) AS n FROM menu_items").get().n;
  if (itemCount === 0) {
    const catIdByName = Object.fromEntries(
      db
        .prepare("SELECT id, name FROM categories")
        .all()
        .map((c) => [c.name, c.id])
    );
    const items = [
      ["ข้าวกะเพราหมูสับ", "อาหารจานเดียว", 60, 2, "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=70"],
      ["ข้าวผัดกุ้ง", "อาหารจานเดียว", 80, 3, "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=70"],
      ["ผัดไทยกุ้งสด", "อาหารจานเดียว", 75, 3, "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=600&q=70"],
      ["ไก่ทอดน้ำปลา", "ของทอด", 90, 3, "https://images.unsplash.com/photo-1626082896492-766af4eb6501?auto=format&fit=crop&w=600&q=70"],
      ["เฟรนช์ฟรายส์", "ของทอด", 45, 1, "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=70"],
      ["ปอเปี๊ยะทอด", "ของทอด", 50, 1, "https://images.unsplash.com/photo-1606851179386-29a3b3007ffd?auto=format&fit=crop&w=600&q=70"],
      ["ชาไทยเย็น", "เครื่องดื่ม", 35, 1, "https://images.unsplash.com/photo-1558857563-c0c6c4b39b8e?auto=format&fit=crop&w=600&q=70"],
      ["กาแฟเย็น", "เครื่องดื่ม", 40, 1, "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=70"],
      ["น้ำมะนาวโซดา", "เครื่องดื่ม", 45, 1, "https://images.unsplash.com/photo-1622597468968-475db75a4daa?auto=format&fit=crop&w=600&q=70"],
      ["บัวลอยน้ำขิง", "ขนมและของหวาน", 55, 2, "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=70"],
      ["ข้าวเหนียวมะม่วง", "ขนมและของหวาน", 70, 2, "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?auto=format&fit=crop&w=600&q=70"],
      ["ไอศกรีมกะทิ", "ขนมและของหวาน", 40, 1, "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=70"],
    ];
    const ins = db.prepare(
      "INSERT INTO menu_items (name, category_id, price, points, image_url) VALUES (?, ?, ?, ?, ?)"
    );
    items.forEach(([name, cat, price, pts, img]) =>
      ins.run(name, catIdByName[cat], price, pts, img)
    );
  }

  const tableCount = db.prepare("SELECT COUNT(*) AS n FROM tables").get().n;
  if (tableCount === 0) {
    const tables = [
      ["A1", 2, "ในร้าน"],
      ["A2", 4, "ในร้าน"],
      ["A3", 4, "ในร้าน"],
      ["A4", 2, "ในร้าน"],
      ["B1", 6, "ในร้าน"],
      ["B2", 6, "ในร้าน"],
      ["C1", 4, "นอกร้าน"],
      ["C2", 4, "นอกร้าน"],
      ["D1", 2, "มุมนอกร้าน"],
      ["D2", 2, "มุมนอกร้าน"],
    ];
    const ins = db.prepare(
      "INSERT INTO tables (table_number, seats, zone, qr_token) VALUES (?, ?, ?, ?)"
    );
    tables.forEach(([num, seats, zone]) =>
      ins.run(num, seats, zone, randomToken(12))
    );
  }

  const settingsCount = db.prepare("SELECT COUNT(*) AS n FROM settings").get().n;
  if (settingsCount === 0) {
    const ins = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    // first-run: no admin yet — frontend must call /api/auth/setup
    ins.run("first_run_done", "0");
    ins.run("admin_name", "");
    ins.run("store_name", "");
    ins.run("store_phone", "");
    ins.run("store_address", "");
    ins.run("store_tax_id", "");
    ins.run("receipt_footer", "ขอบคุณที่ใช้บริการครับ");
  } else {
    // existing DB: mark setup as done so user isn't forced through first-run again
    db.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES ('first_run_done', '1')"
    ).run();
    db.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_name', '')"
    ).run();
  }
}

export function ensureDb() {
  initSchema();
  seedIfEmpty();
}

const isMain =
  process.argv[1] &&
  import.meta.url.toLowerCase() ===
    "file:///" + process.argv[1].replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();

if (isMain) {
  ensureDb();
  console.log("Database initialized.");
}
