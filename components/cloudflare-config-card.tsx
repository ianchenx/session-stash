import { ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { respError, send } from "~lib/messaging"
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

export function CloudflareConfigCard({ configured, onSaved }: Props) {
  const [accountId, setAccountId] = useState("")
  const [namespaceId, setNamespaceId] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setAccountId("")
    setNamespaceId("")
    setApiToken("")
  }, [configured])

  async function handleSave() {
    if (!accountId.trim() || !namespaceId.trim() || !apiToken.trim()) {
      toast.error("All three fields are required.")
      return
    }

    setBusy(true)
    const response = await send({
      type: "SET_CF_CONFIG",
      cfg: {
        accountId: accountId.trim(),
        namespaceId: namespaceId.trim(),
        apiToken: apiToken.trim()
      }
    })
    setBusy(false)

    const error = respError(response)
    if (error) {
      toast.error(error)
      return
    }

    toast.success("Cloudflare config saved.")
    setApiToken("")
    onSaved()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cloudflare KV</CardTitle>
        <CardDescription>
          Your sessions are encrypted locally and synced to your own KV namespace.{" "}
          <a
            href="https://developers.cloudflare.com/kv/api/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline underline-offset-4">
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cf-account-id">Account ID</FieldLabel>
            <PasswordInput
              id="cf-account-id"
              placeholder="e.g. 5a7f8d0c1b3e4a6d8f0c1b3e4a6d8f0c"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
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
              value={namespaceId}
              onChange={(event) => setNamespaceId(event.target.value)}
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
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
            />
            <FieldDescription>
              Use <strong>My Profile → API Tokens</strong> to create a token limited
              to <em>Workers KV Storage: Edit</em> on that namespace only.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-between">
        <p className="text-xs text-muted-foreground">
          {configured
            ? "A config is already saved. Fill in and Save to replace it."
            : "No config yet — fill in all three fields."}
        </p>
        <Button onClick={handleSave} disabled={busy}>
          {configured ? "Replace" : "Save"}
        </Button>
      </CardFooter>
    </Card>
  )
}
