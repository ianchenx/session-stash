import { beforeEach, describe, expect, it, vi } from "vitest"

import { CfKvClient } from "../cf-kv"
import { initializeMeta, loadAccount, loadIndex } from "../account"
import {
  deleteAccountFlow,
  overwriteWithCurrent,
  saveAsNewAccount,
  switchAccount,
  type SessionAdapter
} from "../switcher"
import type { Account, SessionSnapshot } from "../types"

function mockClient() {
  const store = new Map<string, Uint8Array>()
  return {
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
}

describe("switcher.saveAsNewAccount", () => {
  let client: ReturnType<typeof mockClient>
  let key: CryptoKey

  beforeEach(async () => {
    client = mockClient()
    key = await initializeMeta(client, "pw")
  })

  it("creates account + updates index + returns id", async () => {
    const snapshot: SessionSnapshot = {
      cookies: [
        {
          name: "auth",
          value: "x",
          domain: ".twitter.com",
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "lax"
        }
      ],
      localStorage: { uid: "42" }
    }

    const id = await saveAsNewAccount({
      client,
      key,
      domain: "twitter.com",
      label: "Personal",
      snapshot
    })

    const index = await loadIndex(client, key)
    expect(index.accounts).toHaveLength(1)
    expect(index.accounts[0].id).toBe(id)
    expect(index.accounts[0].label).toBe("Personal")
    const account = (await loadAccount(client, key, id))!
    expect(account.cookies).toHaveLength(1)
    expect(account.criticalKeys.cookies).toEqual(["auth"])
    expect(account.criticalKeys.localStorage).toEqual(["uid"])
    expect(account.version).toBe(1)
  })

  it("rejects duplicate label within same domain", async () => {
    const snapshot: SessionSnapshot = {
      cookies: [
        {
          name: "a",
          value: "x",
          domain: "twitter.com",
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "lax"
        }
      ],
      localStorage: {}
    }

    await saveAsNewAccount({
      client,
      key,
      domain: "twitter.com",
      label: "X",
      snapshot
    })

    await expect(
      saveAsNewAccount({
        client,
        key,
        domain: "twitter.com",
        label: "X",
        snapshot
      })
    ).rejects.toThrow(/duplicate label/)
  })
})

function fakeAdapter(init: {
  live: SessionSnapshot
}): SessionAdapter & { live: SessionSnapshot; calls: string[] } {
  const calls: string[] = []

  return {
    live: init.live,
    calls,
    async snapshot() {
      calls.push("snapshot")
      return this.live
    },
    async clear() {
      calls.push("clear")
      this.live = { cookies: [], localStorage: {} }
    },
    async inject(snapshot) {
      calls.push("inject")
      this.live = {
        cookies: [...snapshot.cookies],
        localStorage: { ...snapshot.localStorage }
      }
    },
    async reload() {
      calls.push("reload")
    }
  }
}

async function seedAccount(
  client: CfKvClient & { store: Map<string, Uint8Array> },
  key: CryptoKey,
  overrides: Partial<Account> & { id: string; domain: string; label: string }
): Promise<Account> {
  const account: Account = {
    id: overrides.id,
    domain: overrides.domain,
    label: overrides.label,
    version: overrides.version ?? 1,
    updatedAt: overrides.updatedAt ?? 1000,
    cookies: overrides.cookies ?? [
      {
        name: "auth",
        value: `v-${overrides.id}`,
        domain: `.${overrides.domain}`,
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax"
      }
    ],
    localStorage: overrides.localStorage ?? { uid: overrides.id },
    criticalKeys: overrides.criticalKeys ?? {
      cookies: ["auth"],
      localStorage: ["uid"]
    }
  }

  const { loadIndex, saveAccount, saveIndex } = await import("../account")
  await saveAccount(client, key, account)
  const index = await loadIndex(client, key)
  index.accounts.push({
    id: account.id,
    domain: account.domain,
    label: account.label,
    version: account.version,
    updatedAt: account.updatedAt
  })
  index.updatedAt = Date.now()
  await saveIndex(client, key, index)
  return account
}

describe("switcher.switchAccount", () => {
  let client: ReturnType<typeof mockClient>
  let key: CryptoKey

  beforeEach(async () => {
    client = mockClient()
    key = await initializeMeta(client, "pw")
  })

  it("happy path: push A, pull B, clear, inject, reload", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A"
    })
    await seedAccount(client, key, { id: "B", domain: "x.com", label: "B" })
    const adapter = fakeAdapter({
      live: {
        cookies: [
          {
            name: "auth",
            value: "A-live",
            domain: ".x.com",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          }
        ],
        localStorage: { uid: "A" }
      }
    })

    await switchAccount({
      client,
      key,
      adapter,
      fromAccountId: accountA.id,
      toAccountId: "B"
    })

    expect(adapter.calls).toEqual(["snapshot", "clear", "inject", "reload"])
    expect(adapter.live.cookies[0].value).toBe("v-B")
    const { loadAccount } = await import("../account")
    const afterA = (await loadAccount(client, key, "A"))!
    expect(afterA.version).toBe(2)
    expect(afterA.cookies[0].value).toBe("A-live")
  })

  it("STALE A skips push (cloud A untouched)", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A"
    })
    await seedAccount(client, key, { id: "B", domain: "x.com", label: "B" })
    const adapter = fakeAdapter({
      live: { cookies: [], localStorage: {} }
    })

    const result = await switchAccount({
      client,
      key,
      adapter,
      fromAccountId: accountA.id,
      toAccountId: "B"
    })

    expect(result.pushedFrom).toBe(false)
    const { loadAccount } = await import("../account")
    const afterA = (await loadAccount(client, key, "A"))!
    expect(afterA.version).toBe(1)
  })

  it("pull B failure leaves A untouched (no clear)", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A"
    })
    const adapter = fakeAdapter({
      live: {
        cookies: [
          {
            name: "auth",
            value: "x",
            domain: ".x.com",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          }
        ],
        localStorage: { uid: "A" }
      }
    })

    await expect(
      switchAccount({
        client,
        key,
        adapter,
        fromAccountId: accountA.id,
        toAccountId: "missing"
      })
    ).rejects.toThrow(/not found/)
    expect(adapter.calls).not.toContain("clear")
  })

  it("inject B failure triggers rollback to A", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A"
    })
    await seedAccount(client, key, { id: "B", domain: "x.com", label: "B" })
    const adapter = fakeAdapter({
      live: {
        cookies: [
          {
            name: "auth",
            value: "A-live",
            domain: ".x.com",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          }
        ],
        localStorage: { uid: "A" }
      }
    })

    let injectCount = 0
    const originalInject = adapter.inject.bind(adapter)
    adapter.inject = async (snapshot) => {
      injectCount += 1
      if (injectCount === 1) {
        throw new Error("inject failed")
      }
      return originalInject(snapshot)
    }

    await expect(
      switchAccount({
        client,
        key,
        adapter,
        fromAccountId: accountA.id,
        toAccountId: "B"
      })
    ).rejects.toThrow(/inject failed/)
    expect(adapter.live.cookies[0].value).toBe("A-live")
  })

  it("version conflict: local A.version < remote triggers onConflict", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A",
      version: 1
    })
    await seedAccount(client, key, { id: "B", domain: "x.com", label: "B" })

    accountA.version = 5
    const { loadIndex, saveAccount, saveIndex } = await import("../account")
    await saveAccount(client, key, accountA)
    const index = await loadIndex(client, key)
    index.accounts = index.accounts.map((entry) =>
      entry.id === "A" ? { ...entry, version: 5 } : entry
    )
    await saveIndex(client, key, index)

    const adapter = fakeAdapter({
      live: {
        cookies: [
          {
            name: "auth",
            value: "A-new",
            domain: ".x.com",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          }
        ],
        localStorage: { uid: "A" }
      }
    })
    const onConflict = vi.fn(async () => "overwrite" as const)

    await switchAccount({
      client,
      key,
      adapter,
      fromAccountId: accountA.id,
      toAccountId: "B",
      localFromVersion: 1,
      onConflict
    })

    expect(onConflict).toHaveBeenCalledWith({
      accountId: "A",
      localVersion: 1,
      remoteVersion: 5
    })
  })
})

describe("switcher.overwriteWithCurrent", () => {
  let client: ReturnType<typeof mockClient>
  let key: CryptoKey

  beforeEach(async () => {
    client = mockClient()
    key = await initializeMeta(client, "pw")
  })

  it("bumps version with live snapshot when health OK", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A"
    })
    const adapter = fakeAdapter({
      live: {
        cookies: [
          {
            name: "auth",
            value: "latest",
            domain: ".x.com",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax"
          }
        ],
        localStorage: { uid: "A" }
      }
    })

    await overwriteWithCurrent({ client, key, adapter, accountId: accountA.id })

    const { loadAccount } = await import("../account")
    const after = (await loadAccount(client, key, accountA.id))!
    expect(after.version).toBe(2)
    expect(after.cookies[0].value).toBe("latest")
  })

  it("refuses push when STALE/EMPTY", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A"
    })
    const adapter = fakeAdapter({ live: { cookies: [], localStorage: {} } })

    await expect(
      overwriteWithCurrent({ client, key, adapter, accountId: accountA.id })
    ).rejects.toThrow(/STALE|EMPTY/)

    const { loadAccount } = await import("../account")
    const after = (await loadAccount(client, key, accountA.id))!
    expect(after.version).toBe(1)
  })
})

describe("switcher.deleteAccountFlow", () => {
  let client: ReturnType<typeof mockClient>
  let key: CryptoKey

  beforeEach(async () => {
    client = mockClient()
    key = await initializeMeta(client, "pw")
  })

  it("removes from KV and index", async () => {
    const accountA = await seedAccount(client, key, {
      id: "A",
      domain: "x.com",
      label: "A"
    })

    await deleteAccountFlow({ client, key, accountId: accountA.id })

    const { loadAccount, loadIndex } = await import("../account")
    const index = await loadIndex(client, key)
    expect(index.accounts).toHaveLength(0)
    expect(await loadAccount(client, key, accountA.id)).toBeNull()
  })
})
