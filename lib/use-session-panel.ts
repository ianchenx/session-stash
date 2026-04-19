import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { getETLDPlusOne } from "./domain"
import type { VaultStatus } from "./messages"
import { respError, send } from "./messaging"
import type { ConflictInfo, ConflictResolution, IndexEntry } from "./types"

export type Tab = {
  id: number | null
  url: string | null
  domain: string | null
}

export type PendingConflict = {
  info: ConflictInfo
  retry: (resolution: ConflictResolution) => Promise<void>
}

export type PanelState = ReturnType<typeof useSessionPanel>

export function useSessionPanel() {
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [accounts, setAccounts] = useState<IndexEntry[]>([])
  const [activeByDomain, setActiveByDomain] = useState<Record<string, string>>(
    {}
  )
  const [tab, setTab] = useState<Tab>({ id: null, url: null, domain: null })
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [conflict, setConflict] = useState<PendingConflict | null>(null)

  const selectedInitialized = useRef(false)

  const refreshTab = useCallback(async () => {
    const [current] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })
    const nextTab: Tab = {
      id: current?.id ?? null,
      url: current?.url ?? null,
      domain: current?.url ? getETLDPlusOne(current.url) : null
    }
    setTab(nextTab)
    return nextTab
  }, [])

  const refreshStatus = useCallback(async () => {
    const response = await send({ type: "STATUS" })
    if (response.ok && "kind" in response && response.kind === "status") {
      setStatus({
        cfConfigured: response.cfConfigured,
        initialized: response.initialized,
        unlocked: response.unlocked,
        lockPolicy: response.lockPolicy
      })
      return {
        cfConfigured: response.cfConfigured,
        initialized: response.initialized,
        unlocked: response.unlocked
      }
    }
    return null
  }, [])

  const refreshAccounts = useCallback(async () => {
    const response = await send({ type: "LIST_ALL" })
    if (response.ok && "kind" in response && response.kind === "all-accounts") {
      setAccounts(response.entries)
      setActiveByDomain(response.activeByDomain)
    }
  }, [])

  const refresh = useCallback(async () => {
    const [, nextTab, nextStatus] = await Promise.all([
      refreshAccounts().catch(() => undefined),
      refreshTab(),
      refreshStatus()
    ])
    if (!nextStatus?.unlocked) {
      setAccounts([])
      setActiveByDomain({})
    }
    return { tab: nextTab, status: nextStatus }
  }, [refreshAccounts, refreshStatus, refreshTab])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const domains = useMemo(() => {
    const set = new Map<string, number>()
    for (const account of accounts) {
      set.set(account.domain, (set.get(account.domain) ?? 0) + 1)
    }
    if (tab.domain && !set.has(tab.domain)) {
      set.set(tab.domain, 0)
    }
    return Array.from(set.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => a.domain.localeCompare(b.domain))
  }, [accounts, tab.domain])

  useEffect(() => {
    if (!status?.unlocked) {
      selectedInitialized.current = false
      return
    }
    if (selectedInitialized.current) {
      return
    }
    setSelectedDomain(tab.domain ?? null)
    selectedInitialized.current = true
  }, [status?.unlocked, tab.domain])

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => account.domain === selectedDomain),
    [accounts, selectedDomain]
  )

  const activeIdForSelected = selectedDomain
    ? activeByDomain[selectedDomain] ?? null
    : null

  const unlock = useCallback(
    async (password: string) => {
      const response = await send({ type: "UNLOCK", password })
      const error = respError(response)
      if (error) {
        throw new Error(error)
      }
      await refresh()
    },
    [refresh]
  )

  const lock = useCallback(async () => {
    const response = await send({ type: "LOCK" })
    const error = respError(response)
    if (error) {
      throw new Error(error)
    }
    await refresh()
  }, [refresh])

  const saveCurrentAsNew = useCallback(
    async (label: string) => {
      if (!tab.id || !tab.domain) {
        throw new Error("No supported domain in the active tab.")
      }
      const response = await send({
        type: "SAVE_NEW",
        domain: tab.domain,
        label: label.trim(),
        tabId: tab.id
      })
      const error = respError(response)
      if (error) {
        throw new Error(error)
      }
      setSelectedDomain(tab.domain)
      await refresh()
    },
    [refresh, tab]
  )

  const doSwitch = useCallback(
    async (
      toId: string,
      opts?: {
        localFromVersion?: number
        resolution?: ConflictResolution
      }
    ) => {
      if (!tab.id || !tab.domain) {
        throw new Error("No supported domain in the active tab.")
      }
      const activeId = activeByDomain[tab.domain] ?? null
      const response = await send({
        type: "SWITCH",
        domain: tab.domain,
        fromId: activeId,
        toId,
        tabId: tab.id,
        localFromVersion: opts?.localFromVersion,
        resolution: opts?.resolution
      })

      if (response.ok && "kind" in response && response.kind === "conflict") {
        const info = response.info
        return new Promise<void>((resolve, reject) => {
          setConflict({
            info,
            retry: async (resolution) => {
              setConflict(null)
              try {
                await doSwitch(toId, {
                  localFromVersion: info.localVersion,
                  resolution
                })
                resolve()
              } catch (error) {
                reject(error)
              }
            }
          })
        })
      }

      const error = respError(response)
      if (error) {
        throw new Error(error)
      }
      if (response.ok && "kind" in response && response.kind === "switched") {
        if (response.syncedTabCount > 0) {
          const suffix = response.syncedTabCount > 1 ? "tabs" : "tab"
          toast.info(`Synced ${response.syncedTabCount} other ${suffix}.`)
        }
      }
      await refresh()
    },
    [activeByDomain, refresh, tab]
  )

  const rename = useCallback(
    async (accountId: string, label: string) => {
      const response = await send({ type: "RENAME", accountId, label })
      const error = respError(response)
      if (error) {
        throw new Error(error)
      }
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (accountId: string) => {
      if (!tab.id) {
        throw new Error("No active tab.")
      }
      const response = await send({
        type: "DELETE",
        accountId,
        tabId: tab.id
      })
      const error = respError(response)
      if (error) {
        throw new Error(error)
      }
      await refresh()
    },
    [refresh, tab]
  )

  const pushCurrent = useCallback(
    async (accountId: string) => {
      if (!tab.id) {
        throw new Error("No active tab.")
      }
      const response = await send({
        type: "OVERWRITE",
        accountId,
        tabId: tab.id
      })
      const error = respError(response)
      if (error) {
        throw new Error(error)
      }
      await refresh()
    },
    [refresh, tab]
  )

  const wipeCurrent = useCallback(async () => {
    if (!tab.id || !tab.domain) {
      throw new Error("No supported domain in the active tab.")
    }
    const response = await send({
      type: "WIPE_CURRENT",
      domain: tab.domain,
      tabId: tab.id
    })
    const error = respError(response)
    if (error) {
      throw new Error(error)
    }
    await refresh()
  }, [refresh, tab])

  return {
    status,
    tab,
    accounts,
    activeByDomain,
    domains,
    selectedDomain,
    setSelectedDomain,
    selectedAccounts,
    activeIdForSelected,
    conflict,
    dismissConflict: () => setConflict(null),
    refresh,
    unlock,
    lock,
    saveCurrentAsNew,
    doSwitch,
    rename,
    remove,
    pushCurrent,
    wipeCurrent
  }
}
