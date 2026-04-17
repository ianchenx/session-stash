import { beforeEach, describe, expect, it } from "vitest"

import * as store from "../store"

function mockChrome() {
  const data: Record<string, unknown> = {}
  const api = {
    storage: {
      local: {
        async get(keys: string | string[] | null) {
          const selectedKeys =
            keys === null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys]
          const out: Record<string, unknown> = {}
          for (const key of selectedKeys) {
            if (key in data) {
              out[key] = data[key]
            }
          }
          return out
        },
        async set(items: Record<string, unknown>) {
          Object.assign(data, items)
        },
        async remove(keys: string | string[]) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete data[key]
          }
        }
      }
    }
  }

  ;(globalThis as typeof globalThis & { chrome: typeof chrome }).chrome =
    api as unknown as typeof chrome

  return data
}

describe("store", () => {
  beforeEach(() => mockChrome())

  it("active account get/set/clear per domain", async () => {
    expect(await store.getActiveAccount("twitter.com")).toBeNull()
    await store.setActiveAccount("twitter.com", "acc-1")
    await store.setActiveAccount("github.com", "acc-2")
    expect(await store.getActiveAccount("twitter.com")).toBe("acc-1")
    expect(await store.getActiveAccount("github.com")).toBe("acc-2")
    await store.setActiveAccount("twitter.com", null)
    expect(await store.getActiveAccount("twitter.com")).toBeNull()
    expect(await store.getActiveAccount("github.com")).toBe("acc-2")
  })

  it("cf config roundtrip", async () => {
    expect(await store.getCfConfig()).toBeNull()
    await store.setCfConfig({
      accountId: "a",
      namespaceId: "n",
      apiToken: "t"
    })
    expect(await store.getCfConfig()).toEqual({
      accountId: "a",
      namespaceId: "n",
      apiToken: "t"
    })
  })

  it("clears all storage on wipe", async () => {
    await store.setActiveAccount("x.com", "a")
    await store.setCfConfig({
      accountId: "a",
      namespaceId: "n",
      apiToken: "t"
    })
    await store.wipe()
    expect(await store.getActiveAccount("x.com")).toBeNull()
    expect(await store.getCfConfig()).toBeNull()
  })
})
