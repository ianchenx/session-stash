import type { ConflictInfo } from "./lib/types"
import type { UiMsg, UiResp } from "./lib/messages"

import { clearCookies, clearLocalStorage, injectCookies, injectLocalStorage, snapshotCookies, snapshotLocalStorage } from "./lib/session"
import { CfKvClient } from "./lib/cf-kv"
import {
  deleteAccountFlow,
  overwriteWithCurrent,
  saveAsNewAccount,
  switchAccount,
  type SessionAdapter
} from "./lib/switcher"
import { getActiveAccount, getCfConfig, setActiveAccount, setCfConfig } from "./lib/store"
import { initializeMeta, isInitialized, loadIndex, unlock } from "./lib/account"

let masterKey: CryptoKey | null = null
let switchLock: Promise<unknown> | null = null

async function getClient(): Promise<CfKvClient> {
  const config = await getCfConfig()
  if (!config) {
    throw new Error("Cloudflare config not set")
  }
  return new CfKvClient(config)
}

function requireKey(): CryptoKey {
  if (!masterKey) {
    throw new Error("locked")
  }
  return masterKey
}

function makeAdapter(domain: string, tabId: number): SessionAdapter {
  return {
    async snapshot() {
      const cookies = await snapshotCookies(domain)
      const localStorage = await snapshotLocalStorage(tabId)
      return { cookies, localStorage }
    },
    async clear() {
      await clearCookies(domain)
      await clearLocalStorage(tabId)
    },
    async inject(snapshot) {
      await injectCookies(domain, snapshot.cookies)
      await injectLocalStorage(tabId, snapshot.localStorage)
    },
    async reload() {
      await chrome.tabs.reload(tabId)
    }
  }
}

async function updateBadge(tabId: number, label: string | null): Promise<void> {
  const text = label ? label.slice(0, 2).toUpperCase() : ""
  await chrome.action.setBadgeText({ tabId, text })
  if (label) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" })
  }
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (switchLock) {
    try {
      await switchLock
    } catch {
      // Wait for the previous operation to release the lock.
    }
  }

  const promise = fn()
  switchLock = promise.finally(() => {
    switchLock = null
  })
  return promise
}

function isConflictInfo(value: unknown): value is ConflictInfo {
  if (!value || typeof value !== "object") {
    return false
  }

  const info = value as Partial<ConflictInfo>
  return (
    typeof info.accountId === "string" &&
    typeof info.localVersion === "number" &&
    typeof info.remoteVersion === "number"
  )
}

async function handle(msg: UiMsg): Promise<UiResp> {
  switch (msg.type) {
    case "STATUS": {
      const config = await getCfConfig()
      const client = config ? new CfKvClient(config) : null
      const initialized = client ? await isInitialized(client) : false
      return {
        ok: true,
        kind: "status",
        initialized,
        unlocked: masterKey !== null,
        cfConfigured: config !== null
      }
    }

    case "SET_CF_CONFIG": {
      await setCfConfig(msg.cfg)
      return { ok: true }
    }

    case "INIT_META": {
      const client = await getClient()
      masterKey = await initializeMeta(client, msg.password)
      return { ok: true }
    }

    case "UNLOCK": {
      const client = await getClient()
      masterKey = await unlock(client, msg.password)
      return { ok: true }
    }

    case "LOCK": {
      masterKey = null
      return { ok: true }
    }

    case "LIST_ACCOUNTS": {
      const client = await getClient()
      const key = requireKey()
      const index = await loadIndex(client, key)
      const entries = index.accounts.filter((account) => account.domain === msg.domain)
      const activeId = await getActiveAccount(msg.domain)
      return {
        ok: true,
        kind: "accounts",
        entries,
        activeId
      }
    }

    case "SAVE_NEW": {
      return withLock(async () => {
        const client = await getClient()
        const key = requireKey()
        const adapter = makeAdapter(msg.domain, msg.tabId)
        const snapshot = await adapter.snapshot()
        const id = await saveAsNewAccount({
          client,
          key,
          domain: msg.domain,
          label: msg.label,
          snapshot
        })
        await setActiveAccount(msg.domain, id)
        await updateBadge(msg.tabId, msg.label)
        return { ok: true, data: { id } }
      })
    }

    case "SWITCH": {
      return withLock(async () => {
        const client = await getClient()
        const key = requireKey()
        const adapter = makeAdapter(msg.domain, msg.tabId)
        try {
          const result = await switchAccount({
            client,
            key,
            adapter,
            fromAccountId: msg.fromId ?? "",
            toAccountId: msg.toId,
            localFromVersion: msg.localFromVersion,
            onConflict: async (info) => {
              if (msg.resolution) {
                return msg.resolution
              }
              throw Object.assign(new Error("conflict"), { conflict: info })
            }
          })
          await setActiveAccount(msg.domain, msg.toId)
          const index = await loadIndex(client, key)
          const toLabel = index.accounts.find((account) => account.id === msg.toId)?.label ?? "?"
          await updateBadge(msg.tabId, toLabel)
          return {
            ok: true,
            kind: "switched",
            pushedFrom: result.pushedFrom,
            newFromVersion: result.newFromVersion
          }
        } catch (error: unknown) {
          if (
            error &&
            typeof error === "object" &&
            "conflict" in error &&
            isConflictInfo((error as { conflict?: unknown }).conflict)
          ) {
            return {
              ok: true,
              kind: "conflict",
              info: (error as { conflict: ConflictInfo }).conflict
            }
          }
          throw error
        }
      })
    }

    case "OVERWRITE": {
      return withLock(async () => {
        const client = await getClient()
        const key = requireKey()
        const index = await loadIndex(client, key)
        const entry = index.accounts.find((account) => account.id === msg.accountId)
        if (!entry) {
          throw new Error(`account ${msg.accountId} not found`)
        }
        const adapter = makeAdapter(entry.domain, msg.tabId)
        await overwriteWithCurrent({
          client,
          key,
          adapter,
          accountId: msg.accountId
        })
        return { ok: true }
      })
    }

    case "DELETE": {
      return withLock(async () => {
        const client = await getClient()
        const key = requireKey()
        const index = await loadIndex(client, key)
        const entry = index.accounts.find((account) => account.id === msg.accountId)
        await deleteAccountFlow({ client, key, accountId: msg.accountId })
        if (entry) {
          const activeId = await getActiveAccount(entry.domain)
          if (activeId === msg.accountId) {
            await setActiveAccount(entry.domain, null)
            await updateBadge(msg.tabId, null)
          }
        }
        return { ok: true }
      })
    }
  }
}

chrome.runtime.onMessage.addListener((msg: UiMsg, _sender, sendResponse) => {
  handle(msg)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      sendResponse({ ok: false, error: message })
    })
  return true
})
