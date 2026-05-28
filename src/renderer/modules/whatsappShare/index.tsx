/**
 * cQikly — WhatsApp Quick Share (Boolean-Gated Service Module)
 * Built in: Phase 13
 *
 * This module is a SERVICE, not a page — it injects a share trigger
 * into the bill copy flow (Ctrl+Shift+C / Ctrl+Shift+X) when enabled.
 *
 * There is no dedicated nav page for WhatsApp Share.
 * The toggle in Settings enables/disables the share prompt after image copy.
 *
 * GATING RULE: Only active when feature flag 'whatsappShare' is true.
 * When flag is off → zero impact on the copy image flow.
 *
 * Hard Spec #11: WhatsApp method (Desktop deep link vs Web) is user-configurable
 * in Settings. No hardcoded default.
 *
 * Masterplan Section 16:
 *   One click opens WhatsApp; preferred method user-configurable in Settings;
 *   bill image attached via clipboard.
 */

/**
 * Trigger WhatsApp share after a bill image has been copied to clipboard.
 * Opens either WhatsApp Desktop (deep link) or WhatsApp Web depending on
 * the user's configured method.
 *
 * @param method  'desktop' | 'web' — from config.whatsappMethod
 * @returns       true if the open was attempted; false if method is unset
 */
export function triggerWhatsAppShare(method: 'desktop' | 'web' | null): boolean {
  if (!method) return false

  if (method === 'desktop') {
    // WhatsApp Desktop deep link — opens the desktop app
    // The bill image is already in the clipboard; user pastes it in the chat
    window.open('whatsapp://', '_blank')
  } else {
    // WhatsApp Web — opens in the default browser
    window.open('https://web.whatsapp.com', '_blank')
  }

  return true
}

/**
 * Returns a human-readable description of the configured share method.
 */
export function getWhatsAppMethodLabel(method: 'desktop' | 'web' | null): string {
  if (!method) return 'Not configured'
  return method === 'desktop' ? 'WhatsApp Desktop' : 'WhatsApp Web'
}
