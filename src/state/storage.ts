/**
 * localStorage helpers.
 *
 * Every access is guarded: Safari private mode throws on setItem, some embedded
 * webviews throw on merely touching `window.localStorage`, and stored JSON can be
 * corrupt or from an older schema. Losing a playlist is bad; crashing the player
 * is worse.
 */

const PREFIX = 'furina-player:v1:'

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled — non-fatal.
  }
}
