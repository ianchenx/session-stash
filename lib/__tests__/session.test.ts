import { describe, expect, it } from "vitest"

import type { CriticalKeys, SerializedCookie } from "../types"
import {
  checkHealth,
  clearCookies,
  clearLocalStorage,
  injectCookies,
  injectLocalStorage,
  snapshotCookies,
  snapshotLocalStorage
} from "../session"

type ChromeCookie = {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: chrome.cookies.SameSiteStatus
  expirationDate?: number
  storeId?: string
  session?: boolean
  hostOnly?: boolean
}

function mockCookies(initial: ChromeCookie[] = []) {
  let store = [...initial]
  ;(globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    cookies: {
      async getAll(details: chrome.cookies.GetAllDetails) {
        const domain = details.domain
        return store.filter(
          (cookie) =>
            !domain ||
            cookie.domain.endsWith(domain) ||
            cookie.domain.endsWith(`.${domain}`)
        )
      },
      async set(details: chrome.cookies.SetDetails) {
        const parsed = new URL(details.url)
        const cookie: ChromeCookie = {
          name: details.name!,
          value: details.value ?? "",
          domain: details.domain ?? parsed.hostname,
          path: details.path ?? "/",
          secure: details.secure ?? false,
          httpOnly: details.httpOnly ?? false,
          sameSite: details.sameSite ?? "unspecified",
          expirationDate: details.expirationDate,
          storeId: details.storeId
        }
        store = store.filter(
          (existing) =>
            !(
              existing.name === cookie.name &&
              existing.domain === cookie.domain &&
              existing.path === cookie.path
            )
        )
        store.push(cookie)
        return cookie as unknown as chrome.cookies.Cookie
      },
      async remove(details: chrome.cookies.Details) {
        const parsed = new URL(details.url)
        store = store.filter(
          (cookie) =>
            !(
              cookie.name === details.name &&
              cookie.path === parsed.pathname &&
              parsed.hostname.endsWith(
                cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
              )
            )
        )
        return {
          name: details.name,
          url: details.url,
          storeId: details.storeId ?? ""
        } as chrome.cookies.Details
      }
    }
  } as typeof chrome

  return () => store
}

describe("session.cookies", () => {
  it("snapshotCookies returns all cookies for eTLD+1 and subdomains", async () => {
    mockCookies([
      {
        name: "a",
        value: "1",
        domain: ".twitter.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax"
      },
      {
        name: "b",
        value: "2",
        domain: "api.twitter.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "no_restriction"
      },
      {
        name: "c",
        value: "3",
        domain: "other.com",
        path: "/",
        secure: false,
        httpOnly: false,
        sameSite: "unspecified"
      }
    ])
    const snapshot = await snapshotCookies("twitter.com")
    expect(snapshot.map((cookie) => cookie.name).sort()).toEqual(["a", "b"])
  })

  it("preserves HttpOnly / Secure / SameSite / domain", async () => {
    mockCookies([
      {
        name: "auth_token",
        value: "v",
        domain: ".twitter.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax"
      }
    ])
    const [cookie] = await snapshotCookies("twitter.com")
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.secure).toBe(true)
    expect(cookie.sameSite).toBe("lax")
    expect(cookie.domain).toBe(".twitter.com")
  })

  it("clearCookies removes all cookies for domain", async () => {
    const get = mockCookies([
      {
        name: "a",
        value: "1",
        domain: ".twitter.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax"
      },
      {
        name: "c",
        value: "3",
        domain: "other.com",
        path: "/",
        secure: false,
        httpOnly: false,
        sameSite: "unspecified"
      }
    ])
    await clearCookies("twitter.com")
    expect(get().map((cookie) => cookie.name)).toEqual(["c"])
  })

  it("injectCookies sets cookies including expirationDate omission for session cookies", async () => {
    const get = mockCookies()
    const input: SerializedCookie[] = [
      {
        name: "sess",
        value: "s",
        domain: ".twitter.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax"
      },
      {
        name: "pers",
        value: "p",
        domain: ".twitter.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "no_restriction",
        expirationDate: 9999999999
      }
    ]
    await injectCookies("twitter.com", input)
    const out = get()
    const sessionCookie = out.find((cookie) => cookie.name === "sess")!
    const persistentCookie = out.find((cookie) => cookie.name === "pers")!
    expect(sessionCookie.expirationDate).toBeUndefined()
    expect(persistentCookie.expirationDate).toBe(9999999999)
    expect(persistentCookie.httpOnly).toBe(false)
    expect(sessionCookie.httpOnly).toBe(true)
  })
})

type Script = {
  target: chrome.scripting.InjectionTarget
  func: (...args: unknown[]) => unknown
  args?: unknown[]
  world?: chrome.scripting.ExecutionWorld
}

function mockScripting(behavior: (script: Script) => unknown) {
  const calls: Script[] = []
  ;(globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    ...chrome,
    scripting: {
      async executeScript(script: Script) {
        calls.push(script)
        const result = behavior(script)
        return [{ result, frameId: 0 }] as chrome.scripting.InjectionResult<unknown>[]
      }
    }
  } as typeof chrome
  return calls
}

describe("session.localStorage", () => {
  it("snapshotLocalStorage returns { key: value } dict", async () => {
    mockScripting(() => ({ foo: "bar", n: "42" }))
    const out = await snapshotLocalStorage(123)
    expect(out).toEqual({ foo: "bar", n: "42" })
  })

  it("clearLocalStorage invokes MAIN world script", async () => {
    const calls = mockScripting(() => undefined)
    await clearLocalStorage(456)
    expect(calls).toHaveLength(1)
    expect(calls[0].target.tabId).toBe(456)
    expect(calls[0].world).toBe("MAIN")
  })

  it("injectLocalStorage passes entries via args", async () => {
    const calls = mockScripting(() => undefined)
    await injectLocalStorage(789, { a: "1", b: "2" })
    expect(calls).toHaveLength(1)
    expect(calls[0].args).toEqual([{ a: "1", b: "2" }])
    expect(calls[0].world).toBe("MAIN")
  })
})

describe("session.health", () => {
  const critical: CriticalKeys = {
    cookies: ["auth_token", "csrf"],
    localStorage: ["user_id"]
  }

  it("returns OK when all critical keys present", () => {
    const status = checkHealth(
      {
        cookies: [
          {
            name: "auth_token",
            value: "x",
            domain: "x",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          },
          {
            name: "csrf",
            value: "y",
            domain: "x",
            path: "/",
            secure: true,
            httpOnly: false,
            sameSite: "lax"
          }
        ],
        localStorage: { user_id: "123" }
      },
      critical
    )
    expect(status).toBe("OK")
  })

  it("returns STALE when a critical cookie is missing", () => {
    const status = checkHealth(
      {
        cookies: [
          {
            name: "auth_token",
            value: "x",
            domain: "x",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          }
        ],
        localStorage: { user_id: "123" }
      },
      critical
    )
    expect(status).toBe("STALE")
  })

  it("returns STALE when a critical localStorage key is missing", () => {
    const status = checkHealth(
      {
        cookies: [
          {
            name: "auth_token",
            value: "x",
            domain: "x",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          },
          {
            name: "csrf",
            value: "y",
            domain: "x",
            path: "/",
            secure: true,
            httpOnly: false,
            sameSite: "lax"
          }
        ],
        localStorage: {}
      },
      critical
    )
    expect(status).toBe("STALE")
  })

  it("returns EMPTY when cookies and localStorage are both empty", () => {
    const status = checkHealth({ cookies: [], localStorage: {} }, critical)
    expect(status).toBe("EMPTY")
  })
})
