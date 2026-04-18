import type {
  CriticalKeys,
  HealthStatus,
  SerializedCookie,
  SessionSnapshot
} from "./types"

export async function snapshotCookies(
  eTLDPlusOne: string
): Promise<SerializedCookie[]> {
  const cookies = await chrome.cookies.getAll({ domain: eTLDPlusOne })
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite as SerializedCookie["sameSite"],
    expirationDate: cookie.expirationDate,
    storeId: cookie.storeId
  }))
}

export async function clearCookies(eTLDPlusOne: string): Promise<void> {
  const cookies = await chrome.cookies.getAll({ domain: eTLDPlusOne })

  for (const cookie of cookies) {
    const url = buildCookieUrl(cookie.secure, cookie.domain, cookie.path)
    try {
      await chrome.cookies.remove({
        url,
        name: cookie.name,
        storeId: cookie.storeId
      })
    } catch {
      // Continue removing the rest of the cookies for the domain.
    }
  }
}

export async function injectCookies(
  _eTLDPlusOne: string,
  cookies: SerializedCookie[]
): Promise<void> {
  for (const cookie of cookies) {
    const url = buildCookieUrl(cookie.secure, cookie.domain, cookie.path)
    const details: chrome.cookies.SetDetails = {
      url,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain.startsWith(".") ? cookie.domain : undefined,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite as chrome.cookies.SameSiteStatus,
      storeId: cookie.storeId
    }

    if (cookie.expirationDate !== undefined) {
      details.expirationDate = cookie.expirationDate
    }

    try {
      await chrome.cookies.set(details)
    } catch (error) {
      console.warn(
        `cookie inject failed: ${cookie.name}@${cookie.domain}`,
        error
      )
    }
  }
}

function buildCookieUrl(secure: boolean, domain: string, path: string): string {
  const host = domain.startsWith(".") ? domain.slice(1) : domain
  const scheme = secure ? "https" : "http"
  return `${scheme}://${host}${path}`
}

export async function snapshotLocalStorage(
  tabId: number
): Promise<Record<string, string>> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const out: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key !== null) {
          out[key] = localStorage.getItem(key) ?? ""
        }
      }
      return out
    }
  })

  return (result as Record<string, string>) ?? {}
}

export async function clearLocalStorage(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      localStorage.clear()
    }
  })
}

export async function injectLocalStorage(
  tabId: number,
  entries: Record<string, string>
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (data: Record<string, string>) => {
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, value)
      }
    },
    args: [entries]
  })
}

export function checkHealth(
  snapshot: SessionSnapshot,
  critical: CriticalKeys
): HealthStatus {
  if (
    snapshot.cookies.length === 0 &&
    Object.keys(snapshot.localStorage).length === 0
  ) {
    return "EMPTY"
  }

  const cookieNames = new Set(snapshot.cookies.map((cookie) => cookie.name))
  const localStorageKeys = new Set(Object.keys(snapshot.localStorage))

  for (const key of critical.cookies) {
    if (!cookieNames.has(key)) {
      return "STALE"
    }
  }

  for (const key of critical.localStorage) {
    if (!localStorageKeys.has(key)) {
      return "STALE"
    }
  }

  return "OK"
}
