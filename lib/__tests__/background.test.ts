import { beforeEach, describe, expect, it, vi } from "vitest"

const cfConfig = {
  accountId: "acc",
  namespaceId: "ns",
  apiToken: "token"
}

type Listener = Parameters<typeof chrome.runtime.onMessage.addListener>[0]

function mockChrome() {
  let listener: Listener | null = null
  const setBadgeText = vi.fn(async () => undefined)
  const setBadgeBackgroundColor = vi.fn(async () => undefined)
  const alarmsCreate = vi.fn()
  const alarmsClear = vi.fn(async () => true)
  const tabsQuery = vi.fn(async (_queryInfo?: chrome.tabs.QueryInfo) => [])
  const tabsGet = vi.fn(async (_tabId: number) => ({ id: 0, url: "" }))
  const tabsReload = vi.fn(async (_tabId?: number) => undefined)

  ;(globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    runtime: {
      onMessage: {
        addListener(callback: Listener) {
          listener = callback
        }
      },
      onStartup: {
        addListener: vi.fn()
      }
    },
    action: {
      setBadgeText,
      setBadgeBackgroundColor
    },
    tabs: {
      get: tabsGet,
      query: tabsQuery,
      reload: tabsReload
    },
    alarms: {
      create: alarmsCreate,
      clear: alarmsClear,
      onAlarm: { addListener: vi.fn() }
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined)
      },
      session: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined)
      }
    }
  } as unknown as typeof chrome

  return {
    getListener() {
      if (!listener) {
        throw new Error("background listener not registered")
      }
      return listener
    },
    setBadgeText,
    setBadgeBackgroundColor,
    tabsGet,
    tabsQuery,
    tabsReload,
    alarmsCreate,
    alarmsClear
  }
}

async function sendMessage(listener: Listener, msg: unknown) {
  return await new Promise<unknown>((resolve) => {
    listener(msg, {} as chrome.runtime.MessageSender, resolve)
  })
}

describe("background DELETE", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("clears active account state and badge when deleting the active account", async () => {
    const chromeApi = mockChrome()
    const key = {} as CryptoKey

    const getCfConfig = vi.fn(async () => cfConfig)
    const getActiveAccount = vi.fn(async (domain: string) =>
      domain === "x.com" ? "A" : null
    )
    const setActiveAccount = vi.fn(async () => undefined)
    const initializeMeta = vi.fn(async () => key)
    const loadIndex = vi.fn(async () => ({
      accounts: [
        {
          id: "A",
          domain: "x.com",
          label: "Alpha",
          version: 1,
          updatedAt: 1
        }
      ],
      updatedAt: 1
    }))
    const deleteAccountFlow = vi.fn(async () => undefined)

    vi.doMock("../store", () => ({
      getActiveAccount,
      getAllActiveAccounts: vi.fn(async () => ({})),
      getCfConfig,
      setActiveAccount,
      setCfConfig: vi.fn(async () => undefined)
    }))
    vi.doMock("../account", () => ({
      initializeMeta,
      isInitialized: vi.fn(async () => true),
      loadIndex,
      unlock: vi.fn(async () => key)
    }))
    vi.doMock("../switcher", () => ({
      deleteAccountFlow,
      overwriteWithCurrent: vi.fn(async () => undefined),
      renameAccount: vi.fn(async () => undefined),
      saveAsNewAccount: vi.fn(async () => "new-id"),
      switchAccount: vi.fn(async () => ({
        pushedFrom: false,
        newFromVersion: null
      }))
    }))
    vi.doMock("../session-lock", () => ({
      cancelAutoLock: vi.fn(async () => undefined),
      clearSessionKey: vi.fn(async () => undefined),
      getLockPolicy: vi.fn(async () => ({ kind: "timeout", minutes: 15 })),
      isLockAlarm: vi.fn(() => false),
      persistSessionKey: vi.fn(async () => undefined),
      restoreSessionKey: vi.fn(async () => null),
      scheduleAutoLock: vi.fn(async () => undefined),
      setLockPolicy: vi.fn(async () => undefined)
    }))

    await import("../../background")
    const listener = chromeApi.getListener()

    await sendMessage(listener, { type: "INIT_META", password: "pw" })
    const response = await sendMessage(listener, {
      type: "DELETE",
      accountId: "A",
      tabId: 7
    })

    expect(response).toEqual({ ok: true })
    expect(deleteAccountFlow).toHaveBeenCalledWith({
      client: expect.anything(),
      key,
      accountId: "A"
    })
    expect(loadIndex).toHaveBeenCalled()
    expect(getActiveAccount).toHaveBeenCalledWith("x.com")
    expect(setActiveAccount).toHaveBeenCalledWith("x.com", null)
    expect(chromeApi.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "" })
    expect(chromeApi.setBadgeBackgroundColor).not.toHaveBeenCalled()
  })
})

describe("background SWITCH", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("syncs other same-domain tabs and returns the synced count", async () => {
    const chromeApi = mockChrome()
    chromeApi.tabsGet.mockResolvedValue({
      id: 7,
      url: "https://github.com/inbox"
    })
    chromeApi.tabsQuery.mockResolvedValue([
      { id: 7, url: "https://github.com/inbox" },
      { id: 8, url: "https://gist.github.com/demo" },
      { id: 9, url: "https://github.com/settings" },
      { id: 10, url: "http://github.com/legacy" },
      { id: 11, url: "https://evil.com.example.net/path" },
      { id: 12, url: "https://github.com/private", incognito: true },
      { url: "https://github.com/missing-id" }
    ])

    const key = {} as CryptoKey
    const getCfConfig = vi.fn(async () => cfConfig)
    const setActiveAccount = vi.fn(async () => undefined)
    const initializeMeta = vi.fn(async () => key)
    const clearLocalStorage = vi.fn(async () => undefined)
    const injectLocalStorage = vi.fn(async () => undefined)
    const switchAccount = vi.fn(async () => ({
      pushedFrom: false,
      newFromVersion: null,
      conflictResolution: null,
      toAccount: {
        id: "to",
        domain: "github.com",
        label: "Bob",
        version: 1,
        updatedAt: 1,
        cookies: [],
        localStorage: { token: "bob" },
        criticalKeys: { cookies: [], localStorage: [] }
      }
    }))

    vi.doMock("../store", () => ({
      getActiveAccount: vi.fn(async () => "from"),
      getAllActiveAccounts: vi.fn(async () => ({})),
      getCfConfig,
      setActiveAccount,
      setCfConfig: vi.fn(async () => undefined)
    }))
    vi.doMock("../account", () => ({
      initializeMeta,
      isInitialized: vi.fn(async () => true),
      loadIndex: vi.fn(async () => ({ accounts: [], updatedAt: 1 })),
      unlock: vi.fn(async () => key)
    }))
    vi.doMock("../switcher", () => ({
      deleteAccountFlow: vi.fn(async () => undefined),
      overwriteWithCurrent: vi.fn(async () => undefined),
      renameAccount: vi.fn(async () => undefined),
      saveAsNewAccount: vi.fn(async () => "new-id"),
      switchAccount
    }))
    vi.doMock("../session", () => ({
      checkHealth: vi.fn(),
      clearCookies: vi.fn(async () => undefined),
      clearLocalStorage,
      injectCookies: vi.fn(async () => undefined),
      injectLocalStorage,
      snapshotCookies: vi.fn(async () => []),
      snapshotLocalStorage: vi.fn(async () => ({}))
    }))
    vi.doMock("../session-lock", () => ({
      cancelAutoLock: vi.fn(async () => undefined),
      clearSessionKey: vi.fn(async () => undefined),
      getLockPolicy: vi.fn(async () => ({ kind: "timeout", minutes: 15 })),
      isLockAlarm: vi.fn(() => false),
      persistSessionKey: vi.fn(async () => undefined),
      restoreSessionKey: vi.fn(async () => null),
      scheduleAutoLock: vi.fn(async () => undefined),
      setLockPolicy: vi.fn(async () => undefined)
    }))

    await import("../../background")
    const listener = chromeApi.getListener()

    await sendMessage(listener, { type: "INIT_META", password: "pw" })
    const response = await sendMessage(listener, {
      type: "SWITCH",
      domain: "github.com",
      fromId: "from",
      toId: "to",
      tabId: 7
    })

    expect(response).toEqual({
      ok: true,
      kind: "switched",
      pushedFrom: false,
      newFromVersion: null,
      syncedTabCount: 2
    })
    expect(chromeApi.tabsQuery).toHaveBeenCalledWith({
      url: ["https://*.github.com/*", "https://github.com/*"]
    })
    expect(clearLocalStorage).toHaveBeenCalledTimes(1)
    expect(clearLocalStorage).toHaveBeenCalledWith(9)
    expect(injectLocalStorage).toHaveBeenCalledTimes(1)
    expect(injectLocalStorage).toHaveBeenCalledWith(9, { token: "bob" })
    expect(chromeApi.tabsReload).toHaveBeenNthCalledWith(1, 8)
    expect(chromeApi.tabsReload).toHaveBeenNthCalledWith(2, 9)
    expect(setActiveAccount).toHaveBeenCalledWith("github.com", "to")
    expect(chromeApi.setBadgeText).toHaveBeenCalledWith({
      tabId: 7,
      text: "BO"
    })
    expect(chromeApi.setBadgeText).toHaveBeenCalledWith({
      tabId: 8,
      text: "BO"
    })
    expect(chromeApi.setBadgeText).toHaveBeenCalledWith({
      tabId: 9,
      text: "BO"
    })
  })

  it("keeps syncing later phases even if one tab fails earlier", async () => {
    const chromeApi = mockChrome()
    chromeApi.tabsGet.mockResolvedValue({
      id: 7,
      url: "https://github.com/inbox"
    })
    chromeApi.tabsQuery.mockResolvedValue([
      { id: 7, url: "https://github.com/inbox" },
      { id: 8, url: "https://github.com/one" },
      { id: 9, url: "https://github.com/two" }
    ])

    const key = {} as CryptoKey
    const clearLocalStorage = vi.fn(async (tabId: number) => {
      if (tabId === 8) {
        throw new Error("cannot clear")
      }
    })
    const injectLocalStorage = vi.fn(async () => undefined)

    vi.doMock("../store", () => ({
      getActiveAccount: vi.fn(async () => "from"),
      getAllActiveAccounts: vi.fn(async () => ({})),
      getCfConfig: vi.fn(async () => cfConfig),
      setActiveAccount: vi.fn(async () => undefined),
      setCfConfig: vi.fn(async () => undefined)
    }))
    vi.doMock("../account", () => ({
      initializeMeta: vi.fn(async () => key),
      isInitialized: vi.fn(async () => true),
      loadIndex: vi.fn(async () => ({ accounts: [], updatedAt: 1 })),
      unlock: vi.fn(async () => key)
    }))
    vi.doMock("../switcher", () => ({
      deleteAccountFlow: vi.fn(async () => undefined),
      overwriteWithCurrent: vi.fn(async () => undefined),
      renameAccount: vi.fn(async () => undefined),
      saveAsNewAccount: vi.fn(async () => "new-id"),
      switchAccount: vi.fn(async () => ({
        pushedFrom: false,
        newFromVersion: null,
        conflictResolution: null,
        toAccount: {
          id: "to",
          domain: "github.com",
          label: "Bob",
          version: 1,
          updatedAt: 1,
          cookies: [],
          localStorage: { token: "bob" },
          criticalKeys: { cookies: [], localStorage: [] }
        }
      }))
    }))
    vi.doMock("../session", () => ({
      checkHealth: vi.fn(),
      clearCookies: vi.fn(async () => undefined),
      clearLocalStorage,
      injectCookies: vi.fn(async () => undefined),
      injectLocalStorage,
      snapshotCookies: vi.fn(async () => []),
      snapshotLocalStorage: vi.fn(async () => ({}))
    }))
    vi.doMock("../session-lock", () => ({
      cancelAutoLock: vi.fn(async () => undefined),
      clearSessionKey: vi.fn(async () => undefined),
      getLockPolicy: vi.fn(async () => ({ kind: "timeout", minutes: 15 })),
      isLockAlarm: vi.fn(() => false),
      persistSessionKey: vi.fn(async () => undefined),
      restoreSessionKey: vi.fn(async () => null),
      scheduleAutoLock: vi.fn(async () => undefined),
      setLockPolicy: vi.fn(async () => undefined)
    }))

    await import("../../background")
    const listener = chromeApi.getListener()

    await sendMessage(listener, { type: "INIT_META", password: "pw" })
    const response = await sendMessage(listener, {
      type: "SWITCH",
      domain: "github.com",
      fromId: "from",
      toId: "to",
      tabId: 7
    })

    expect(response).toEqual({
      ok: true,
      kind: "switched",
      pushedFrom: false,
      newFromVersion: null,
      syncedTabCount: 1
    })
    expect(clearLocalStorage).toHaveBeenCalledTimes(2)
    expect(injectLocalStorage).toHaveBeenCalledTimes(1)
    expect(injectLocalStorage).toHaveBeenCalledWith(9, { token: "bob" })
    expect(chromeApi.tabsReload).toHaveBeenCalledTimes(1)
    expect(chromeApi.tabsReload).toHaveBeenCalledWith(9)
    expect(chromeApi.setBadgeText).not.toHaveBeenCalledWith({
      tabId: 8,
      text: "BO"
    })
  })

  it("returns kind:'cancelled' and skips side effects when user cancels conflict", async () => {
    const chromeApi = mockChrome()

    const key = {} as CryptoKey
    const setActiveAccount = vi.fn(async () => undefined)
    const switchAccount = vi.fn(async () => ({
      pushedFrom: false,
      newFromVersion: null,
      conflictResolution: "cancel" as const,
      toAccount: {
        id: "to",
        domain: "github.com",
        label: "Bob",
        version: 1,
        updatedAt: 1,
        cookies: [],
        localStorage: {},
        criticalKeys: { cookies: [], localStorage: [] }
      }
    }))

    vi.doMock("../store", () => ({
      getActiveAccount: vi.fn(async () => "from"),
      getAllActiveAccounts: vi.fn(async () => ({})),
      getCfConfig: vi.fn(async () => cfConfig),
      setActiveAccount,
      setCfConfig: vi.fn(async () => undefined)
    }))
    vi.doMock("../account", () => ({
      initializeMeta: vi.fn(async () => key),
      isInitialized: vi.fn(async () => true),
      loadIndex: vi.fn(async () => ({ accounts: [], updatedAt: 1 })),
      unlock: vi.fn(async () => key)
    }))
    vi.doMock("../switcher", () => ({
      deleteAccountFlow: vi.fn(async () => undefined),
      overwriteWithCurrent: vi.fn(async () => undefined),
      renameAccount: vi.fn(async () => undefined),
      saveAsNewAccount: vi.fn(async () => "new-id"),
      switchAccount
    }))
    vi.doMock("../session", () => ({
      checkHealth: vi.fn(),
      clearCookies: vi.fn(async () => undefined),
      clearLocalStorage: vi.fn(async () => undefined),
      injectCookies: vi.fn(async () => undefined),
      injectLocalStorage: vi.fn(async () => undefined),
      snapshotCookies: vi.fn(async () => []),
      snapshotLocalStorage: vi.fn(async () => ({}))
    }))
    vi.doMock("../session-lock", () => ({
      cancelAutoLock: vi.fn(async () => undefined),
      clearSessionKey: vi.fn(async () => undefined),
      getLockPolicy: vi.fn(async () => ({ kind: "timeout", minutes: 15 })),
      isLockAlarm: vi.fn(() => false),
      persistSessionKey: vi.fn(async () => undefined),
      restoreSessionKey: vi.fn(async () => null),
      scheduleAutoLock: vi.fn(async () => undefined),
      setLockPolicy: vi.fn(async () => undefined)
    }))

    await import("../../background")
    const listener = chromeApi.getListener()

    await sendMessage(listener, { type: "INIT_META", password: "pw" })
    const response = await sendMessage(listener, {
      type: "SWITCH",
      domain: "github.com",
      fromId: "from",
      toId: "to",
      tabId: 7,
      localFromVersion: 1,
      resolution: "cancel"
    })

    expect(response).toEqual({ ok: true, kind: "cancelled" })
    expect(setActiveAccount).not.toHaveBeenCalled()
    expect(chromeApi.tabsQuery).not.toHaveBeenCalled()
    expect(chromeApi.setBadgeText).not.toHaveBeenCalled()
  })
})

describe("background SAVE_NEW", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("rejects when tab has no cookies and no localStorage", async () => {
    const chromeApi = mockChrome()

    const key = {} as CryptoKey
    const saveAsNewAccount = vi.fn(async () => "new-id")

    vi.doMock("../store", () => ({
      getActiveAccount: vi.fn(async () => null),
      getAllActiveAccounts: vi.fn(async () => ({})),
      getCfConfig: vi.fn(async () => cfConfig),
      setActiveAccount: vi.fn(async () => undefined),
      setCfConfig: vi.fn(async () => undefined)
    }))
    vi.doMock("../account", () => ({
      initializeMeta: vi.fn(async () => key),
      isInitialized: vi.fn(async () => true),
      loadIndex: vi.fn(async () => ({ accounts: [], updatedAt: 1 })),
      unlock: vi.fn(async () => key)
    }))
    vi.doMock("../switcher", () => ({
      deleteAccountFlow: vi.fn(async () => undefined),
      overwriteWithCurrent: vi.fn(async () => undefined),
      renameAccount: vi.fn(async () => undefined),
      saveAsNewAccount,
      switchAccount: vi.fn()
    }))
    vi.doMock("../session", () => ({
      checkHealth: vi.fn(),
      clearCookies: vi.fn(async () => undefined),
      clearLocalStorage: vi.fn(async () => undefined),
      injectCookies: vi.fn(async () => undefined),
      injectLocalStorage: vi.fn(async () => undefined),
      snapshotCookies: vi.fn(async () => []),
      snapshotLocalStorage: vi.fn(async () => ({}))
    }))
    vi.doMock("../session-lock", () => ({
      cancelAutoLock: vi.fn(async () => undefined),
      clearSessionKey: vi.fn(async () => undefined),
      getLockPolicy: vi.fn(async () => ({ kind: "timeout", minutes: 15 })),
      isLockAlarm: vi.fn(() => false),
      persistSessionKey: vi.fn(async () => undefined),
      restoreSessionKey: vi.fn(async () => null),
      scheduleAutoLock: vi.fn(async () => undefined),
      setLockPolicy: vi.fn(async () => undefined)
    }))

    await import("../../background")
    const listener = chromeApi.getListener()

    await sendMessage(listener, { type: "INIT_META", password: "pw" })
    const response = await sendMessage(listener, {
      type: "SAVE_NEW",
      domain: "github.com",
      label: "Alice",
      tabId: 7
    })

    expect(response).toMatchObject({ ok: false })
    expect((response as { error: string }).error).toMatch(/Nothing to save/)
    expect(saveAsNewAccount).not.toHaveBeenCalled()
  })
})

describe("background SET_CF_CONFIG", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("locks the vault when accountId or namespaceId changes", async () => {
    const chromeApi = mockChrome()

    let currentCfg = { ...cfConfig }
    const getCfConfig = vi.fn(async () => currentCfg)
    const setCfConfig = vi.fn(async (c: typeof cfConfig) => {
      currentCfg = c
    })
    const clearSessionKey = vi.fn(async () => undefined)
    const key = {} as CryptoKey

    vi.doMock("../store", () => ({
      getActiveAccount: vi.fn(async () => null),
      getAllActiveAccounts: vi.fn(async () => ({})),
      getCfConfig,
      setActiveAccount: vi.fn(async () => undefined),
      setCfConfig
    }))
    vi.doMock("../account", () => ({
      initializeMeta: vi.fn(async () => key),
      isInitialized: vi.fn(async () => true),
      loadIndex: vi.fn(async () => ({ accounts: [], updatedAt: 1 })),
      unlock: vi.fn(async () => key)
    }))
    vi.doMock("../switcher", () => ({
      deleteAccountFlow: vi.fn(async () => undefined),
      overwriteWithCurrent: vi.fn(async () => undefined),
      renameAccount: vi.fn(async () => undefined),
      saveAsNewAccount: vi.fn(async () => "new-id"),
      switchAccount: vi.fn()
    }))
    vi.doMock("../session-lock", () => ({
      cancelAutoLock: vi.fn(async () => undefined),
      clearSessionKey,
      getLockPolicy: vi.fn(async () => ({ kind: "timeout", minutes: 15 })),
      isLockAlarm: vi.fn(() => false),
      persistSessionKey: vi.fn(async () => undefined),
      restoreSessionKey: vi.fn(async () => null),
      scheduleAutoLock: vi.fn(async () => undefined),
      setLockPolicy: vi.fn(async () => undefined)
    }))

    await import("../../background")
    const listener = chromeApi.getListener()

    await sendMessage(listener, { type: "INIT_META", password: "pw" })
    const before = (await sendMessage(listener, {
      type: "STATUS"
    })) as { unlocked: boolean }
    expect(before.unlocked).toBe(true)

    const response = await sendMessage(listener, {
      type: "SET_CF_CONFIG",
      cfg: { accountId: "acc", namespaceId: "ns-new", apiToken: "token" }
    })
    expect(response).toEqual({ ok: true })
    expect(setCfConfig).toHaveBeenCalled()
    expect(clearSessionKey).toHaveBeenCalled()

    const after = (await sendMessage(listener, {
      type: "STATUS"
    })) as { unlocked: boolean }
    expect(after.unlocked).toBe(false)
  })

  it("keeps vault unlocked when only apiToken changes", async () => {
    const chromeApi = mockChrome()

    let currentCfg = { ...cfConfig }
    const getCfConfig = vi.fn(async () => currentCfg)
    const setCfConfig = vi.fn(async (c: typeof cfConfig) => {
      currentCfg = c
    })
    const clearSessionKey = vi.fn(async () => undefined)
    const key = {} as CryptoKey

    vi.doMock("../store", () => ({
      getActiveAccount: vi.fn(async () => null),
      getAllActiveAccounts: vi.fn(async () => ({})),
      getCfConfig,
      setActiveAccount: vi.fn(async () => undefined),
      setCfConfig
    }))
    vi.doMock("../account", () => ({
      initializeMeta: vi.fn(async () => key),
      isInitialized: vi.fn(async () => true),
      loadIndex: vi.fn(async () => ({ accounts: [], updatedAt: 1 })),
      unlock: vi.fn(async () => key)
    }))
    vi.doMock("../switcher", () => ({
      deleteAccountFlow: vi.fn(async () => undefined),
      overwriteWithCurrent: vi.fn(async () => undefined),
      renameAccount: vi.fn(async () => undefined),
      saveAsNewAccount: vi.fn(async () => "new-id"),
      switchAccount: vi.fn()
    }))
    vi.doMock("../session-lock", () => ({
      cancelAutoLock: vi.fn(async () => undefined),
      clearSessionKey,
      getLockPolicy: vi.fn(async () => ({ kind: "timeout", minutes: 15 })),
      isLockAlarm: vi.fn(() => false),
      persistSessionKey: vi.fn(async () => undefined),
      restoreSessionKey: vi.fn(async () => null),
      scheduleAutoLock: vi.fn(async () => undefined),
      setLockPolicy: vi.fn(async () => undefined)
    }))

    await import("../../background")
    const listener = chromeApi.getListener()

    await sendMessage(listener, { type: "INIT_META", password: "pw" })
    const response = await sendMessage(listener, {
      type: "SET_CF_CONFIG",
      cfg: { accountId: "acc", namespaceId: "ns", apiToken: "token-rotated" }
    })
    expect(response).toEqual({ ok: true })
    expect(clearSessionKey).not.toHaveBeenCalled()

    const after = (await sendMessage(listener, {
      type: "STATUS"
    })) as { unlocked: boolean }
    expect(after.unlocked).toBe(true)
  })
})
