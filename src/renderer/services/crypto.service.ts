/**
 * cQikly — Crypto Markets Service
 * Phase: 3b-i (LIVE IMPLEMENTATION)
 *
 * API: CoinGecko public API (free, no key required)
 *   https://api.coingecko.com/api/v3/simple/price
 *
 * Supports: up to 5 cryptos; currency from Settings (default: inr).
 * Polling: stopped entirely in Lite mode (Hard Spec #12).
 * Hot-swappable: changing symbols/currency in Settings restarts polling.
 *
 * Default symbols (CoinGecko IDs): bitcoin, ethereum, solana, binancecoin, ripple
 * Mapped to display: BTC, ETH, SOL, BNB, XRP
 */

export interface CryptoPrice {
  id: string        // CoinGecko ID, e.g. "bitcoin"
  symbol: string    // display, e.g. "BTC"
  name: string      // "Bitcoin"
  price: number
  currency: string  // e.g. "inr"
  change24h: number // % change in last 24h
  fetchedAt: number
}

export interface ICryptoService {
  fetchPrices(ids: string[], currency: string): Promise<CryptoPrice[]>
  startPolling(
    ids: string[],
    currency: string,
    intervalMs: number,
    onUpdate: (prices: CryptoPrice[]) => void
  ): () => void
  stopPolling(): void
}

// ── Known symbol / name map (extendable) ──────────────────────────────────────

const COIN_META: Record<string, { symbol: string; name: string }> = {
  bitcoin:      { symbol: 'BTC', name: 'Bitcoin' },
  ethereum:     { symbol: 'ETH', name: 'Ethereum' },
  solana:       { symbol: 'SOL', name: 'Solana' },
  binancecoin:  { symbol: 'BNB', name: 'BNB' },
  ripple:       { symbol: 'XRP', name: 'XRP' },
  dogecoin:     { symbol: 'DOGE', name: 'Dogecoin' },
  cardano:      { symbol: 'ADA', name: 'Cardano' },
  'matic-network': { symbol: 'MATIC', name: 'Polygon' },
  polkadot:     { symbol: 'DOT', name: 'Polkadot' },
  litecoin:     { symbol: 'LTC', name: 'Litecoin' },
}

/** Default 5 coins shown on fresh install */
export const DEFAULT_CRYPTO_IDS = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple']

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchPrices(ids: string[], currency: string): Promise<CryptoPrice[]> {
  if (!ids.length) return []

  const cur = currency.toLowerCase()
  const url =
    `https://api.coingecko.com/api/v3/simple/price` +
    `?ids=${ids.join(',')}` +
    `&vs_currencies=${cur}` +
    `&include_24hr_change=true`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)
  const json = await res.json()

  return ids.map(id => {
    const data = json[id] ?? {}
    const meta = COIN_META[id] ?? { symbol: id.toUpperCase(), name: id }
    return {
      id,
      symbol:    meta.symbol,
      name:      meta.name,
      price:     data[cur] ?? 0,
      currency:  cur,
      change24h: data[`${cur}_24h_change`] ?? 0,
      fetchedAt: Date.now(),
    }
  })
}

// ── Polling ───────────────────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (_timer !== null) { clearInterval(_timer); _timer = null }
}

function startPolling(
  ids: string[],
  currency: string,
  intervalMs: number,
  onUpdate: (prices: CryptoPrice[]) => void
): () => void {
  stopPolling()
  if (intervalMs <= 0) return stopPolling

  fetchPrices(ids, currency).then(onUpdate).catch(console.warn)

  _timer = setInterval(() => {
    fetchPrices(ids, currency).then(onUpdate).catch(console.warn)
  }, intervalMs)

  return stopPolling
}

// ── Export ────────────────────────────────────────────────────────────────────

export const cryptoService: ICryptoService = { fetchPrices, startPolling, stopPolling }
