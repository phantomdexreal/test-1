/**
 * cQikly — Bill Template Service
 * Phase 4a-ii-A
 *
 * Bill Templates: save structure only (format type + custom column headers).
 * Zero row data is ever stored in a template.
 * Templates are fully manageable: create, rename, delete.
 * Loading a template into a new bill applies structure only.
 *
 * Hard Spec §19: "Templates save format type + custom column headers only —
 *   zero row data. Templates are fully manageable: create, rename, delete from
 *   a template manager panel. Loading a template into a new bill applies
 *   the structure only."
 *
 * Storage: localStorage for dev/browser mode; IPC → SQLite in Electron.
 * Architecture: All data access goes through this service. No component ever
 * touches storage directly.
 */

import type { BillFormat } from '../pages/NewQuote/billingGrid.types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BillTemplateColumn {
  /** Stable ID for the column — preserved so it can be referenced consistently */
  id: string
  /** Fully user-defined header name */
  header: string
}

export interface BillTemplate {
  id: number
  /** User-given name for the template, e.g. "Fabric Invoice", "GST Export" */
  name: string
  /** Which bill format this template applies */
  format: BillFormat
  /** Custom column headers only — zero row data */
  customColumns: BillTemplateColumn[]
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateInput {
  name: string
  format: BillFormat
  customColumns: BillTemplateColumn[]
}

export interface RenameTemplateInput {
  id: number
  name: string
}

// ─── In-memory / localStorage store ────────────────────────────────────────────

const STORAGE_KEY = 'cq:bill_templates'

let _templates: BillTemplate[] = []

function _load(): BillTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as BillTemplate[]
  } catch { /* ignore */ }
  return []
}

function _save(templates: BillTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch { /* ignore */ }
}

_templates = _load()

// ─── IPC helper ────────────────────────────────────────────────────────────────

function getIpc(): Window['cqikly'] | null {
  if (typeof window === 'undefined') return null
  return (window as Window).cqikly ?? null
}

// ─── API ───────────────────────────────────────────────────────────────────────

/** Get all saved templates, most recently updated first. */
export async function getTemplates(): Promise<BillTemplate[]> {
  return [..._templates].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/** Get a single template by ID. Returns null if not found. */
export async function getTemplateById(id: number): Promise<BillTemplate | null> {
  return _templates.find(t => t.id === id) ?? null
}

/**
 * Create a new bill template.
 * Saves format type + custom column headers only — zero row data.
 */
export async function createTemplate(input: CreateTemplateInput): Promise<BillTemplate> {
  const now = new Date().toISOString()
  const id = Date.now() + Math.floor(Math.random() * 1000)

  const template: BillTemplate = {
    id,
    name: input.name.trim(),
    format: input.format,
    customColumns: input.customColumns.map(col => ({ id: col.id, header: col.header })),
    createdAt: now,
    updatedAt: now,
  }

  _templates = [template, ..._templates]
  _save(_templates)

  const ipc = getIpc()
  if (ipc) {
    try {
      await ipc.db.run(
        `INSERT OR REPLACE INTO bill_templates (id, name, format, custom_columns, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, template.name, template.format, JSON.stringify(template.customColumns)]
      )
    } catch (err) {
      console.warn('[TemplateService] IPC create failed, using in-memory:', err)
    }
  }

  return template
}

/**
 * Rename a template.
 */
export async function renameTemplate(input: RenameTemplateInput): Promise<void> {
  const template = _templates.find(t => t.id === input.id)
  if (!template) return

  template.name = input.name.trim()
  template.updatedAt = new Date().toISOString()
  _save(_templates)

  const ipc = getIpc()
  if (ipc) {
    try {
      await ipc.db.run(
        `UPDATE bill_templates SET name = ?, updated_at = datetime('now') WHERE id = ?`,
        [template.name, input.id]
      )
    } catch (err) {
      console.warn('[TemplateService] IPC rename failed:', err)
    }
  }
}

/**
 * Delete a template permanently.
 */
export async function deleteTemplate(id: number): Promise<void> {
  _templates = _templates.filter(t => t.id !== id)
  _save(_templates)

  const ipc = getIpc()
  if (ipc) {
    try {
      await ipc.db.run(`DELETE FROM bill_templates WHERE id = ?`, [id])
    } catch (err) {
      console.warn('[TemplateService] IPC delete failed:', err)
    }
  }
}
