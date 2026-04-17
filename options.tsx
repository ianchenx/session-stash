import { useEffect, useState } from "react"

import type { UiMsg, UiResp } from "./lib/messages"

async function send(msg: UiMsg): Promise<UiResp> {
  return (await chrome.runtime.sendMessage(msg)) as UiResp
}

function Options() {
  const [accountId, setAccountId] = useState("")
  const [namespaceId, setNamespaceId] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [status, setStatus] = useState<{
    initialized: boolean
    unlocked: boolean
    cfConfigured: boolean
  } | null>(null)
  const [message, setMessage] = useState("")

  async function refresh() {
    const response = await send({ type: "STATUS" })
    if ("kind" in response && response.kind === "status") {
      setStatus({
        initialized: response.initialized,
        unlocked: response.unlocked,
        cfConfigured: response.cfConfigured
      })
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function saveCf() {
    setMessage("")
    const response = await send({
      type: "SET_CF_CONFIG",
      cfg: { accountId, namespaceId, apiToken }
    })
    if ("error" in response) {
      setMessage(response.error)
    } else {
      setMessage("Cloudflare config saved.")
      await refresh()
    }
  }

  async function initPassword() {
    setMessage("")
    if (password !== passwordConfirm) {
      setMessage("passwords do not match")
      return
    }
    if (password.length < 12) {
      setMessage("password too short (min 12 chars)")
      return
    }

    const response = await send({ type: "INIT_META", password })
    if ("error" in response) {
      setMessage(response.error)
    } else {
      setMessage("Initialized.")
      await refresh()
    }
  }

  async function unlockNow() {
    setMessage("")
    const response = await send({ type: "UNLOCK", password })
    if ("error" in response) {
      setMessage(response.error)
    } else {
      setMessage("Unlocked.")
      setPassword("")
      await refresh()
    }
  }

  async function lockNow() {
    await send({ type: "LOCK" })
    await refresh()
    setMessage("Locked.")
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 560 }}>
      <h1>Session Stash - Settings</h1>

      <section>
        <h2>Cloudflare KV</h2>
        <p>Create a scoped API token limited to your KV namespace (Read + Write).</p>
        <label>
          Account ID
          <br />
          <input
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <br />
        <br />
        <label>
          Namespace ID
          <br />
          <input
            value={namespaceId}
            onChange={(event) => setNamespaceId(event.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <br />
        <br />
        <label>
          API Token
          <br />
          <input
            type="password"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <br />
        <br />
        <button onClick={saveCf}>Save CF config</button>
      </section>

      <section>
        <h2>Master Password</h2>
        <p style={{ color: "#b91c1c" }}>
          <strong>Warning:</strong> If you forget your master password, all stored
          sessions become permanently unreadable. There is no recovery mechanism.
        </p>

        {status && !status.initialized && (
          <>
            <label>
              New password
              <br />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ width: "100%" }}
              />
            </label>
            <br />
            <br />
            <label>
              Confirm
              <br />
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                style={{ width: "100%" }}
              />
            </label>
            <br />
            <br />
            <button onClick={initPassword}>Initialize</button>
          </>
        )}

        {status && status.initialized && !status.unlocked && (
          <>
            <label>
              Password
              <br />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ width: "100%" }}
              />
            </label>
            <br />
            <br />
            <button onClick={unlockNow}>Unlock</button>
          </>
        )}

        {status?.unlocked && (
          <>
            <p>
              Status: <strong>Unlocked</strong>
            </p>
            <button onClick={lockNow}>Lock now</button>
          </>
        )}
      </section>

      {message && <p style={{ marginTop: 16, color: "#1d4ed8" }}>{message}</p>}

      <hr style={{ marginTop: 24 }} />
      <p style={{ fontSize: 12, color: "#64748b" }}>
        CF config: {status?.cfConfigured ? "✓" : "-"}&nbsp;&nbsp; Initialized:{" "}
        {status?.initialized ? "✓" : "-"}&nbsp;&nbsp; Unlocked:{" "}
        {status?.unlocked ? "✓" : "-"}
      </p>
    </div>
  )
}

export default Options
