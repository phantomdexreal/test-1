/**
 * cQikly — DB Migration 001: Initial Schema
 * Phase: 1a-i-B
 *
 * Creates the foundational tables required for cQikly.
 * All subsequent migrations build on top of this schema.
 *
 * Tables created here are intentionally minimal — they provide the
 * structural skeleton. Columns and indexes are expanded in later phases
 * as features are built. Each phase's migration is its own file.
 *
 * Design principles:
 *  - TEXT for all string fields (SQLite affinity; flexible)
 *  - INTEGER for numeric IDs, counts, versions, timestamps (unix epoch)
 *  - REAL for currency amounts (better-sqlite3 handles JS numbers correctly)
 *  - Every table gets a rowid alias as `id INTEGER PRIMARY KEY`
 *  - Soft-delete pattern: `deleted_at TEXT` (NULL = active)
 *  - `created_at` and `updated_at` as ISO strings for human readability
 */

import Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  // ── Company Profile ─────────────────────────────────────────────────────
  // Stores the company info set during onboarding.
  // One row per DB file (each company profile is its own DB file — Hard Spec #9).
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_profile (
      id                    INTEGER PRIMARY KEY,
      firm_name             TEXT NOT NULL,
      nature_of_firm        TEXT,        -- 'product' | 'service'
      nature_of_business    TEXT,        -- JSON array: ['wholesale','retail','production']
      business_model        TEXT,        -- JSON array: ['b2b','b2c','c2c']
      gst_number            TEXT,
      address               TEXT,
      office_type           TEXT,        -- 'head' | 'branch'
      phone                 TEXT,
      email                 TEXT,
      logo_path             TEXT,        -- local file path
      financial_year_start  INTEGER DEFAULT 4,  -- month number (1=Jan, 4=Apr)
      bill_reset_cycle      TEXT DEFAULT 'yearly',  -- 'yearly' | 'monthly' | 'never'
      starting_bill_number  INTEGER DEFAULT 1,    -- one-time-only for migration (Hard Spec #3)
      onboarding_complete   INTEGER DEFAULT 0,    -- 0=false, 1=true
      created_at            TEXT DEFAULT (datetime('now')),
      updated_at            TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Customers ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id                INTEGER PRIMARY KEY,
      party_name        TEXT NOT NULL,
      address           TEXT,
      customer_group    TEXT,
      pincode           TEXT,
      state_name        TEXT,
      contact_person    TEXT,
      phone             TEXT,
      mobile            TEXT,
      email             TEXT,
      website           TEXT,
      pan_number        TEXT,
      gstin             TEXT,
      reg_type          TEXT,            -- 'registered' | 'unregistered' | 'consumer' | 'overseas'
      credit_limit      REAL,
      outstanding       REAL DEFAULT 0,
      transport_name    TEXT,            -- most recently used transport (Hard Spec #17)
      internal_notes    TEXT,            -- never shown on bills/PDFs (per Section 11)
      customer_since    TEXT,            -- ISO date string; auto from first bill or manual
      preferred_pdf_format TEXT,         -- last used PDF format (memory per party, Phase 6b-A)
      bill_count        INTEGER DEFAULT 0,
      deleted_at        TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Bills ───────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id                INTEGER PRIMARY KEY,
      bill_number       TEXT NOT NULL,
      bill_date         TEXT NOT NULL,   -- ISO date; editable (backdating allowed, Hard Spec)
      party_name        TEXT NOT NULL,
      customer_id       INTEGER REFERENCES customers(id),
      phone             TEXT,
      transport_name    TEXT,
      address           TEXT,
      gstin             TEXT,
      po_notes          TEXT,
      bill_format       TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'gst'
      status            TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid'|'paid'|'partial'|'cancelled'
      subtotal          REAL DEFAULT 0,
      grand_total       REAL DEFAULT 0,
      adjustments       TEXT,            -- JSON array of {label, amount} objects
      custom_columns    TEXT,            -- JSON: column definitions + cell data
      internal_notes    TEXT,            -- never on PDF (Section 9.1)
      pdf_format        TEXT,            -- 'simplified' | 'professional' | 'detailed'
      draft             INTEGER DEFAULT 0, -- 1 if unsaved draft
      version           INTEGER DEFAULT 1, -- incremented on every edit (Hard Spec #10)
      deleted_at        TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Bill Rows ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_rows (
      id            INTEGER PRIMARY KEY,
      bill_id       INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      row_index     INTEGER NOT NULL,   -- display order
      item_name     TEXT,
      qty           TEXT,              -- stored as text (free-form: '2', '2.5 kg')
      qty_unit      TEXT,              -- optional unit column
      rate          TEXT,              -- stored as text
      discount      TEXT,              -- stored as text (% or flat)
      discount_type TEXT,              -- 'percent' | 'flat'
      amount        REAL,              -- calculated; stored for history correctness
      gst_percent   REAL,             -- GST Format only
      gst_amount    REAL,             -- GST Format only
      pre_tax       REAL,             -- GST Format only
      highlight     TEXT,             -- JSON: {cell: color} per cell
      bold_ranges   TEXT,             -- JSON: array of bold ranges per cell
      custom_cells  TEXT,             -- JSON: {columnId: cellValue} for custom columns
      marked        INTEGER DEFAULT 0, -- 1 if this is a Mark cell (MKD system)
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Bill Versions ───────────────────────────────────────────────────────
  // Every single edit to a saved bill creates a preserved version (Hard Spec #10).
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_versions (
      id            INTEGER PRIMARY KEY,
      bill_id       INTEGER NOT NULL REFERENCES bills(id),
      version       INTEGER NOT NULL,
      snapshot      TEXT NOT NULL,     -- full JSON snapshot of the bill at that version
      edited_at     TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Inventory Items ─────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id              INTEGER PRIMARY KEY,
      item_name       TEXT NOT NULL,
      category        TEXT,
      sub_category    TEXT,
      price           REAL,            -- default price
      wholesale_price REAL,
      gst_price       REAL,
      credit_price    REAL,
      gst_rate        REAL,
      stock_qty       REAL DEFAULT 0,
      min_stock       REAL,            -- low-stock threshold
      unit            TEXT,            -- unit of measurement
      custom_prices   TEXT,            -- JSON: {columnName: value} for unlimited custom price cols
      deleted_at      TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Bill Number Sequence ────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_number_sequence (
      id              INTEGER PRIMARY KEY,
      current_number  INTEGER NOT NULL DEFAULT 0,
      prefix          TEXT DEFAULT '',
      year_label      TEXT,            -- e.g. '2024-25'
      reset_cycle     TEXT DEFAULT 'yearly',
      last_reset_date TEXT             -- ISO date of last reset
    )
  `)

  // ── Payments ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id            INTEGER PRIMARY KEY,
      customer_id   INTEGER REFERENCES customers(id),
      amount        REAL NOT NULL,
      payment_date  TEXT NOT NULL,
      reference     TEXT,
      notes         TEXT,
      linked_bills  TEXT,              -- JSON array of bill IDs
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Loose Inventory Transactions ────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS loose_inventory (
      id            INTEGER PRIMARY KEY,
      item_name     TEXT NOT NULL,
      qty           REAL,
      unit          TEXT,
      direction     TEXT NOT NULL,     -- 'in' | 'out'
      notes         TEXT,
      transaction_date TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── Indexes ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bills_party ON bills(party_name);
    CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
    CREATE INDEX IF NOT EXISTS idx_bill_rows_bill ON bill_rows(bill_id);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(party_name);
    CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items(item_name);
    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
  `)

  // ── Seed the bill number sequence ───────────────────────────────────────
  db.exec(`
    INSERT OR IGNORE INTO bill_number_sequence (id, current_number)
    VALUES (1, 0)
  `)
}

export function down(db: Database.Database): void {
  // Drop in reverse order of creation (respect foreign key dependencies)
  db.exec(`
    DROP INDEX IF EXISTS idx_payments_customer;
    DROP INDEX IF EXISTS idx_inventory_name;
    DROP INDEX IF EXISTS idx_customers_name;
    DROP INDEX IF EXISTS idx_bill_rows_bill;
    DROP INDEX IF EXISTS idx_bills_status;
    DROP INDEX IF EXISTS idx_bills_date;
    DROP INDEX IF EXISTS idx_bills_party;

    DROP TABLE IF EXISTS loose_inventory;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS bill_number_sequence;
    DROP TABLE IF EXISTS inventory_items;
    DROP TABLE IF EXISTS bill_versions;
    DROP TABLE IF EXISTS bill_rows;
    DROP TABLE IF EXISTS bills;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS company_profile;
  `)
}
