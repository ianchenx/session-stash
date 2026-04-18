// Injected via Playwright addInitScript — runs before the extension bundle in
// every frame of the target page. Provides just enough of chrome.* for the
// popup / sidepanel / options React shells to render a populated, unlocked
// state. Read via window.__SCREENSHOT_FIXTURE__ which the harness sets on
// the query string (#scenario=<name>).

(() => {
  const url = new URL(location.href)
  const scenario = url.searchParams.get("scenario") || "popup"

  const NOW = Date.UTC(2026, 3, 18, 4, 0, 0) // fixed so "updated 2h ago" is stable

  const LOCK_POLICY = { kind: "timeout", minutes: 15 }

  const CHATGPT_ACCOUNTS = [
    {
      id: "acc-gpt-personal",
      domain: "chatgpt.com",
      label: "Personal",
      version: 9,
      updatedAt: NOW - 1000 * 60 * 18
    },
    {
      id: "acc-gpt-work",
      domain: "chatgpt.com",
      label: "Work · acme-corp",
      version: 4,
      updatedAt: NOW - 1000 * 60 * 60 * 3
    },
    {
      id: "acc-gpt-research",
      domain: "chatgpt.com",
      label: "Research sandbox",
      version: 2,
      updatedAt: NOW - 1000 * 60 * 60 * 24 * 2
    }
  ]

  const SITE_LIST_ACCOUNTS = [
    ...CHATGPT_ACCOUNTS,
    { id: "acc-claude-1", domain: "claude.ai", label: "Primary", version: 12, updatedAt: NOW - 1000 * 60 * 45 },
    { id: "acc-claude-2", domain: "claude.ai", label: "Max plan", version: 5, updatedAt: NOW - 1000 * 60 * 60 * 30 },
    { id: "acc-gh-work", domain: "github.com", label: "Work · acme-corp", version: 7, updatedAt: NOW - 1000 * 60 * 42 },
    { id: "acc-gh-personal", domain: "github.com", label: "Personal", version: 3, updatedAt: NOW - 1000 * 60 * 60 * 6 },
    { id: "acc-linear-1", domain: "linear.app", label: "Acme", version: 8, updatedAt: NOW - 1000 * 60 * 60 * 2 },
    { id: "acc-vercel-1", domain: "vercel.com", label: "Team", version: 6, updatedAt: NOW - 1000 * 60 * 60 * 9 },
    { id: "acc-figma-1", domain: "figma.com", label: "Design org", version: 4, updatedAt: NOW - 1000 * 60 * 60 * 24 },
    { id: "acc-notion-1", domain: "notion.so", label: "Work", version: 11, updatedAt: NOW - 1000 * 60 * 25 },
    { id: "acc-notion-2", domain: "notion.so", label: "Personal", version: 2, updatedAt: NOW - 1000 * 60 * 60 * 72 },
    { id: "acc-x-1", domain: "x.com", label: "@ianwrites", version: 4, updatedAt: NOW - 1000 * 60 * 60 * 18 },
    { id: "acc-gmail-1", domain: "mail.google.com", label: "Work", version: 6, updatedAt: NOW - 1000 * 60 * 55 },
    { id: "acc-gmail-2", domain: "mail.google.com", label: "Personal", version: 2, updatedAt: NOW - 1000 * 60 * 60 * 22 },
    { id: "acc-stripe-1", domain: "stripe.com", label: "Acme live", version: 3, updatedAt: NOW - 1000 * 60 * 60 * 5 }
  ]

  const FIXTURES = {
    popup: {
      tab: { id: 1, url: "https://chatgpt.com/" },
      status: { cfConfigured: true, initialized: true, unlocked: true },
      accounts: CHATGPT_ACCOUNTS,
      activeByDomain: { "chatgpt.com": "acc-gpt-personal" }
    },
    sidepanel: {
      tab: { id: 1, url: "chrome://newtab/" },
      status: { cfConfigured: true, initialized: true, unlocked: true },
      accounts: SITE_LIST_ACCOUNTS,
      activeByDomain: {
        "chatgpt.com": "acc-gpt-personal",
        "claude.ai": "acc-claude-1",
        "github.com": "acc-gh-work",
        "linear.app": "acc-linear-1",
        "vercel.com": "acc-vercel-1",
        "figma.com": "acc-figma-1",
        "notion.so": "acc-notion-1",
        "x.com": "acc-x-1",
        "mail.google.com": "acc-gmail-1",
        "stripe.com": "acc-stripe-1"
      }
    },
    options: {
      tab: { id: 1, url: "https://github.com/" },
      status: { cfConfigured: true, initialized: true, unlocked: true },
      accounts: [],
      activeByDomain: {},
      cfConfig: {
        accountId: "5a7f8d0c1b3e4a6d8f0c1b3e4a6d8f0c",
        namespaceId: "9b2c4d6e8f0a1b3c5d7e9f0a1b3c5d7e",
        apiToken: "cf_pat_" + "x".repeat(32)
      }
    }
  }

  const fx = FIXTURES[scenario] || FIXTURES.popup

  function reply(msg) {
    switch (msg?.type) {
      case "STATUS":
        return {
          ok: true,
          kind: "status",
          cfConfigured: fx.status.cfConfigured,
          initialized: fx.status.initialized,
          unlocked: fx.status.unlocked,
          lockPolicy: LOCK_POLICY
        }
      case "LIST_ALL":
        return {
          ok: true,
          kind: "all-accounts",
          entries: fx.accounts,
          activeByDomain: fx.activeByDomain
        }
      case "LIST_ACCOUNTS":
        return {
          ok: true,
          kind: "accounts",
          entries: fx.accounts.filter((a) => a.domain === msg.domain),
          activeId: fx.activeByDomain[msg.domain] ?? null
        }
      case "GET_CF_CONFIG":
        return { ok: true, kind: "cf-config", config: fx.cfConfig ?? null }
      case "GET_LOCK_POLICY":
        return { ok: true, kind: "lock-policy", policy: LOCK_POLICY }
      default:
        return { ok: true }
    }
  }

  const RUNTIME_ID = "screenshot-harness"

  const chromeStub = {
    runtime: {
      id: RUNTIME_ID,
      sendMessage(msg) {
        return Promise.resolve(reply(msg))
      },
      openOptionsPage() {},
      getURL(path) {
        return `chrome-extension://${RUNTIME_ID}/${path.replace(/^\//, "")}`
      },
      onMessage: { addListener() {}, removeListener() {} }
    },
    tabs: {
      query() {
        return Promise.resolve([{ id: fx.tab.id, url: fx.tab.url, windowId: 1 }])
      },
      create(info) {
        return Promise.resolve({ id: 2, ...info })
      },
      onActivated: { addListener() {}, removeListener() {} },
      onUpdated: { addListener() {}, removeListener() {} }
    },
    sidePanel: {
      open() {
        return Promise.resolve()
      }
    },
    storage: {
      local: {
        get() { return Promise.resolve({}) },
        set() { return Promise.resolve() },
        remove() { return Promise.resolve() }
      },
      session: {
        get() { return Promise.resolve({}) },
        set() { return Promise.resolve() },
        remove() { return Promise.resolve() }
      }
    },
    alarms: {
      create() {},
      clear() { return Promise.resolve(true) }
    }
  }

  // chrome global — guard against assignment failing if it's already defined by
  // the real runtime (not the case under http://, but cheap insurance).
  try {
    Object.defineProperty(window, "chrome", {
      value: chromeStub,
      configurable: true,
      writable: true
    })
  } catch {
    window.chrome = chromeStub
  }

  // Favicons are fetched via chrome-extension://<id>/_favicon/?pageUrl=…, which
  // fails outside a real extension. Rewrite to a public favicon service so each
  // site's brand mark shows up. Google's s2 endpoint renders the sharpest color
  // marks for well-known domains; request 64px so retina downscaling is clean.
  const origDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "src"
  )
  if (origDescriptor?.set && origDescriptor?.get) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      enumerable: true,
      get() {
        return origDescriptor.get.call(this)
      },
      set(value) {
        if (typeof value === "string" && value.includes("chrome-extension://")) {
          try {
            const parsed = new URL(value)
            const pageUrl = parsed.searchParams.get("pageUrl")
            if (pageUrl) {
              const domain = new URL(pageUrl).hostname
              value = `https://icons.duckduckgo.com/ip3/${domain}.ico`
            }
          } catch {
            /* ignore */
          }
        }
        origDescriptor.set.call(this, value)
      }
    })
  }

  // Expose the fixture so the capture script can nudge internal state if
  // needed (e.g. drill into the accounts view).
  window.__SCREENSHOT_FIXTURE__ = fx
})()
