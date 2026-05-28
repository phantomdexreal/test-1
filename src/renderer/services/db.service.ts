/**
 * cQikly — Database Service
 * Built in: Phase 1a-i-B (migration runner) + Phase 1a-ii-A (connection manager)
 * Placeholder: Phase 1a-i-A
 *
 * ALL database access goes through this service.
 * No component ever calls SQLite directly.
 * This service communicates with the Electron main process via IPC.
 *
 * Architecture note:
 *   Components → db.service.ts → IPC → main/db → better-sqlite3 → SQLite file
 */

// TODO: [DB-SERVICE] - Full typed implementation in Phase 1a-i-B and 1a-ii-A.

/** Bill status values */
export type BillStatus = 'unpaid' | 'paid' | 'partial' | 'cancelled'

/** DB service interface — all methods typed */
export interface IDbService {
  // Company / profile
  getCompanyProfile(): Promise<CompanyProfile | null>
  saveCompanyProfile(profile: CompanyProfile): Promise<void>

  // Bills
  saveBill(bill: BillRecord): Promise<{ id: number; billNumber: string }>
  getBillById(id: number): Promise<BillRecord | null>
  getBills(filters?: BillFilters): Promise<BillRecord[]>
  updateBillStatus(id: number, status: BillStatus): Promise<void>
  deleteBill(id: number): Promise<void>
  getNextBillNumber(): Promise<string>

  // Customers
  saveCustomer(customer: CustomerRecord): Promise<number>
  getCustomers(): Promise<CustomerRecord[]>
  getCustomerByName(name: string): Promise<CustomerRecord | null>
  updateCustomer(id: number, partial: Partial<CustomerRecord>): Promise<void>
  deleteCustomer(id: number): Promise<void>

  // Inventory
  getInventoryItems(): Promise<InventoryItem[]>
  saveInventoryItem(item: InventoryItem): Promise<number>
  updateInventoryItem(id: number, partial: Partial<InventoryItem>): Promise<void>
  deleteInventoryItem(id: number): Promise<void>

  // Settings / config stored in DB
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
}

// ── Stub type definitions (expanded in later phases) ──

export interface CompanyProfile {
  id?: number
  firmName: string
  address: string
  gstNumber?: string
  contactPhone?: string
  contactEmail?: string
  logoPath?: string
  financialYearStartMonth: number // 1–12; default 4 (April)
  billResetCycle: 'yearly' | 'monthly' | 'never'
  startingBillNumber: number
  isHeadOffice: boolean
  numberOfBranches: number
  cloudSharingEnabled: boolean
  businessModel: string[] // ['B2B', 'B2C', 'C2C']
  natureOfBusiness: string[] // ['wholesale', 'retail', 'production']
}

export interface BillRecord {
  id?: number
  billNumber: string
  billDate: string // ISO date string
  partyName: string
  partyPhone?: string
  transportName?: string
  partyAddress?: string
  partyGstin?: string
  partyNotes?: string
  format: 'free' | 'gst'
  rows: import('../pages/NewQuote/billingGrid.types').BillingRow[]
  customColumns: unknown[] // Typed in Phase 5b
  adjustments: import('../pages/NewQuote/billingGrid.types').AdjustmentRow[]
  subtotal: number
  grandTotal: number
  status: BillStatus
  internalRemarks?: string
  templateId?: number
  /** Cell formatting map (colors, bold) — Phase 4a-i; persists across bill reloads */
  cellFormats?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface BillFilters {
  status?: BillStatus
  partyName?: string
  dateFrom?: string
  dateTo?: string
  amountMin?: number
  amountMax?: number
}

export interface CustomerRecord {
  id?: number
  partyName: string
  address?: string
  group?: string
  pincode?: string
  stateName?: string
  contactPerson?: string
  phoneNo?: string
  mobileNo?: string
  email?: string
  website?: string
  panNo?: string
  gstin?: string
  regType?: string
  creditLimit?: number
  lastTransportName?: string
  internalNotes?: string
  customerSinceDate?: string
  createdAt?: string
}

export interface InventoryItem {
  id?: number
  itemName: string
  price?: number
  wholesalePrice?: number
  gstPrice?: number
  creditPrice?: number
  stockQty?: number
  lowStockThreshold?: number
  barcode?: string
  imagePath?: string
  customPrices?: Record<string, number> // user-defined price columns
  createdAt?: string
  updatedAt?: string
}

// Placeholder export — replaced in Phase 1a-ii-A
export const dbService: IDbService = {
  getCompanyProfile: async () => null,
  saveCompanyProfile: async () => {},
  saveBill: async () => ({ id: 0, billNumber: '1' }),
  getBillById: async () => null,
  getBills: async () => [],
  updateBillStatus: async () => {},
  deleteBill: async () => {},
  getNextBillNumber: async () => '1',
  saveCustomer: async () => 0,
  getCustomers: async () => [],
  getCustomerByName: async () => null,
  updateCustomer: async () => {},
  deleteCustomer: async () => {},
  getInventoryItems: async () => [],
  saveInventoryItem: async () => 0,
  updateInventoryItem: async () => {},
  deleteInventoryItem: async () => {},
  getSetting: async () => null,
  setSetting: async () => {},
}
