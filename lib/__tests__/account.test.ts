import { beforeEach, describe, expect, it } from "vitest"

import {
  deleteAccount,
  initializeMeta,
  isInitialized,
  loadAccount,
  loadIndex,
  saveAccount,
  saveIndex,
  unlock
} from "../account"
import { CfKvClient } from "../cf-kv"
import type { Account } from "../types"

function mockClient(): CfKvClient & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>()
  const client = {
    store,
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: Uint8Array) {
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    }
  } as unknown as CfKvClient & { store: Map<string, Uint8Array> }

  return client
}

describe("account.meta", () => {
  let client: ReturnType<typeof mockClient>

  beforeEach(() => {
    client = mockClient()
  })

  it("isInitialized is false on fresh namespace", async () => {
    expect(await isInitialized(client)).toBe(false)
  })

  it("initializeMeta then unlock with correct password succeeds", async () => {
    await initializeMeta(client, "hunter2")
    expect(await isInitialized(client)).toBe(true)
    const key = await unlock(client, "hunter2")
    expect(key).toBeDefined()
  })

  it("unlock with wrong password throws", async () => {
    await initializeMeta(client, "correct-pass")
    await expect(unlock(client, "wrong-pass")).rejects.toThrow()
  })

  it("initializeMeta refuses to overwrite existing meta", async () => {
    await initializeMeta(client, "p1")
    await expect(initializeMeta(client, "p2")).rejects.toThrow(
      /already initialized/
    )
  })

  it("unlock rejects a meta with a newer schemaVersion", async () => {
    const meta = {
      schemaVersion: 999,
      salt: "AAAA",
      verifier: "BBBB"
    }
    client.store.set("meta", new TextEncoder().encode(JSON.stringify(meta)))
    await expect(unlock(client, "pw")).rejects.toThrow(
      /newer than this extension supports/
    )
  })

  it("unlock rejects a meta with an older schemaVersion", async () => {
    const meta = {
      schemaVersion: 0,
      salt: "AAAA",
      verifier: "BBBB"
    }
    client.store.set("meta", new TextEncoder().encode(JSON.stringify(meta)))
    await expect(unlock(client, "pw")).rejects.toThrow(/older than supported/)
  })

  it("unlock rejects a meta whose schemaVersion is not a number", async () => {
    const meta = {
      schemaVersion: "one",
      salt: "AAAA",
      verifier: "BBBB"
    }
    client.store.set("meta", new TextEncoder().encode(JSON.stringify(meta)))
    await expect(unlock(client, "pw")).rejects.toThrow(
      /schemaVersion missing or invalid/
    )
  })
})

describe("account.index", () => {
  let client: ReturnType<typeof mockClient>
  let key: CryptoKey

  beforeEach(async () => {
    client = mockClient()
    key = await initializeMeta(client, "pw")
  })

  it("loadIndex returns empty shape when absent", async () => {
    const index = await loadIndex(client, key)
    expect(index.accounts).toEqual([])
    expect(index.updatedAt).toBe(0)
  })

  it("saveIndex then loadIndex roundtrips", async () => {
    await saveIndex(client, key, {
      accounts: [
        {
          id: "a1",
          domain: "twitter.com",
          label: "Personal",
          version: 1,
          updatedAt: 1000
        }
      ],
      updatedAt: 1234
    })

    const index = await loadIndex(client, key)
    expect(index.accounts).toHaveLength(1)
    expect(index.accounts[0].label).toBe("Personal")
    expect(index.updatedAt).toBe(1234)
  })

  it("loadIndex with wrong key throws", async () => {
    await saveIndex(client, key, { accounts: [], updatedAt: 1 })
    const wrongClient = mockClient()
    await initializeMeta(wrongClient, "other")
    wrongClient.store.set("index", client.store.get("index")!)
    const wrongKey = await unlock(wrongClient, "other")
    await expect(loadIndex(wrongClient, wrongKey)).rejects.toThrow()
  })
})

describe("account.crud", () => {
  let client: ReturnType<typeof mockClient>
  let key: CryptoKey

  beforeEach(async () => {
    client = mockClient()
    key = await initializeMeta(client, "pw")
  })

  const sample: Account = {
    id: "acc-1",
    domain: "twitter.com",
    label: "Personal",
    version: 1,
    updatedAt: 1000,
    cookies: [
      {
        name: "auth_token",
        value: "xyz",
        domain: ".twitter.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax"
      }
    ],
    localStorage: { "x-user": "ian" },
    criticalKeys: {
      cookies: ["auth_token"],
      localStorage: ["x-user"]
    }
  }

  it("save then load matches", async () => {
    await saveAccount(client, key, sample)
    const out = await loadAccount(client, key, "acc-1")
    expect(out).toEqual(sample)
  })

  it("loadAccount returns null when absent", async () => {
    expect(await loadAccount(client, key, "missing")).toBeNull()
  })

  it("deleteAccount removes it", async () => {
    await saveAccount(client, key, sample)
    await deleteAccount(client, "acc-1")
    expect(await loadAccount(client, key, "acc-1")).toBeNull()
  })

  it("account id is used as AAD (swap fails to decrypt)", async () => {
    await saveAccount(client, key, sample)
    const blob = client.store.get("account:acc-1")!
    client.store.set("account:acc-other", blob)
    await expect(loadAccount(client, key, "acc-other")).rejects.toThrow()
  })
})
