/**
 * cQikly — Services Index
 * Re-exports all service instances and their types.
 *
 * Import rule: Components always import from here, never directly from service files.
 *   ✅ import { dbService } from '@/services'
 *   ❌ import { dbService } from '@/services/db.service'
 */

export { dbService } from './db.service'
export type { IDbService, BillRecord, BillFilters, BillStatus, CompanyProfile, CustomerRecord, InventoryItem } from './db.service'

export type { PdfFormat, PdfPageSize } from './pdf.service'

export { weatherService } from './weather.service'
export type { IWeatherService, WeatherData } from './weather.service'

export { cryptoService } from './crypto.service'
export type { ICryptoService, CryptoPrice } from './crypto.service'

export { forexService } from './forex.service'
export type { IForexService, ForexRate } from './forex.service'

// Supabase: admin-only; exported for type-checking but never used in user-facing components
export { supabaseService } from './supabase.service'
export type { ISupabaseService } from './supabase.service'

// ─── Phase 2b ─────────────────────────────────────────────────────────────────
export * from "./internet.service"
export * from "./onboarding.service"


// ─── Phase 3a-B ───────────────────────────────────────────────────────────────
export * from './dashboard.service'

// ─── Phase 3b-i ────────────────────────────────────────────────────────────────
export { DEFAULT_CRYPTO_IDS } from './crypto.service'
export { DEFAULT_FOREX_PAIRS } from './forex.service'

// ─── Phase 4b-i ────────────────────────────────────────────────────────────────
export {
  loadCustomers,
  loadTransporters,
  searchCustomers,
  searchTransporters,
  addTransporterToList,
  updateCustomerTransport,
  ensureCustomerExists,
  getCustomerByName,
} from './customer.service'
export type { NewCustomerFromBill } from './customer.service'

// ─── Phase 4b-ii ───────────────────────────────────────────────────────────────
export {
  saveBill,
  getBills,
  getBillById,
  updateBillStatus,
  deleteBill,
  peekNextBillNumber,
} from './bill.service'
export type { SaveBillInput, SaveBillResult } from './bill.service'

// ─── Phase 7a-A ────────────────────────────────────────────────────────────────
export {
  groupBills,
  applyFilters,
  exportBillsToExcel,
  formatAmountINR,
  formatAmountCompact,
  formatDateDisplay,
  capitalise,
} from './history.service'
export type { GroupingMode, HistoryFilters, BillGroup } from './history.service'

export {
  getBillNumberEngine,
  resetBillNumberEngine,
  updateBillNumberConfig,
  setMigrationStartingNumber,
  getFYPrefix,
  isResetDue,
  formatBillNumber,
  createDefaultBillNumberState,
} from '../utils/billNumber'
export type { BillNumberConfig, BillNumberState } from '../utils/billNumber'

// ─── Phase 7b ──────────────────────────────────────────────────────────────────
export { findDuplicates } from './duplicate.service'
export type { DuplicateCandidate } from './duplicate.service'

export { computeLedger, getLedgerTotals } from './ledger.service'
export type { CustomerLedgerRow, LedgerDateRange } from './ledger.service'

export { triggerManualBackup } from './backup.service'
export type { BackupResult } from './backup.service'

export {
  exportSelectedBillsToExcel,
  generateBatchPdf,
} from './history.service'
export type { BatchPdfResult } from './history.service'

export { deleteBillsBulk, updateBillStatusBulk } from './bill.service'

// ─── Phase 9a-A ────────────────────────────────────────────────────────────────
export { inventoryService } from './inventory.service'
export type {
  InventoryItemFull,
  CustomPriceColumn,
  InventoryCategory,
  InventoryRateSourceConfig,
  PriceFieldId,
  BuiltInPriceField,
} from './inventory.service'
export {
  loadPaymentsForCustomer,
  loadAllPayments,
  savePayment,
  deletePayment,
  computeTotalPaid,
  computePaidForBill,
} from './payment.service'
export type { PaymentRecord } from './payment.service'

export type { LooseEntry, LooseItemAnalytics, LooseHistoryFilters } from './looseInventory.service'
export { DEFAULT_FILTERS, getAllLooseEntries, getLooseItemAnalytics, applyFilters as applyLooseFilters, applyAnalyticsFilters, getLoosePartyNames } from './looseInventory.service'
