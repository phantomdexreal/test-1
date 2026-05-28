/**
 * cQikly — Weather Service
 * Phase: 3b-i (LIVE IMPLEMENTATION)
 *
 * API: Open-Meteo (completely free, no API key required)
 *   - Geocoding: https://geocoding-api.open-meteo.com/v1/search
 *   - Weather:   https://api.open-meteo.com/v1/forecast
 *   - AQI:       https://air-quality-api.open-meteo.com/v1/air-quality
 *
 * Data: temperature (°C), humidity (%), wind speed (km/h), AQI, condition.
 * City: configured in Settings (config.weatherCity).
 * Polling: stopped entirely in Lite performance mode (Hard Spec #12).
 * Hot-swappable: changing city in Settings triggers immediate re-fetch.
 */

export interface WeatherData {
  city: string
  temperature: number    // Celsius
  feelsLike: number      // Celsius
  humidity: number       // %
  windSpeed: number      // km/h
  aqi: number            // Air Quality Index (European AQI)
  aqiLabel: string       // Good / Fair / Moderate / Poor / Very Poor
  condition: string      // e.g. "Clear", "Rain", "Cloudy"
  conditionIcon: string  // emoji
  fetchedAt: number      // timestamp ms
}

export interface IWeatherService {
  fetchWeather(city: string): Promise<WeatherData>
  startPolling(city: string, intervalMs: number, onUpdate: (data: WeatherData) => void): () => void
  stopPolling(): void
}

// ── WMO weather code → label + emoji ─────────────────────────────────────────

function decodeWMO(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Clear', icon: '☀️' }
  if (code <= 2) return { condition: 'Partly Cloudy', icon: '⛅' }
  if (code === 3) return { condition: 'Overcast', icon: '☁️' }
  if (code <= 49) return { condition: 'Foggy', icon: '🌫️' }
  if (code <= 59) return { condition: 'Drizzle', icon: '🌦️' }
  if (code <= 69) return { condition: 'Rain', icon: '🌧️' }
  if (code <= 79) return { condition: 'Snow', icon: '❄️' }
  if (code <= 84) return { condition: 'Rain Showers', icon: '🌧️' }
  if (code <= 94) return { condition: 'Thunderstorm', icon: '⛈️' }
  return { condition: 'Storm', icon: '🌩️' }
}

function aqiLabel(aqi: number): string {
  if (aqi <= 20) return 'Good'
  if (aqi <= 40) return 'Fair'
  if (aqi <= 60) return 'Moderate'
  if (aqi <= 80) return 'Poor'
  return 'Very Poor'
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

async function geocode(city: string): Promise<{ lat: number; lon: number; name: string }> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`)
  const json = await res.json()
  if (!json.results?.length) throw new Error(`City not found: ${city}`)
  const r = json.results[0]
  return { lat: r.latitude, lon: r.longitude, name: r.name }
}

// ── Live fetch ────────────────────────────────────────────────────────────────

async function fetchWeather(city: string): Promise<WeatherData> {
  if (!city || !city.trim()) {
    return {
      city: '',
      temperature: 0, feelsLike: 0, humidity: 0, windSpeed: 0,
      aqi: 0, aqiLabel: '', condition: 'No city configured', conditionIcon: '🌐',
      fetchedAt: Date.now(),
    }
  }

  const { lat, lon, name } = await geocode(city)

  // Fetch weather + AQI in parallel
  const [wxRes, aqRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code` +
      `&wind_speed_unit=kmh&timezone=auto`
    ),
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi&timezone=auto`
    ),
  ])

  if (!wxRes.ok) throw new Error(`Weather API error: ${wxRes.status}`)
  const wx = await wxRes.json()
  const cur = wx.current

  let aqi = 0
  try {
    if (aqRes.ok) {
      const aq = await aqRes.json()
      aqi = Math.round(aq.current?.european_aqi ?? 0)
    }
  } catch { /* AQI optional — degrade gracefully */ }

  const wmoCode: number = cur.weather_code ?? 0
  const { condition, icon } = decodeWMO(wmoCode)

  return {
    city: name,
    temperature:   Math.round(cur.temperature_2m ?? 0),
    feelsLike:     Math.round(cur.apparent_temperature ?? 0),
    humidity:      Math.round(cur.relative_humidity_2m ?? 0),
    windSpeed:     Math.round(cur.wind_speed_10m ?? 0),
    aqi,
    aqiLabel:      aqiLabel(aqi),
    condition,
    conditionIcon: icon,
    fetchedAt:     Date.now(),
  }
}

// ── Polling state ─────────────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (_timer !== null) {
    clearInterval(_timer)
    _timer = null
  }
}

function startPolling(
  city: string,
  intervalMs: number,
  onUpdate: (data: WeatherData) => void
): () => void {
  stopPolling()
  if (intervalMs <= 0) return stopPolling

  // Immediate first fetch
  fetchWeather(city).then(onUpdate).catch(console.warn)

  _timer = setInterval(() => {
    fetchWeather(city).then(onUpdate).catch(console.warn)
  }, intervalMs)

  return stopPolling
}

// ── Export ────────────────────────────────────────────────────────────────────

export const weatherService: IWeatherService = {
  fetchWeather,
  startPolling,
  stopPolling,
}
