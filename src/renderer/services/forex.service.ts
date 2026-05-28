/**
 * cQikly — Forex Rates Service
 * Phase: 3b-i (LIVE IMPLEMENTATION)
 *
 * API: Frankfurter (free, no key, ECB data)
 *   https://api.frankfurter.app/latest?from=USD&to=INR,EUR
 *
 * Also powers CurrencyConverter widget.
 * Currency pairs: configurable from Settings (config.forexPairs).
 * Polling: stopped entirely in Lite mode (Hard Spec #12).
 *
 * Default pairs: USD→INR, EUR→INR, GBP→INR, USD→EUR, AED→INR
 */

export interface ForexRate {
  from: string   // e.g. "USD"
  to: string     // e.g. "INR"
  rate: number
  fetchedAt: number
}

export interface IForexService {
  fetchRates(pairs: Array<{ from: string; to: string }>): Promise<ForexRate[]>
  convert(amount: number, from: string, to: string, rates?: ForexRate[]): Promise<number>
  startPolling(
    pairs: Array<{ from: string; to: string }>,
    intervalMs: number,
    onUpdate: (rates: ForexRate[]) => void
  ): () => void
  stopPolling(): void
}

export const DEFAULT_FOREX_PAIRS: Array<{ from: string; to: string }> = [
  { from: 'USD', to: 'INR' },
  { from: 'EUR', to: 'INR' },
  { from: 'GBP', to: 'INR' },
  { from: 'USD', to: 'EUR' },
  { from: 'AED', to: 'INR' },
]

// ── Fetch: group pairs by 'from' currency to minimise API calls ───────────────

async function fetchRates(pairs: Array<{ from: string; to: string }>): Promise<ForexRate[]> {
  if (!pairs.length) return []

  // Group by base currency
  const grouped: Record<string, Set<string>> = {}
  for (const p of pairs) {
    if (!grouped[p.from]) grouped[p.from] = new Set()
    grouped[p.from].add(p.to)
  }

  const results: ForexRate[] = []
  const now = Date.now()

  await Promise.all(
    Object.entries(grouped).map(async ([from, toSet]) => {
      const targets = [...toSet].filter(t => t !== from)
      if (!targets.length) return

      const url = `https://api.frankfurter.app/latest?from=${from}&to=${targets.join(',')}`
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
        const json = await res.json()
        for (const to of targets) {
          if (json.rates?.[to] !== undefined) {
            results.push({ from, to, rate: json.rates[to], fetchedAt: now })
          }
        }
      } catch (err) {
        console.warn(`[forex] Failed to fetch ${from} rates:`, err)
      }
    })
  )

  return results
}

// ── Convert using cached rates or live fetch ─────────────────────────────────

async function convert(
  amount: number,
  from: string,
  to: string,
  cachedRates?: ForexRate[]
): Promise<number> {
  if (from === to) return amount

  // Try cache first
  if (cachedRates?.length) {
    const r = cachedRates.find(x => x.from === from && x.to === to)
    if (r) return amount * r.rate
    // Try reverse
    const rev = cachedRates.find(x => x.from === to && x.to === from)
    if (rev && rev.rate !== 0) return amount / rev.rate
  }

  // Live fetch fallback
  const [live] = await fetchRates([{ from, to }])
  return live ? amount * live.rate : 0
}

// ── Polling ───────────────────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (_timer !== null) { clearInterval(_timer); _timer = null }
}

function startPolling(
  pairs: Array<{ from: string; to: string }>,
  intervalMs: number,
  onUpdate: (rates: ForexRate[]) => void
): () => void {
  stopPolling()
  if (intervalMs <= 0) return stopPolling

  fetchRates(pairs).then(onUpdate).catch(console.warn)

  _timer = setInterval(() => {
    fetchRates(pairs).then(onUpdate).catch(console.warn)
  }, intervalMs)

  return stopPolling
}

// ── Export ────────────────────────────────────────────────────────────────────

export const forexService: IForexService = { fetchRates, convert, startPolling, stopPolling }
