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

  ;(globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    runtime: {
      onMessage: {
        addListener(callback: Listener) {
          listener = callback
        }
      }
    },
    action: {
      setBadgeText,
      setBadgeBackgroundColor
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
    setBadgeBackgroundColor
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
      saveAsNewAccount: vi.fn(async () => "new-id"),
      switchAccount: vi.fn(async () => ({
        pushedFrom: false,
        newFromVersion: null
      }))
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
