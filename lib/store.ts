import type { CfConfig } from "./types"

const ACTIVE_KEY = "activeAccount"
const CF_CONFIG_KEY = "cfConfig"

type ActiveMap = Record<string, string>

export async function getActiveAccount(domain: string): Promise<string | null> {
  const result = await chrome.storage.local.get(ACTIVE_KEY)
  const map = (result[ACTIVE_KEY] as ActiveMap | undefined) ?? {}
  return map[domain] ?? null
}

export async function getAllActiveAccounts(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(ACTIVE_KEY)
  return { ...((result[ACTIVE_KEY] as ActiveMap | undefined) ?? {}) }
}

export async function setActiveAccount(
  domain: string,
  accountId: string | null
): Promise<void> {
  const result = await chrome.storage.local.get(ACTIVE_KEY)
  const map: ActiveMap = {
    ...((result[ACTIVE_KEY] as ActiveMap | undefined) ?? {})
  }

  if (accountId === null) {
    delete map[domain]
  } else {
    map[domain] = accountId
  }

  await chrome.storage.local.set({ [ACTIVE_KEY]: map })
}

export async function getCfConfig(): Promise<CfConfig | null> {
  const result = await chrome.storage.local.get(CF_CONFIG_KEY)
  return (result[CF_CONFIG_KEY] as CfConfig | undefined) ?? null
}

export async function setCfConfig(config: CfConfig): Promise<void> {
  await chrome.storage.local.set({ [CF_CONFIG_KEY]: config })
}

export async function wipe(): Promise<void> {
  await chrome.storage.local.remove([ACTIVE_KEY, CF_CONFIG_KEY])
}
