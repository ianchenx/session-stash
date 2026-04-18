import { ExternalLink, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { respError, send } from "~lib/messaging"
import type { CfConfig } from "~lib/types"
import { Button } from "~components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "~components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~components/ui/field"
import { PasswordInput } from "~components/password-input"

type Props = {
  configured: boolean
  onSaved: () => void
}

const EMPTY: CfConfig = { accountId: "", namespaceId: "", apiToken: "" }

export function CloudflareConfigCard({ configured, onSaved }: Props) {
  const [saved, setSaved] = useState<CfConfig | null>(null)
  const [form, setForm] = useState<CfConfig>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadSaved = useCallback(async () => {
    setLoading(true)
    const response = await send({ type: "GET_CF_CONFIG" })
    setLoading(false)
    if (response.ok && "kind" in response && response.kind === "cf-config") {
      const config = response.config
      setSaved(config)
      setForm(config ?? EMPTY)
      return
    }
    setSaved(null)
    setForm(EMPTY)
  }, [])

  useEffect(() => {
    void loadSaved()
  }, [loadSaved, configured])

  const isDirty =
    form.accountId !== (saved?.accountId ?? "") ||
    form.namespaceId !== (saved?.namespaceId ?? "") ||
    form.apiToken !== (saved?.apiToken ?? "")

  function update<K extends keyof CfConfig>(key: K, value: CfConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    const trimmed: CfConfig = {
      accountId: form.accountId.trim(),
      namespaceId: form.namespaceId.trim(),
      apiToken: form.apiToken.trim()
    }
    if (!trimmed.accountId || !trimmed.namespaceId || !trimmed.apiToken) {
      toast.error("All three fields are required.")
      return
    }

    setBusy(true)
    const response = await send({ type: "SET_CF_CONFIG", cfg: trimmed })
    setBusy(false)

    const error = respError(response)
    if (error) {
      toast.error(error)
      return
    }

    toast.success("Cloudflare config saved.")
    setSaved(trimmed)
    setForm(trimmed)
    onSaved()
  }

  function handleReset() {
    setForm(saved ?? EMPTY)
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Cloudflare KV</CardTitle>
        <CardDescription className="text-xs">
          Encrypted locally, synced to your own KV namespace.{" "}
          <a
            href="https://developers.cloudflare.com/kv/api/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline underline-offset-4">
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cf-account-id">Account ID</FieldLabel>
            <PasswordInput
              id="cf-account-id"
              placeholder="e.g. 5a7f8d0c1b3e4a6d8f0c1b3e4a6d8f0c"
              value={form.accountId}
              onChange={(event) => update("accountId", event.target.value)}
              disabled={loading}
            />
            <FieldDescription>
              Find it in your Cloudflare dashboard URL or Account Home sidebar.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="cf-namespace-id">Namespace ID</FieldLabel>
            <PasswordInput
              id="cf-namespace-id"
              placeholder="KV → your namespace → API"
              value={form.namespaceId}
              onChange={(event) => update("namespaceId", event.target.value)}
              disabled={loading}
            />
            <FieldDescription>
              Create a dedicated KV namespace for session-stash.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="cf-api-token">API Token</FieldLabel>
            <PasswordInput
              id="cf-api-token"
              placeholder="Scoped token with KV Read + Write"
              value={form.apiToken}
              onChange={(event) => update("apiToken", event.target.value)}
              disabled={loading}
            />
            <FieldDescription>
              Use <strong>My Profile → API Tokens</strong> to create a token limited
              to <em>Workers KV Storage: Edit</em> on that namespace only. Click the
              eye icon above to reveal the value you have saved.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-between p-4 pt-3">
        <p className="text-xs text-muted-foreground">
          {loading
            ? "Loading saved config…"
            : configured
              ? isDirty
                ? "Unsaved changes."
                : "Matches the saved configuration."
              : "No config saved yet."}
        </p>
        <div className="flex gap-2">
          {configured && isDirty && (
            <Button variant="ghost" onClick={handleReset} disabled={busy}>
              <RotateCcw />
              Revert
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={busy || loading || !isDirty}>
            {configured ? "Save changes" : "Save"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
