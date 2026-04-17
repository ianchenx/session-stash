import { useEffect, useState } from "react"

import type { UiMsg, UiResp } from "./lib/messages"
import type { IndexEntry } from "./lib/types"
import { getETLDPlusOne } from "./lib/domain"

async function send(msg: UiMsg): Promise<UiResp> {
  return (await chrome.runtime.sendMessage(msg)) as UiResp
}

function IndexPopup() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<IndexEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    unlocked: boolean
    cfConfigured: boolean
    initialized: boolean
  } | null>(null)
  const [newLabel, setNewLabel] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setError("")
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })
    setTab(currentTab ?? null)
    const currentDomain = currentTab?.url ? getETLDPlusOne(currentTab.url) : null
    setDomain(currentDomain)

    const statusResponse = await send({ type: "STATUS" })
    if ("kind" in statusResponse && statusResponse.kind === "status") {
      setStatus({
        unlocked: statusResponse.unlocked,
        cfConfigured: statusResponse.cfConfigured,
        initialized: statusResponse.initialized
      })
    }

    if (
      currentDomain &&
      "kind" in statusResponse &&
      statusResponse.kind === "status" &&
      statusResponse.unlocked
    ) {
      const response = await send({ type: "LIST_ACCOUNTS", domain: currentDomain })
      if ("kind" in response && response.kind === "accounts") {
        setAccounts(response.entries)
        setActiveId(response.activeId)
      } else if ("error" in response) {
        setError(response.error)
      }
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function doSave() {
    if (!tab?.id || !domain || !newLabel.trim()) {
      return
    }

    setBusy(true)
    setError("")
    const response = await send({
      type: "SAVE_NEW",
      domain,
      label: newLabel.trim(),
      tabId: tab.id
    })
    setBusy(false)
    if ("error" in response) {
      setError(response.error)
    } else {
      setNewLabel("")
      await refresh()
    }
  }

  async function doSwitch(toId: string) {
    if (!tab?.id || !domain) {
      return
    }

    setBusy(true)
    setError("")
    const response = await send({
      type: "SWITCH",
      domain,
      fromId: activeId,
      toId,
      tabId: tab.id
    })

    if ("kind" in response && response.kind === "conflict") {
      const choice = prompt(
        `Remote version ${response.info.remoteVersion} is newer than local ${response.info.localVersion} for account ${response.info.accountId}.\nType: overwrite / discard / cancel`,
        "cancel"
      ) as "overwrite" | "discard" | "cancel" | null

      if (choice && choice !== "cancel") {
        const retry = await send({
          type: "SWITCH",
          domain,
          fromId: activeId,
          toId,
          tabId: tab.id,
          localFromVersion: response.info.localVersion,
          resolution: choice
        })
        if ("error" in retry) {
          setError(retry.error)
        }
      }
    } else if ("error" in response) {
      setError(response.error)
    }

    setBusy(false)
    await refresh()
  }

  async function doDelete(id: string) {
    if (!tab?.id) {
      return
    }
    if (!confirm("Delete this account from cloud and local?")) {
      return
    }

    setBusy(true)
    setError("")
    const response = await send({ type: "DELETE", accountId: id, tabId: tab.id })
    setBusy(false)
    if ("error" in response) {
      setError(response.error)
    } else {
      await refresh()
    }
  }

  async function doOverwrite(id: string) {
    if (!tab?.id) {
      return
    }
    if (!confirm("Overwrite the cloud version with current session?")) {
      return
    }

    setBusy(true)
    setError("")
    const response = await send({ type: "OVERWRITE", accountId: id, tabId: tab.id })
    setBusy(false)
    if ("error" in response) {
      setError(response.error)
    } else {
      await refresh()
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage()
  }

  const needsSetup =
    !status?.cfConfigured || !status?.initialized || !status?.unlocked

  return (
    <div style={{ fontFamily: "system-ui", padding: 14, width: 320 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
        <strong>Session Stash</strong>
        <button onClick={openOptions} style={{ fontSize: 12 }}>
          Settings
        </button>
      </div>

      {needsSetup && (
        <div style={{ marginTop: 12, color: "#b91c1c" }}>
          {!status?.cfConfigured && <p>- Configure Cloudflare in Settings</p>}
          {status?.cfConfigured && !status.initialized && (
            <p>- Initialize master password in Settings</p>
          )}
          {status?.initialized && !status.unlocked && (
            <p>- Unlock with master password in Settings</p>
          )}
        </div>
      )}

      {!needsSetup && !domain && (
        <p style={{ marginTop: 12, color: "#64748b" }}>
          Unsupported tab (localhost/IP/extension page).
        </p>
      )}

      {!needsSetup && domain && (
        <>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 10 }}>
            Domain: {domain}
          </p>

          <div style={{ marginTop: 8 }}>
            {accounts.length === 0 && (
              <p style={{ color: "#64748b" }}>No saved accounts for this domain.</p>
            )}
            {accounts.map((account) => (
              <div
                key={account.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: 6,
                  marginBottom: 4,
                  background: account.id === activeId ? "#dbeafe" : "#f1f5f9"
                }}>
                <span style={{ flex: 1 }}>
                  {account.label}
                  {account.id === activeId && " (active)"}
                </span>
                {account.id !== activeId && (
                  <button
                    disabled={busy}
                    onClick={() => doSwitch(account.id)}
                    style={{ marginLeft: 4 }}>
                    Switch
                  </button>
                )}
                {account.id === activeId && (
                  <button
                    disabled={busy}
                    onClick={() => doOverwrite(account.id)}
                    style={{ marginLeft: 4 }}>
                    Push
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => doDelete(account.id)}
                  style={{ marginLeft: 4 }}>
                  x
                </button>
              </div>
            ))}
          </div>

          <hr style={{ margin: "12px 0" }} />

          <div>
            <input
              placeholder="New account label"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              style={{ width: "60%", marginRight: 6 }}
            />
            <button disabled={busy || !newLabel.trim()} onClick={doSave}>
              Save current
            </button>
          </div>
        </>
      )}

      {error && (
        <p style={{ color: "#b91c1c", marginTop: 10, fontSize: 12 }}>
          Error: {error}
        </p>
      )}
    </div>
  )
}

export default IndexPopup
