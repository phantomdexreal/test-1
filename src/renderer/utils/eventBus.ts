/**
 * cQikly — Typed Global Event Bus
 * Built in: Phase 1a-ii-B
 * Updated: Phase 11b-i — added appLockChange, pinChanged events
 *
 * All 6 contexts communicate via this bus instead of prop drilling.
 * Emit a typed event → every subscriber receives it immediately.
 */

// ─── Event Payload Map ────────────────────────────────────────────────────────

export type EventBusEventMap = {
  themeChange:           { themeId: string; variant: 'dark' | 'light' }
  configChange:          { key: string; value: unknown }
  dbSwap:                { newDbPath: string }
  featureFlagChange:     { flag: string; enabled: boolean }
  performanceModeChange: { mode: 'lite' | 'balanced' | 'ultra' }
  languageChange:        { language: string }
  inventoryChanged:      Record<string, never>
  inventoryUsageChanged: Record<string, never>
  billSaved:             { billId: number; billNumber: string }
  billUpdated:           { billId: number }
  billDeleted:           { billId: number }
  // Phase 11b-i: Security
  appLockChange:         { enabled: boolean }
  pinChanged:            Record<string, never>
  widgetVisibilityChange: { key: string; visible: boolean }
  // Phase 12a: Global shortcut overlay triggers
  openCalculator:        Record<string, never>
  openCommandPalette:    Record<string, never>
  openShortcutPanel:     Record<string, never>
  // Phase 12b: Scratchpad + Command Palette navigation targets
  openScratchpad:        Record<string, never>
  navigateToCustomer:    { customerId: number }
  navigateToBill:        { billId: number }
  navigateToInventoryItem: { itemId: string }
  // Phase 12a: Cross-page shortcut actions (fired from AppShell, consumed by NewQuote)
  shortcutSaveBill:      Record<string, never>
  shortcutSavePdf:       Record<string, never>
  shortcutCopyImage:     Record<string, never>
  shortcutCopySimplified: Record<string, never>
  shortcutQuickPrint:    Record<string, never>
  shortcutDuplicateBill: Record<string, never>
  // Phase 13: WhatsApp Quick Share triggered after bill image copy
  whatsappShareTriggered: { method: 'desktop' | 'web' }
}

export type EventBusListener<K extends keyof EventBusEventMap> = (
  payload: EventBusEventMap[K]
) => void

// ─── Internal Registry ────────────────────────────────────────────────────────

const _registry = new Map<
  keyof EventBusEventMap,
  Set<EventBusListener<keyof EventBusEventMap>>
>()

function _getSet<K extends keyof EventBusEventMap>(
  event: K
): Set<EventBusListener<K>> {
  if (!_registry.has(event)) {
    _registry.set(event, new Set())
  }
  return _registry.get(event) as Set<EventBusListener<K>>
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const eventBus = {
  emit<K extends keyof EventBusEventMap>(
    event: K,
    payload: EventBusEventMap[K]
  ): void {
    const listeners = Array.from(_getSet(event))
    for (const listener of listeners) {
      try {
        listener(payload)
      } catch (err) {
        console.error(`[eventBus] Uncaught error in listener for "${event}":`, err)
      }
    }
  },

  on<K extends keyof EventBusEventMap>(
    event: K,
    listener: EventBusListener<K>
  ): () => void {
    _getSet(event).add(listener)
    return () => {
      _getSet(event).delete(listener)
    }
  },

  off<K extends keyof EventBusEventMap>(
    event: K,
    listener: EventBusListener<K>
  ): void {
    _getSet(event).delete(listener)
  },

  clear<K extends keyof EventBusEventMap>(event: K): void {
    _registry.delete(event)
  },

  _stats(): Record<string, number> {
    const out: Record<string, number> = {}
    _registry.forEach((set, key) => { out[key] = set.size })
    return out
  },
}
