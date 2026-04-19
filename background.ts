import { initializeMeta, isInitialized, loadIndex, unlock } from "./lib/account"
import { CfKvClient } from "./lib/cf-kv"
import { getETLDPlusOne } from "./lib/domain"
import type { UiMsg, UiResp } from "./lib/messages"
import {
  clearCookies,
  clearLocalStorage,
  injectCookies,
  injectLocalStorage,
  snapshotCookies,
  snapshotLocalStorage
} from "./lib/session"
import {
  cancelAutoLock,
  clearSessionKey,
  getLockPolicy,
  isLockAlarm,
  persistSessionKey,
  restoreSessionKey,
  scheduleAutoLock,
  setLockPolicy
} from "./lib/session-lock"
import {
  getActiveAccount,
  getAllActiveAccounts,
  getCfConfig,
  setActiveAccount,
  setCfConfig
} from "./lib/store"
import {
  deleteAccountFlow,
  overwriteWithCurrent,
  renameAccount,
  saveAsNewAccount,
  switchAccount,
  type SessionAdapter
} from "./lib/switcher"
import type { ConflictInfo, SessionSnapshot } from "./lib/types"

let masterKey: CryptoKey | null = null
let switchLock: Promise<unknown> | null = null
let restorePromise: Promise<void> | null = null

async function ensureKeyRestored(): Promise<void> {
  if (masterKey !== null || restorePromise) {
    await restorePromise
    return
  }

  restorePromise = (async () => {
    const restored = await restoreSessionKey()
    if (restored) {
      masterKey = restored
    }
  })()

  try {
    await restorePromise
  } finally {
    restorePromise = null
  }
}

async function setUnlocked(key: CryptoKey): Promise<void> {
  masterKey = key
  await persistSessionKey(key)
  const policy = await getLockPolicy()
  await scheduleAutoLock(policy)
}

async function setLocked(): Promise<void> {
  masterKey = null
  await clearSessionKey()
  await cancelAutoLock()
}

async function touchLockTimer(): Promise<void> {
  if (!masterKey) {
    return
  }
  const policy = await getLockPolicy()
  await scheduleAutoLock(policy)
}

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

async function findSameDomainTabs(domain: string): Promise<number[]> {
  const tabs = await chrome.tabs.query({
    url: [`*://*.${domain}/*`, `*://${domain}/*`]
  })
  const matchingTabs = tabs.filter(
    (tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
      !tab.incognito && tab.id !== undefined && typeof tab.url === "string"
  )

  return matchingTabs
    .filter((tab) => getETLDPlusOne(tab.url) === domain)
    .map((tab) => tab.id)
}

async function syncOtherTabs(
  tabIds: number[],
  localStorage: SessionSnapshot["localStorage"],
  label: string
): Promise<number> {
  if (tabIds.length === 0) {
    return 0
  }

  await Promise.allSettled(tabIds.map((tabId) => clearLocalStorage(tabId)))
  await Promise.allSettled(
    tabIds.map((tabId) => injectLocalStorage(tabId, localStorage))
  )
  const reloadResults = await Promise.allSettled(
    tabIds.map((tabId) => chrome.tabs.reload(tabId))
  )
  await Promise.allSettled(tabIds.map((tabId) => updateBadge(tabId, label)))

  return reloadResults.filter((result) => result.status === "fulfilled").length
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
  await ensureKeyRestored()

  switch (msg.type) {
    case "STATUS": {
      const config = await getCfConfig()
      const client = config ? new CfKvClient(config) : null
      const initialized = client ? await isInitialized(client) : false
      const policy = await getLockPolicy()
      return {
        ok: true,
        kind: "status",
        initialized,
        unlocked: masterKey !== null,
        cfConfigured: config !== null,
        lockPolicy: policy
      }
    }

    case "GET_CF_CONFIG": {
      const config = await getCfConfig()
      return { ok: true, kind: "cf-config", config }
    }

    case "SET_CF_CONFIG": {
      await setCfConfig(msg.cfg)
      return { ok: true }
    }

    case "INIT_META": {
      const client = await getClient()
      const key = await initializeMeta(client, msg.password)
      await setUnlocked(key)
      return { ok: true }
    }

    case "UNLOCK": {
      const client = await getClient()
      const key = await unlock(client, msg.password)
      await setUnlocked(key)
      return { ok: true }
    }

    case "LOCK": {
      await setLocked()
      return { ok: true }
    }

    case "SET_LOCK_POLICY": {
      await setLockPolicy(msg.policy)
      if (masterKey) {
        await scheduleAutoLock(msg.policy)
      }
      return { ok: true }
    }

    case "GET_LOCK_POLICY": {
      const policy = await getLockPolicy()
      return { ok: true, kind: "lock-policy", policy }
    }

    case "LIST_ALL": {
      const client = await getClient()
      const key = requireKey()
      await touchLockTimer()
      const index = await loadIndex(client, key)
      const activeByDomain = await getAllActiveAccounts()
      return {
        ok: true,
        kind: "all-accounts",
        entries: index.accounts,
        activeByDomain
      }
    }

    case "LIST_ACCOUNTS": {
      const client = await getClient()
      const key = requireKey()
      await touchLockTimer()
      const index = await loadIndex(client, key)
      const entries = index.accounts.filter(
        (account) => account.domain === msg.domain
      )
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
        await touchLockTimer()
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
        await touchLockTimer()
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
          const toLabel = result.toAccount.label
          const otherTabIds = (await findSameDomainTabs(msg.domain)).filter(
            (tabId) => tabId !== msg.tabId
          )
          const syncedTabCount = await syncOtherTabs(
            otherTabIds,
            result.toAccount.localStorage,
            toLabel
          )
          await updateBadge(msg.tabId, toLabel)
          return {
            ok: true,
            kind: "switched",
            pushedFrom: result.pushedFrom,
            newFromVersion: result.newFromVersion,
            syncedTabCount
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
        await touchLockTimer()
        const index = await loadIndex(client, key)
        const entry = index.accounts.find(
          (account) => account.id === msg.accountId
        )
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
        await touchLockTimer()
        const index = await loadIndex(client, key)
        const entry = index.accounts.find(
          (account) => account.id === msg.accountId
        )
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

    case "RENAME": {
      return withLock(async () => {
        const client = await getClient()
        const key = requireKey()
        await touchLockTimer()
        await renameAccount({
          client,
          key,
          accountId: msg.accountId,
          label: msg.label
        })
        return { ok: true }
      })
    }

    case "WIPE_CURRENT": {
      return withLock(async () => {
        await touchLockTimer()
        const adapter = makeAdapter(msg.domain, msg.tabId)
        await adapter.clear()
        await setActiveAccount(msg.domain, null)
        await updateBadge(msg.tabId, null)
        await adapter.reload()
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (isLockAlarm(alarm)) {
    void setLocked()
  }
})

chrome.runtime.onStartup.addListener(() => {
  void ensureKeyRestored()
})
