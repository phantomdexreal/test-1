/**
 * cQikly — Inventory Service
 * Phase 9b-A: Price change history, product usage history, bulk price update,
 *             barcode/SKU field (searchable, scanner-autodetect).
 *
 * All inventory access goes through this service — no direct DB calls from components.
 *
 * Storage strategy (dev/browser mode): localStorage under 'cq:inventory:*' keys.
 * In Electron: IPC to main process → SQLite.
 */

import { eventBus } from '../utils/eventBus'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomPriceColumn {
  id: string          // stable uuid-ish key
  label: string       // user-defined name e.g. "Export Price"
}

export interface InventoryItemFull {
  id: string
  /** SQLite rowid — populated on load, used for DB writes */
  sqliteId?: number
  itemName: string
  category: string        // '' = uncategorised
  subCategory: string     // '' = none
  price: string           // Price (default selling price)
  wholesalePrice: string  // Wholesale Price
  gstPrice: string        // GST Price
  creditPrice: string     // Credit
  gstRate: string         // GST % e.g. "18"
  // Unlimited custom price columns — keys are CustomPriceColumn.id
  customPrices: Record<string, string>
  // Stock fields (Phase 9a-B)
  stockQty: string
  lowStockThreshold: string
  unit: string
  // Phase 9b-A: Barcode/SKU
  barcode: string
  imagePath: string
  createdAt: string
  updatedAt: string
}

export type InventoryItemPartial = Partial<InventoryItemFull> & { id: string }

// ─── Price History ─────────────────────────────────────────────────────────────

/** Which price columns are tracked for history */
export const TRACKED_PRICE_COLS = ['price', 'wholesalePrice', 'gstPrice', 'creditPrice'] as const
export type TrackedPriceCol = typeof TRACKED_PRICE_COLS[number]

export const PRICE_COL_LABELS: Record<TrackedPriceCol, string> = {
  price:          'Price',
  wholesalePrice: 'Wholesale Price',
  gstPrice:       'GST Price',
  creditPrice:    'Credit',
}

export interface PriceChangeEntry {
  id: string
  itemId: string
  field: string         // 'price' | 'wholesalePrice' | 'gstPrice' | 'creditPrice' | custom col id
  fieldLabel: string    // human-readable label at time of change
  oldValue: string
  newValue: string
  changedAt: string     // ISO datetime
}

// ─── Usage History ─────────────────────────────────────────────────────────────

export interface UsageEntry {
  id: string
  itemId: string
  partyName: string
  billId: string | number
  billNumber: string
  billDate: string      // ISO date
  qty: string
  rate: string          // price at which it was billed
  amount: string
  recordedAt: string    // ISO datetime (when this entry was written)
}

// ─── Rate source config per bill format ───────────────────────────────────────

export type BuiltInPriceField = 'price' | 'wholesalePrice' | 'gstPrice' | 'creditPrice'
export type PriceFieldId = BuiltInPriceField | string // built-in or custom column id

export interface InventoryRateSourceConfig {
  freeFormat: PriceFieldId    // which price field to use when inserting in Free Format
  gstFormat: PriceFieldId     // which price field to use when inserting in GST Format
}

export const DEFAULT_RATE_SOURCE_CONFIG: InventoryRateSourceConfig = {
  freeFormat: 'price',
  gstFormat:  'gstPrice',
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface InventoryCategory {
  id: string
  name: string
  subCategories: string[]
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const LS_ITEMS_KEY        = 'cq:inventory:items'
const LS_COLS_KEY         = 'cq:inventory:customCols'
const LS_CATS_KEY         = 'cq:inventory:categories'
const LS_RATE_KEY         = 'cq:inventory:rateSource'
const LS_PRICE_HIST_KEY   = 'cq:inventory:priceHistory'
const LS_USAGE_HIST_KEY   = 'cq:inventory:usageHistory'

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return fallback
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

// ─── IPC helper ───────────────────────────────────────────────────────────────

function getIpc(): Window['cqikly'] | null {
  if (typeof window === 'undefined') return null
  return (window as Window).cqikly ?? null
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _items: InventoryItemFull[] = []
let _cols: CustomPriceColumn[] = []
let _cats: InventoryCategory[] = []
let _rateSource: InventoryRateSourceConfig = { ...DEFAULT_RATE_SOURCE_CONFIG }
let _priceHistory: PriceChangeEntry[] = []
let _usageHistory: UsageEntry[] = []
let _loaded = false

function ensureLoaded(): void {
  if (_loaded) return
  _items       = lsGet<InventoryItemFull[]>(LS_ITEMS_KEY, [])
  _cols        = lsGet<CustomPriceColumn[]>(LS_COLS_KEY, [])
  _cats        = lsGet<InventoryCategory[]>(LS_CATS_KEY, [])
  _rateSource  = lsGet<InventoryRateSourceConfig>(LS_RATE_KEY, { ...DEFAULT_RATE_SOURCE_CONFIG })
  _priceHistory = lsGet<PriceChangeEntry[]>(LS_PRICE_HIST_KEY, [])
  _usageHistory = lsGet<UsageEntry[]>(LS_USAGE_HIST_KEY, [])
  _loaded = true
}

function persist(): void {
  lsSet(LS_ITEMS_KEY,      _items)
  lsSet(LS_COLS_KEY,       _cols)
  lsSet(LS_CATS_KEY,       _cats)
  lsSet(LS_RATE_KEY,       _rateSource)
  lsSet(LS_PRICE_HIST_KEY, _priceHistory)
  lsSet(LS_USAGE_HIST_KEY, _usageHistory)
  eventBus.emit('inventoryChanged', {})
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _idCounter = Date.now()
function newId(): string  { return `inv-${++_idCounter}` }
function newColId(): string { return `cp-${++_idCounter}` }
function newCatId(): string { return `cat-${++_idCounter}` }
function newHistId(): string { return `ph-${++_idCounter}` }
function newUsageId(): string { return `uh-${++_idCounter}` }

// ─── Price-field label resolver ───────────────────────────────────────────────

function resolvePriceLabel(field: string): string {
  if (field in PRICE_COL_LABELS) return PRICE_COL_LABELS[field as TrackedPriceCol]
  const col = _cols.find(c => c.id === field)
  return col?.label ?? field
}

// ─── Price-change recorder ────────────────────────────────────────────────────

/**
 * Called by updateItem whenever a price-related field changes.
 * Compares old vs new values and logs an entry when they differ.
 */
function recordPriceChangesIfAny(
  itemId: string,
  oldItem: InventoryItemFull,
  patch: Partial<InventoryItemFull>
): void {
  const now = new Date().toISOString()
  const ipc = getIpc()

  // Built-in price fields
  const builtIn: Array<TrackedPriceCol> = ['price', 'wholesalePrice', 'gstPrice', 'creditPrice']
  for (const field of builtIn) {
    if (field in patch) {
      const oldVal = oldItem[field] ?? ''
      const newVal = (patch[field] as string) ?? ''
      if (oldVal !== newVal) {
        _priceHistory.push({
          id: newHistId(), itemId,
          field, fieldLabel: PRICE_COL_LABELS[field],
          oldValue: oldVal, newValue: newVal,
          changedAt: now,
        })
        // Write to SQLite (non-fatal)
        if (ipc && oldItem.sqliteId) {
          ipc.db.run(
            `INSERT INTO inventory_price_history (item_id, field, field_label, old_value, new_value)
             VALUES (?,?,?,?,?)`,
            [oldItem.sqliteId, field, PRICE_COL_LABELS[field], oldVal, newVal]
          ).catch((err: unknown) => console.warn('[InventoryService] price history DB write failed:', err))
        }
      }
    }
  }

  // Custom price columns
  if (patch.customPrices) {
    for (const [colId, newVal] of Object.entries(patch.customPrices)) {
      const oldVal = oldItem.customPrices[colId] ?? ''
      if (oldVal !== String(newVal)) {
        _priceHistory.push({
          id: newHistId(), itemId,
          field: colId, fieldLabel: resolvePriceLabel(colId),
          oldValue: oldVal, newValue: String(newVal),
          changedAt: now,
        })
        // Write to SQLite (non-fatal)
        if (ipc && oldItem.sqliteId) {
          ipc.db.run(
            `INSERT INTO inventory_price_history (item_id, field, field_label, old_value, new_value)
             VALUES (?,?,?,?,?)`,
            [oldItem.sqliteId, colId, resolvePriceLabel(colId), oldVal, String(newVal)]
          ).catch((err: unknown) => console.warn('[InventoryService] custom price history DB write failed:', err))
        }
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const inventoryService = {
  // ── Items ──────────────────────────────────────────────────────────────────

  getItems(): InventoryItemFull[] {
    ensureLoaded()
    return [..._items]
  },

  async addItem(partial: Partial<Omit<InventoryItemFull, 'id' | 'createdAt' | 'updatedAt'>>): Promise<InventoryItemFull> {
    ensureLoaded()
    const now = new Date().toISOString()
    const item: InventoryItemFull = {
      id: newId(),
      itemName: '',
      category: '',
      subCategory: '',
      price: '',
      wholesalePrice: '',
      gstPrice: '',
      creditPrice: '',
      gstRate: '',
      customPrices: {},
      stockQty: '',
      lowStockThreshold: '',
      unit: '',
      barcode: '',
      imagePath: '',
      ...partial,
      createdAt: now,
      updatedAt: now,
    }
    _items.push(item)
    persist()

    // Write to SQLite (non-fatal)
    const ipc = getIpc()
    if (ipc) {
      try {
        await ipc.db.run(
          `INSERT INTO inventory_items
            (item_name, category, sub_category, price, wholesale_price, gst_price, credit_price,
             gst_rate, stock_qty, min_stock, unit, custom_prices, barcode, image_path, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
          [
            item.itemName, item.category || null, item.subCategory || null,
            parseFloat(item.price) || null, parseFloat(item.wholesalePrice) || null,
            parseFloat(item.gstPrice) || null, parseFloat(item.creditPrice) || null,
            parseFloat(item.gstRate) || null, parseFloat(item.stockQty) || 0,
            parseFloat(item.lowStockThreshold) || null, item.unit || null,
            JSON.stringify(item.customPrices || {}),
            item.barcode || null, item.imagePath || null,
          ]
        )
        const sqlRows = await ipc.db.query(
          `SELECT id FROM inventory_items WHERE item_name = ? ORDER BY created_at DESC LIMIT 1`,
          [item.itemName]
        ) as Array<{ id: number }>
        if (sqlRows[0]) item.sqliteId = sqlRows[0].id
      } catch (err) {
        console.warn('[InventoryService] addItem DB write failed:', err)
      }
    }

    return item
  },

  updateItem(id: string, patch: Partial<InventoryItemFull>): void {
    ensureLoaded()
    const idx = _items.findIndex(i => i.id === id)
    if (idx === -1) return
    const oldItem = _items[idx]
    // Record price history before applying patch
    recordPriceChangesIfAny(id, oldItem, patch)
    _items[idx] = { ...oldItem, ...patch, updatedAt: new Date().toISOString() }
    persist()

    // Write to SQLite (non-fatal)
    const sqliteId = _items[idx].sqliteId
    if (sqliteId) {
      const ipc = getIpc()
      if (ipc) {
        const fieldMap: Record<string, string> = {
          itemName: 'item_name', category: 'category', subCategory: 'sub_category',
          price: 'price', wholesalePrice: 'wholesale_price', gstPrice: 'gst_price',
          creditPrice: 'credit_price', gstRate: 'gst_rate', stockQty: 'stock_qty',
          lowStockThreshold: 'min_stock', unit: 'unit', customPrices: 'custom_prices',
          barcode: 'barcode', imagePath: 'image_path',
        }
        const sets: string[] = []
        const params: unknown[] = []
        for (const [key, val] of Object.entries(patch)) {
          const col = fieldMap[key]
          if (col) {
            sets.push(`${col} = ?`)
            params.push(key === 'customPrices' ? JSON.stringify(val) : (val ?? null))
          }
        }
        if (sets.length > 0) {
          sets.push(`updated_at = datetime('now')`)
          params.push(sqliteId)
          ipc.db.run(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`, params)
            .catch((err: unknown) => console.warn('[InventoryService] updateItem DB write failed:', err))
        }
      }
    }
  },

  deleteItem(id: string): void {
    ensureLoaded()
    const item = _items.find(i => i.id === id)
    _items = _items.filter(i => i.id !== id)
    // Keep history — useful for audit even after deletion
    persist()

    // Soft-delete in SQLite (non-fatal)
    if (item?.sqliteId) {
      const ipc = getIpc()
      if (ipc) {
        ipc.db.run(`UPDATE inventory_items SET deleted_at = datetime('now') WHERE id = ?`, [item.sqliteId])
          .catch((err: unknown) => console.warn('[InventoryService] deleteItem DB write failed:', err))
      }
    }
  },

  // ── Custom Price Columns ───────────────────────────────────────────────────

  getCustomColumns(): CustomPriceColumn[] {
    ensureLoaded()
    return [..._cols]
  },

  addCustomColumn(label: string): CustomPriceColumn {
    ensureLoaded()
    const col: CustomPriceColumn = { id: newColId(), label }
    _cols.push(col)
    _items = _items.map(item => ({
      ...item,
      customPrices: { ...item.customPrices, [col.id]: '' },
    }))
    persist()
    return col
  },

  renameCustomColumn(colId: string, newLabel: string): void {
    ensureLoaded()
    const idx = _cols.findIndex(c => c.id === colId)
    if (idx === -1) return
    _cols[idx] = { ..._cols[idx], label: newLabel }
    persist()
  },

  deleteCustomColumn(colId: string): void {
    ensureLoaded()
    _cols = _cols.filter(c => c.id !== colId)
    _items = _items.map(item => {
      const cp = { ...item.customPrices }
      delete cp[colId]
      return { ...item, customPrices: cp }
    })
    if (_rateSource.freeFormat === colId) _rateSource = { ..._rateSource, freeFormat: 'price' }
    if (_rateSource.gstFormat  === colId) _rateSource = { ..._rateSource, gstFormat:  'gstPrice' }
    persist()
  },

  // ── Categories ─────────────────────────────────────────────────────────────

  getCategories(): InventoryCategory[] {
    ensureLoaded()
    return [..._cats]
  },

  addCategory(name: string): InventoryCategory {
    ensureLoaded()
    const cat: InventoryCategory = { id: newCatId(), name, subCategories: [] }
    _cats.push(cat)
    persist()
    return cat
  },

  addSubCategory(catId: string, subName: string): void {
    ensureLoaded()
    const cat = _cats.find(c => c.id === catId)
    if (!cat || cat.subCategories.includes(subName)) return
    cat.subCategories = [...cat.subCategories, subName]
    persist()
  },

  deleteCategory(catId: string): void {
    ensureLoaded()
    _cats = _cats.filter(c => c.id !== catId)
    _items = _items.map(i => i.category === catId ? { ...i, category: '', subCategory: '' } : i)
    persist()
  },

  // ── Inventory Rate Source Config ───────────────────────────────────────────

  getRateSourceConfig(): InventoryRateSourceConfig {
    ensureLoaded()
    return { ..._rateSource }
  },

  setRateSourceConfig(cfg: Partial<InventoryRateSourceConfig>): void {
    ensureLoaded()
    _rateSource = { ..._rateSource, ...cfg }
    persist()
  },

  getPriceFieldOptions(): Array<{ id: PriceFieldId; label: string }> {
    ensureLoaded()
    const builtIns: Array<{ id: PriceFieldId; label: string }> = [
      { id: 'price',          label: 'Price' },
      { id: 'wholesalePrice', label: 'Wholesale Price' },
      { id: 'gstPrice',       label: 'GST Price' },
      { id: 'creditPrice',    label: 'Credit' },
    ]
    const customs = _cols.map(c => ({ id: c.id as PriceFieldId, label: c.label }))
    return [...builtIns, ...customs]
  },

  getPriceValue(item: InventoryItemFull, fieldId: PriceFieldId): string {
    switch (fieldId) {
      case 'price':          return item.price
      case 'wholesalePrice': return item.wholesalePrice
      case 'gstPrice':       return item.gstPrice
      case 'creditPrice':    return item.creditPrice
      default:               return item.customPrices[fieldId] ?? ''
    }
  },

  // ── Price History ──────────────────────────────────────────────────────────

  /** Get all price change entries for a specific item, newest first */
  getPriceHistory(itemId: string): PriceChangeEntry[] {
    ensureLoaded()
    return _priceHistory
      .filter(e => e.itemId === itemId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
  },

  // ── Usage History ──────────────────────────────────────────────────────────

  /** Get all usage entries for a specific item, newest first */
  getUsageHistory(itemId: string): UsageEntry[] {
    ensureLoaded()
    return _usageHistory
      .filter(e => e.itemId === itemId)
      .sort((a, b) => b.billDate.localeCompare(a.billDate))
  },

  /**
   * Record usage from a bill save.
   * Called by bill.service after a bill is saved when stock deduction is active
   * OR unconditionally for usage tracking.
   *
   * @param entries — array of line items from the bill that matched inventory items
   */
  recordUsageFromBill(entries: Array<{
    itemId: string
    partyName: string
    billId: string | number
    billNumber: string
    billDate: string
    qty: string
    rate: string
    amount: string
  }>): void {
    ensureLoaded()
    const now = new Date().toISOString()
    const ipc = getIpc()
    for (const e of entries) {
      _usageHistory.push({
        id: newUsageId(),
        itemId: e.itemId,
        partyName: e.partyName,
        billId: e.billId,
        billNumber: e.billNumber,
        billDate: e.billDate,
        qty: e.qty,
        rate: e.rate,
        amount: e.amount,
        recordedAt: now,
      })

      // Write to SQLite (non-fatal)
      const item = _items.find(i => i.id === e.itemId)
      if (ipc && item?.sqliteId) {
        ipc.db.run(
          `INSERT INTO inventory_usage_history
            (item_id, party_name, bill_id, bill_number, bill_date, qty, rate, amount)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            item.sqliteId, e.partyName,
            typeof e.billId === 'number' ? e.billId : null,
            e.billNumber, e.billDate, e.qty, e.rate, e.amount,
          ]
        ).catch((err: unknown) => console.warn('[InventoryService] usage history DB write failed:', err))
      }
    }
    // Persist only history (avoid triggering full inventoryChanged if items unchanged)
    lsSet(LS_USAGE_HIST_KEY, _usageHistory)
    eventBus.emit('inventoryUsageChanged', {})
  },

  // ── Bulk Price Update ──────────────────────────────────────────────────────

  /**
   * Preview a bulk price update without writing anything.
   * Returns a preview array — each entry shows item name, field, current value,
   * and the computed new value.
   */
  previewBulkPriceUpdate(params: {
    itemIds: string[]
    field: PriceFieldId
    mode: 'percent' | 'flat'   // 'percent' = apply ± % increase; 'flat' = add flat amount
    value: number              // can be negative for decrease
    roundTo?: number           // decimal places to round to (default: 2)
  }): Array<{
    itemId: string
    itemName: string
    field: string
    fieldLabel: string
    currentValue: string
    newValue: string
    changed: boolean
  }> {
    ensureLoaded()
    const { itemIds, field, mode, value, roundTo = 2 } = params

    return itemIds.map(id => {
      const item = _items.find(i => i.id === id)
      if (!item) return null

      const currentRaw = inventoryService.getPriceValue(item, field)
      const current = parseFloat(currentRaw)

      let newNum: number
      if (!Number.isFinite(current) || currentRaw === '') {
        // Can't update a blank price — return unchanged
        return {
          itemId: id,
          itemName: item.itemName,
          field,
          fieldLabel: resolvePriceLabel(field),
          currentValue: currentRaw,
          newValue: currentRaw,
          changed: false,
        }
      }

      if (mode === 'percent') {
        newNum = current * (1 + value / 100)
      } else {
        newNum = current + value
      }

      const newValue = newNum < 0 ? '0' : String(parseFloat(newNum.toFixed(roundTo)))

      return {
        itemId: id,
        itemName: item.itemName,
        field,
        fieldLabel: resolvePriceLabel(field),
        currentValue: currentRaw,
        newValue,
        changed: newValue !== currentRaw,
      }
    }).filter(Boolean) as ReturnType<typeof inventoryService.previewBulkPriceUpdate>
  },

  /**
   * Apply a previewed bulk price update.
   * Each entry already has the computed newValue — we just write them.
   * Creates price history entries for every changed item.
   */
  applyBulkPriceUpdate(preview: Array<{
    itemId: string
    field: string
    currentValue: string
    newValue: string
    changed: boolean
  }>): void {
    ensureLoaded()
    const changed = preview.filter(p => p.changed)
    for (const p of changed) {
      const idx = _items.findIndex(i => i.id === p.itemId)
      if (idx === -1) continue
      const oldItem = _items[idx]
      // Build a partial patch
      let patch: Partial<InventoryItemFull>
      if (['price', 'wholesalePrice', 'gstPrice', 'creditPrice'].includes(p.field)) {
        patch = { [p.field]: p.newValue }
      } else {
        patch = { customPrices: { ...oldItem.customPrices, [p.field]: p.newValue } }
      }
      // Record history
      recordPriceChangesIfAny(p.itemId, oldItem, patch)
      _items[idx] = { ...oldItem, ...patch, updatedAt: new Date().toISOString() }
    }
    persist()
  },

  // ── Barcode / SKU search ───────────────────────────────────────────────────

  /** Find an item by its exact barcode/SKU value */
  findByBarcode(barcode: string): InventoryItemFull | undefined {
    ensureLoaded()
    const q = barcode.trim().toLowerCase()
    return _items.find(i => i.barcode.trim().toLowerCase() === q)
  },

  // ── Item Images (Phase 9b-B-i) ────────────────────────────────────────────
  //
  // In Electron: image files are copied to AppData/item-images/<itemId>.<ext>.
  //   item.imagePath holds the absolute AppData path.
  //   We read it back as a base64 data URL via the image:readAsDataUrl IPC.
  //
  // In dev/browser mode (no window.cqikly): we store the base64 data URL
  //   directly in localStorage under 'cq:inventory:img:<itemId>' and set
  //   item.imagePath to a sentinel value 'ls:<itemId>' so we know where to
  //   look.  This keeps the dev workflow identical to Electron from the
  //   component's perspective: getItemImageDataUrl() always resolves to a
  //   data URL or null regardless of environment.

  /**
   * Open a file picker, copy the chosen image to AppData (Electron) or encode
   * it to base64 (dev mode), persist the path on the item, and return the
   * resulting data URL for immediate display.
   *
   * Returns null if the user cancelled or an error occurred.
   */
  async pickAndSetItemImage(itemId: string): Promise<string | null> {
    ensureLoaded()
    const item = _items.find(i => i.id === itemId)
    if (!item) return null

    try {
      if (typeof window !== 'undefined' && (window as unknown as { cqikly?: unknown }).cqikly) {
        // ── Electron path ──────────────────────────────────────────────────
        const api = (window as unknown as { cqikly: { image: { pick: () => Promise<string | null>; copyToAppData: (src: string, id: string) => Promise<string | null>; readAsDataUrl: (p: string) => Promise<string | null>; delete: (p: string) => Promise<boolean> } } }).cqikly.image
        const srcPath = await api.pick()
        if (!srcPath) return null

        // Delete old image file if there was one (non-sentinel path)
        if (item.imagePath && !item.imagePath.startsWith('ls:')) {
          await api.delete(item.imagePath).catch(() => {/* ignore */})
        }

        const destPath = await api.copyToAppData(srcPath, itemId)
        if (!destPath) return null

        // Persist the AppData path on the item
        inventoryService.updateItem(itemId, { imagePath: destPath })

        // Read back as data URL for immediate display
        return await api.readAsDataUrl(destPath)
      } else {
        // ── Dev / browser path ─────────────────────────────────────────────
        return new Promise<string | null>((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.onchange = () => {
            const file = input.files?.[0]
            if (!file) { resolve(null); return }
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result as string
              // Remove old ls image if any
              if (item.imagePath?.startsWith('ls:')) {
                try { localStorage.removeItem(`cq:inventory:img:${itemId}`) } catch { /* ok */ }
              }
              // Save to localStorage
              try { localStorage.setItem(`cq:inventory:img:${itemId}`, dataUrl) } catch { /* ok */ }
              inventoryService.updateItem(itemId, { imagePath: `ls:${itemId}` })
              resolve(dataUrl)
            }
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(file)
          }
          input.click()
        })
      }
    } catch (err) {
      console.error('[pickAndSetItemImage]', err)
      return null
    }
  },

  /**
   * Load the stored image for an item as a base64 data URL.
   * Returns null if the item has no image or the file is missing.
   */
  async getItemImageDataUrl(itemId: string): Promise<string | null> {
    ensureLoaded()
    const item = _items.find(i => i.id === itemId)
    if (!item || !item.imagePath) return null

    try {
      if (item.imagePath.startsWith('ls:')) {
        // Dev mode: read from localStorage
        return localStorage.getItem(`cq:inventory:img:${itemId}`) ?? null
      }

      if (typeof window !== 'undefined' && (window as unknown as { cqikly?: unknown }).cqikly) {
        const api = (window as unknown as { cqikly: { image: { readAsDataUrl: (p: string) => Promise<string | null> } } }).cqikly.image
        return await api.readAsDataUrl(item.imagePath)
      }

      return null
    } catch (err) {
      console.error('[getItemImageDataUrl]', err)
      return null
    }
  },

  /**
   * Remove the image from an item — deletes the file from AppData (or
   * localStorage entry in dev mode) and clears imagePath on the item.
   */
  async removeItemImage(itemId: string): Promise<void> {
    ensureLoaded()
    const item = _items.find(i => i.id === itemId)
    if (!item || !item.imagePath) return

    try {
      if (item.imagePath.startsWith('ls:')) {
        try { localStorage.removeItem(`cq:inventory:img:${itemId}`) } catch { /* ok */ }
      } else if (typeof window !== 'undefined' && (window as unknown as { cqikly?: unknown }).cqikly) {
        const api = (window as unknown as { cqikly: { image: { delete: (p: string) => Promise<boolean> } } }).cqikly.image
        await api.delete(item.imagePath).catch(() => {/* ignore */})
      }
    } catch { /* ignore */ }

    inventoryService.updateItem(itemId, { imagePath: '' })
  },

  // ── Force reload ─────────────────────────────────────────────────────────

  invalidate(): void {
    _loaded = false
  },

  // ── Fuzzy search (Phase 9b-B-ii-A) ───────────────────────────────────────

  /**
   * Fuzzy-search inventory items by item name.
   * Returns up to `limit` matches, ordered by relevance.
   * Uses a simple substring + startsWith scoring — no extra dependency needed;
   * Fuse.js is available if this needs upgrading.
   */
  fuzzySearchItems(query: string, limit = 8): InventoryItemFull[] {
    ensureLoaded()
    const q = query.trim().toLowerCase()
    if (!q) return []

    type Scored = { item: InventoryItemFull; score: number }
    const results: Scored[] = []

    for (const item of _items) {
      const name = item.itemName.toLowerCase()
      if (!name) continue

      // Exact match
      if (name === q) { results.push({ item, score: 1000 }); continue }
      // Starts with query
      if (name.startsWith(q)) { results.push({ item, score: 900 + (1 / name.length) }); continue }
      // Word starts with query
      const words = name.split(/\s+/)
      if (words.some(w => w.startsWith(q))) { results.push({ item, score: 800 }); continue }
      // Contains query
      const idx = name.indexOf(q)
      if (idx !== -1) { results.push({ item, score: 700 - idx }); continue }
      // All query chars appear in order (fuzzy)
      let si = 0
      let matched = 0
      for (let ci = 0; ci < name.length && si < q.length; ci++) {
        if (name[ci] === q[si]) { si++; matched++ }
      }
      if (matched === q.length) {
        results.push({ item, score: 100 + matched })
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit).map(r => r.item)
  },

  // ── Excel Export (Phase 9b-B-ii-B) ────────────────────────────────────────

  /**
   * Export the full inventory to an Excel workbook (.xlsx) and trigger a
   * browser download (dev mode) or prompt the user to save via Electron's
   * dialog (Electron mode).
   *
   * Column order:
   *   Item Name | Category | Sub-Category | Price | Wholesale Price |
   *   GST Price | Credit | <custom cols…> | GST Rate | Stock Qty |
   *   Low Stock Threshold | Unit | Barcode / SKU
   *
   * Returns a summary string on success or throws on failure.
   */
  async exportToExcel(): Promise<{ rowsExported: number }> {
    ensureLoaded()
    // Dynamic import keeps SheetJS out of the initial bundle
    const XLSX = await import('xlsx')

    const customCols = _cols   // snapshot

    // ── Build header row ──────────────────────────────────────────────────
    const builtInHeaders = [
      'Item Name', 'Category', 'Sub-Category',
      'Price', 'Wholesale Price', 'GST Price', 'Credit',
    ]
    const customHeaders = customCols.map(c => c.label)
    const tailHeaders = ['GST Rate', 'Stock Qty', 'Low Stock Threshold', 'Unit', 'Barcode / SKU']
    const headers = [...builtInHeaders, ...customHeaders, ...tailHeaders]

    // ── Build data rows ───────────────────────────────────────────────────
    const rows = _items.map(item => {
      const base = [
        item.itemName,
        item.category,
        item.subCategory,
        item.price,
        item.wholesalePrice,
        item.gstPrice,
        item.creditPrice,
      ]
      const customs = customCols.map(c => item.customPrices[c.id] ?? '')
      const tail = [
        item.gstRate,
        item.stockQty,
        item.lowStockThreshold,
        item.unit,
        item.barcode,
      ]
      return [...base, ...customs, ...tail]
    })

    // ── Assemble worksheet ────────────────────────────────────────────────
    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths (approximate chars)
    ws['!cols'] = headers.map((h, i) => ({
      wch: Math.max(h.length + 2, i === 0 ? 28 : 16),
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')

    // Add a second helper sheet with column descriptions
    const infoData = [
      ['Column', 'Required', 'Notes'],
      ['Item Name', 'YES', 'Only required column'],
      ['Category', 'no', 'Any text — creates category if new'],
      ['Sub-Category', 'no', 'Requires Category to be set'],
      ['Price', 'no', 'Numeric (standard selling price)'],
      ['Wholesale Price', 'no', 'Numeric'],
      ['GST Price', 'no', 'Numeric'],
      ['Credit', 'no', 'Numeric'],
      ['GST Rate', 'no', 'Numeric e.g. 18'],
      ['Stock Qty', 'no', 'Numeric'],
      ['Low Stock Threshold', 'no', 'Numeric'],
      ['Unit', 'no', 'e.g. pcs, kg, metres'],
      ['Barcode / SKU', 'no', 'Any string'],
      ...customCols.map(c => [c.label, 'no', 'Custom price column']),
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData)
    wsInfo['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 38 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Column Guide')

    const filename = `cQikly_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`

    // ── Write & download ──────────────────────────────────────────────────
    if (typeof window !== 'undefined' && (window as unknown as { cqikly?: { dialog?: { saveFile?: (opts: { defaultPath: string; filters: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>; writeFile?: (path: string, buf: Uint8Array) => Promise<void> } } }).cqikly?.dialog?.saveFile) {
      // Electron: show save dialog then write file
      const api = (window as unknown as { cqikly: { dialog: { saveFile: (opts: { defaultPath: string; filters: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>; writeFile: (path: string, buf: Uint8Array) => Promise<void> } } }).cqikly.dialog
      const savePath = await api.saveFile({
        defaultPath: filename,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      })
      if (!savePath) return { rowsExported: _items.length } // user cancelled
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
      await api.writeFile(savePath, buf)
    } else {
      // Dev / browser: trigger download
      const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 1500)
    }

    return { rowsExported: _items.length }
  },

  // ── Excel Import (Phase 9b-B-ii-B) ────────────────────────────────────────

  /**
   * Result type returned by importFromExcel.
   */

  /**
   * Import inventory items from an Excel file.
   *
   * Rules:
   * - "Item Name" column is the ONLY required column.
   * - All other columns are optional; unrecognised columns are ignored.
   * - Partial fill accepted: any recognised column that is present and
   *   non-empty is imported; missing columns are treated as blank.
   * - If a custom-price column header matches an existing custom column label
   *   (case-insensitive), values are merged into that column.
   * - If a custom-price column header doesn't match any existing column,
   *   a new custom column is created.
   * - Rows without an Item Name are silently skipped.
   * - Duplicate Item Names: a new item is always created (no upsert).
   *   Rationale: import is for bulk-add / migration; deduplication is
   *   the user's responsibility.
   *
   * @param file  — File object from an <input type="file"> picker
   * @returns     — summary of what was imported
   */
  async importFromExcel(file: File): Promise<{
    imported: number
    skipped: number
    newCustomCols: string[]
    errors: string[]
  }> {
    ensureLoaded()
    const XLSX = await import('xlsx')

    // ── Read file ─────────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return { imported: 0, skipped: 0, newCustomCols: [], errors: ['Excel file has no sheets.'] }
    }
    const ws = wb.Sheets[sheetName]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

    if (raw.length < 2) {
      return { imported: 0, skipped: 0, newCustomCols: [], errors: ['Sheet appears empty or has no data rows.'] }
    }

    // ── Parse headers ─────────────────────────────────────────────────────
    const headerRow = raw[0].map(h => String(h ?? '').trim())

    // Canonical column name → column index in spreadsheet
    function colIdx(name: string): number {
      return headerRow.findIndex(h => h.toLowerCase() === name.toLowerCase())
    }

    const idxItemName         = colIdx('Item Name')
    if (idxItemName === -1) {
      return { imported: 0, skipped: 0, newCustomCols: [], errors: ['"Item Name" column not found. This column is required.'] }
    }

    const idxCategory         = colIdx('Category')
    const idxSubCategory      = colIdx('Sub-Category')
    const idxPrice            = colIdx('Price')
    const idxWholesalePrice   = colIdx('Wholesale Price')
    const idxGstPrice         = colIdx('GST Price')
    const idxCreditPrice      = colIdx('Credit')
    const idxGstRate          = colIdx('GST Rate')
    const idxStockQty         = colIdx('Stock Qty')
    const idxLowStockThresh   = colIdx('Low Stock Threshold')
    const idxUnit             = colIdx('Unit')
    const idxBarcode          = colIdx('Barcode / SKU')

    // ── Identify custom price columns in the spreadsheet ──────────────────
    const knownStandardCols = new Set([
      'item name', 'category', 'sub-category', 'price', 'wholesale price',
      'gst price', 'credit', 'gst rate', 'stock qty', 'low stock threshold',
      'unit', 'barcode / sku',
    ])

    // Map from header index → { customColId, label, isNew }
    const customColMap: Array<{ headerIdx: number; colId: string; label: string; isNew: boolean }> = []
    const newCustomColNames: string[] = []

    for (let hi = 0; hi < headerRow.length; hi++) {
      const hLabel = headerRow[hi]
      if (!hLabel || knownStandardCols.has(hLabel.toLowerCase())) continue

      // Check if this matches an existing custom column
      const existing = _cols.find(c => c.label.toLowerCase() === hLabel.toLowerCase())
      if (existing) {
        customColMap.push({ headerIdx: hi, colId: existing.id, label: existing.label, isNew: false })
      } else {
        // Create a new custom column
        const newCol = inventoryService.addCustomColumn(hLabel)
        customColMap.push({ headerIdx: hi, colId: newCol.id, label: newCol.label, isNew: true })
        newCustomColNames.push(hLabel)
      }
    }

    // ── Process data rows ─────────────────────────────────────────────────
    function cellStr(row: unknown[], idx: number): string {
      if (idx === -1) return ''
      const v = row[idx]
      if (v === null || v === undefined) return ''
      return String(v).trim()
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (let ri = 1; ri < raw.length; ri++) {
      const row = raw[ri]
      const itemName = cellStr(row, idxItemName)
      if (!itemName) { skipped++; continue }

      // Build custom prices object
      const customPrices: Record<string, string> = {}
      // Start with empty strings for all existing custom cols
      for (const c of _cols) customPrices[c.id] = ''
      // Fill from spreadsheet
      for (const cm of customColMap) {
        const v = cellStr(row, cm.headerIdx)
        if (v) customPrices[cm.colId] = v
      }

      try {
        inventoryService.addItem({
          itemName,
          category:          cellStr(row, idxCategory),
          subCategory:       cellStr(row, idxSubCategory),
          price:             cellStr(row, idxPrice),
          wholesalePrice:    cellStr(row, idxWholesalePrice),
          gstPrice:          cellStr(row, idxGstPrice),
          creditPrice:       cellStr(row, idxCreditPrice),
          gstRate:           cellStr(row, idxGstRate),
          stockQty:          cellStr(row, idxStockQty),
          lowStockThreshold: cellStr(row, idxLowStockThresh),
          unit:              cellStr(row, idxUnit),
          barcode:           cellStr(row, idxBarcode),
          customPrices,
        })
        imported++
      } catch (err) {
        errors.push(`Row ${ri + 1} ("${itemName}"): ${err instanceof Error ? err.message : String(err)}`)
        skipped++
      }
    }

    return { imported, skipped, newCustomCols: newCustomColNames, errors }
  },
}

// ─── Load inventory from SQLite on startup (FIX-4) ───────────────────────────

export async function loadInventoryFromDb(): Promise<void> {
  const ipc = getIpc()
  if (!ipc) return

  try {
    const itemRows = await ipc.db.query(
      `SELECT id, item_name, category, sub_category, price, wholesale_price, gst_price,
              credit_price, gst_rate, stock_qty, min_stock, unit, custom_prices,
              barcode, image_path, created_at, updated_at
       FROM inventory_items WHERE deleted_at IS NULL ORDER BY item_name COLLATE NOCASE`,
      []
    ) as Array<Record<string, unknown>>

    _items = itemRows.map(r => ({
      id: `inv-${r.id as number}`,
      sqliteId: r.id as number,
      itemName: (r.item_name as string) ?? '',
      category: (r.category as string) ?? '',
      subCategory: (r.sub_category as string) ?? '',
      price: String(r.price ?? ''),
      wholesalePrice: String(r.wholesale_price ?? ''),
      gstPrice: String(r.gst_price ?? ''),
      creditPrice: String(r.credit_price ?? ''),
      gstRate: String(r.gst_rate ?? ''),
      customPrices: r.custom_prices ? JSON.parse(r.custom_prices as string) as Record<string, string> : {},
      stockQty: String(r.stock_qty ?? ''),
      lowStockThreshold: String(r.min_stock ?? ''),
      unit: (r.unit as string) ?? '',
      barcode: (r.barcode as string) ?? '',
      imagePath: (r.image_path as string) ?? '',
      createdAt: (r.created_at as string) ?? '',
      updatedAt: (r.updated_at as string) ?? '',
    }))

    // Load price history
    const priceHistRows = await ipc.db.query(
      `SELECT id, item_id, field, field_label, old_value, new_value, changed_at
       FROM inventory_price_history ORDER BY changed_at DESC`,
      []
    ) as Array<Record<string, unknown>>

    _priceHistory = priceHistRows.map(r => ({
      id: String(r.id),
      itemId: `inv-${r.item_id as number}`,
      field: (r.field as string) ?? '',
      fieldLabel: (r.field_label as string) ?? '',
      oldValue: (r.old_value as string) ?? '',
      newValue: (r.new_value as string) ?? '',
      changedAt: (r.changed_at as string) ?? '',
    }))

    // Load usage history
    const usageRows = await ipc.db.query(
      `SELECT id, item_id, party_name, bill_id, bill_number, bill_date, qty, rate, amount, recorded_at
       FROM inventory_usage_history ORDER BY bill_date DESC`,
      []
    ) as Array<Record<string, unknown>>

    _usageHistory = usageRows.map(r => ({
      id: String(r.id),
      itemId: `inv-${r.item_id as number}`,
      partyName: (r.party_name as string) ?? '',
      billId: (r.bill_id as number) ?? '',
      billNumber: (r.bill_number as string) ?? '',
      billDate: (r.bill_date as string) ?? '',
      qty: String(r.qty ?? ''),
      rate: String(r.rate ?? ''),
      amount: String(r.amount ?? ''),
      recordedAt: (r.recorded_at as string) ?? '',
    }))

    _loaded = true
    lsSet(LS_ITEMS_KEY, _items)
    lsSet(LS_PRICE_HIST_KEY, _priceHistory)
    lsSet(LS_USAGE_HIST_KEY, _usageHistory)
    eventBus.emit('inventoryChanged', {})
  } catch (err) {
    console.error('[InventoryService] loadInventoryFromDb failed:', err)
  }
}