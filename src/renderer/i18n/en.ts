/**
 * cQikly — English Translation Strings
 * Built in: Phase 1a-ii-B
 * Placeholder: Phase 1a-i-A
 *
 * Every UI string in the app goes through the t() function.
 * This file is the default (English) strings file.
 * Regional languages addable later with zero structural changes.
 *
 * Key format: {page/module}.{component}.{element}
 * Example: 'billing.toolbar.saveButton'
 */

// TODO: [I18N-EN] - Populate all strings as pages are built in subsequent phases.
// Keys are added incrementally — a missing key falls back to the key itself.

const en = {
  // App-wide
  'app.name': 'cQikly',
  'app.loading': 'Loading...',

  // Navigation
  'nav.newQuote': 'New Quote',
  'nav.history': 'History',
  'nav.customerDetails': 'Customer Details',
  'nav.inventory': 'Inventory',
  'nav.looseInventoryHistory': 'Loose Inventory History',
  'nav.settings': 'Settings',

  // Onboarding
  'onboarding.firmName': 'Name of Firm',
  'onboarding.firmName.placeholder': 'Enter your firm name',
  'onboarding.address': 'Company Address',
  'onboarding.gstNumber': 'GST Number (optional)',
  'onboarding.continue': 'Continue',
  'onboarding.back': 'Back',
  'onboarding.complete': 'Complete Setup',

  // Dashboard
  'dashboard.todayBills': "Today's Bills",
  'dashboard.totalBills': 'Total Bills',
  'dashboard.todayRevenue': "Today's Revenue",
  'dashboard.topCustomer': 'Top Customer This Month',

  // Billing
  'billing.newBill': 'New Bill',
  'billing.save': 'Save Bill',
  'billing.print': 'Print',
  'billing.partyName': 'Party Name',
  'billing.phone': 'Phone Number',
  'billing.transport': 'Transport Name',
  'billing.billNumber': 'Bill No.',
  'billing.billDate': 'Bill Date',
  'billing.subtotal': 'Subtotal',
  'billing.grandTotal': 'Grand Total',
  'billing.status.unpaid': 'Unpaid',
  'billing.status.paid': 'Paid',
  'billing.status.partial': 'Partial',
  'billing.status.cancelled': 'Cancelled',

  // Common UI
  'ui.save': 'Save',
  'ui.cancel': 'Cancel',
  'ui.delete': 'Delete',
  'ui.edit': 'Edit',
  'ui.confirm': 'Confirm',
  'ui.close': 'Close',
  'ui.search': 'Search',
  'ui.export': 'Export',
  'ui.import': 'Import',
  'ui.add': 'Add',
  'ui.remove': 'Remove',
} as const

export type TranslationKey = keyof typeof en
export default en
