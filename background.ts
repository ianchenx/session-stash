import {
  initializeMeta,
  isInitialized,
  loadIndex,
  loadMeta,
  unlock,
  validateSchemaVersion
} from "./lib/account"
import { CfKvClient } from "./lib/cf-kv"
import { getETLDPlusOne } from "./lib/domain"
import type { BroadcastMsg, UiMsg, UiResp } from "./lib/messages"
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
    if (!restored) {
      return
    }
    // Before trusting the restored key for any read/write, confirm the KV's
    // schema is still one this build supports. Another device may have
    // migrated the vault while this one was suspended; using the cached key
    // against an incompatible layout would silently corrupt data.
    try {
      const config = await getCfConfig()
      if (!config) {
        await clearSessionKey()
        return
      }
      const meta = await loadMeta(new CfKvClient(config))
      if (!meta) {
        await clearSessionKey()
        return
      }
      validateSchemaVersion(meta)
      masterKey = restored
    } catch {
      await clearSessionKey()
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

function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

type SyncTarget = {
  id: number
  origin: string
}

async function findSameDomainTabs(domain: string): Promise<SyncTarget[]> {
  const tabs = await chrome.tabs.query({
    url: [`https://*.${domain}/*`, `https://${domain}/*`]
  })

  return tabs.flatMap((tab) => {
    if (tab.incognito || tab.id === undefined || typeof tab.url !== "string") {
      return []
    }

    if (getETLDPlusOne(tab.url) !== domain) {
      return []
    }

    const origin = getOrigin(tab.url)
    if (!origin?.startsWith("https://")) {
      return []
    }

    return [{ id: tab.id, origin }]
  })
}

async function syncOtherTabs(
  tabs: SyncTarget[],
  sourceOrigin: string,
  localStorage: SessionSnapshot["localStorage"],
  label: string
): Promise<number> {
  if (tabs.length === 0) {
    return 0
  }

  const results = await Promise.all(
    tabs.map(async (tab) => {
      try {
        if (tab.origin === sourceOrigin) {
          await clearLocalStorage(tab.id)
          await injectLocalStorage(tab.id, localStorage)
        }

        await chrome.tabs.reload(tab.id)
        await updateBadge(tab.id, label)
        return true
      } catch {
        return false
      }
    })
  )

  return results.filter(Boolean).length
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
  const tracker = promise.finally(() => {
    switchLock = null
  })
  tracker.catch(() => {
    // Rejections flow out through `promise` to the caller; this no-op handler
    // exists so the lock tracker itself never surfaces as an unhandled rejection
    // when no subsequent withLock() waits on it.
  })
  switchLock = tracker
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
      const previous = await getCfConfig()
      await setCfConfig(msg.cfg)
      if (
        masterKey &&
        previous &&
        (previous.accountId !== msg.cfg.accountId ||
          previous.namespaceId !== msg.cfg.namespaceId)
      ) {
        await setLocked()
      }
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
        if (
          snapshot.cookies.length === 0 &&
          Object.keys(snapshot.localStorage).length === 0
        ) {
          throw new Error(
            "Nothing to save: the current tab has no cookies or localStorage. Make sure the page has finished loading and you are signed in."
          )
        }
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
          if (result.conflictResolution === "cancel") {
            return { ok: true, kind: "cancelled" }
          }
          await setActiveAccount(msg.domain, msg.toId)
          const toLabel = result.toAccount.label
          const sourceTab = await chrome.tabs.get(msg.tabId)
          const sourceOrigin =
            typeof sourceTab.url === "string" ? getOrigin(sourceTab.url) : null
          const otherTabs =
            sourceOrigin === null
              ? []
              : (await findSameDomainTabs(msg.domain)).filter(
                  (tab) => tab.id !== msg.tabId
                )
          const syncedTabCount =
            sourceOrigin === null
              ? 0
              : await syncOtherTabs(
                  otherTabs,
                  sourceOrigin,
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

const READ_ONLY_TYPES: ReadonlySet<UiMsg["type"]> = new Set([
  "STATUS",
  "GET_CF_CONFIG",
  "LIST_ALL",
  "LIST_ACCOUNTS",
  "GET_LOCK_POLICY"
])

async function broadcast(msg: BroadcastMsg): Promise<void> {
  try {
    await chrome.runtime.sendMessage(msg)
  } catch {
    // No extension pages open to receive the broadcast.
  }
}

chrome.runtime.onMessage.addListener((msg: UiMsg, _sender, sendResponse) => {
  handle(msg)
    .then((response) => {
      sendResponse(response)
      if (response.ok && !READ_ONLY_TYPES.has(msg.type)) {
        void broadcast({ type: "VAULT_CHANGED" })
      }
    })
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
