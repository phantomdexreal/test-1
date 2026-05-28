/**
 * cQikly — DB Migration 002: Inventory Phase 9b-A additions
 *
 * Adds:
 *   - inventory_price_history   — log of every price change per item
 *   - inventory_usage_history   — per-item record of which bill used it, party, date, price
 *   - barcode column on inventory_items (if not present)
 *   - barcode index for fast scanner-lookup
 */

import Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  // ── Barcode column on inventory_items ───────────────────────────────────
  // Guard: column may already exist if migration is re-run
  const cols = (db.prepare("PRAGMA table_info(inventory_items)").all() as Array<{ name: string }>)
    .map(r => r.name)

  if (!cols.includes('barcode')) {
    db.exec(`ALTER TABLE inventory_items ADD COLUMN barcode TEXT DEFAULT ''`)
  }
  if (!cols.includes('image_path')) {
    db.exec(`ALTER TABLE inventory_items ADD COLUMN image_path TEXT DEFAULT ''`)
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory_items(barcode);
  `)

  // ── Price History ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_price_history (
      id            INTEGER PRIMARY KEY,
      item_id       INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      field         TEXT NOT NULL,      -- 'price' | 'wholesale_price' | 'gst_price' | 'credit_price' | custom col id
      field_label   TEXT NOT NULL,      -- human-readable label at time of change
      old_value     TEXT,
      new_value     TEXT,
      changed_at    TEXT DEFAULT (datetime('now'))
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_price_history_item ON inventory_price_history(item_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_date ON inventory_price_history(changed_at);
  `)

  // ── Usage History ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_usage_history (
      id            INTEGER PRIMARY KEY,
      item_id       INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      party_name    TEXT,
      bill_id       INTEGER REFERENCES bills(id),
      bill_number   TEXT,
      bill_date     TEXT,
      qty           TEXT,
      rate          TEXT,
      amount        TEXT,
      recorded_at   TEXT DEFAULT (datetime('now'))
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_usage_history_item ON inventory_usage_history(item_id);
    CREATE INDEX IF NOT EXISTS idx_usage_history_date ON inventory_usage_history(bill_date);
    CREATE INDEX IF NOT EXISTS idx_usage_history_party ON inventory_usage_history(party_name);
  `)
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_usage_history_party;
    DROP INDEX IF EXISTS idx_usage_history_date;
    DROP INDEX IF EXISTS idx_usage_history_item;
    DROP TABLE IF EXISTS inventory_usage_history;
    DROP INDEX IF EXISTS idx_price_history_date;
    DROP INDEX IF EXISTS idx_price_history_item;
    DROP TABLE IF EXISTS inventory_price_history;
    DROP INDEX IF EXISTS idx_inventory_barcode;
  `)
}
