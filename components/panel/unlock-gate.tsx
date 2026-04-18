import { ArrowRight, KeyRound, Settings2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PasswordInput } from "~components/password-input"
import { Button } from "~components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "~components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "~components/ui/field"
import type { Status } from "~lib/use-session-panel"

type Props = {
  status: Status
  onUnlock: (password: string) => Promise<void>
  onOpenSettings: () => void
}

export function UnlockGate({ status, onUnlock, onOpenSettings }: Props) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  if (!status.cfConfigured) {
    return (
      <GateEmpty
        icon={<Settings2 className="h-5 w-5" />}
        title="Cloudflare not configured"
        description="Add your Cloudflare Account ID, KV namespace, and scoped API token to start syncing sessions."
        cta={{
          label: "Open settings",
          onClick: onOpenSettings
        }}
      />
    )
  }

  if (!status.initialized) {
    return (
      <GateEmpty
        icon={<KeyRound className="h-5 w-5" />}
        title="Initialize your vault"
        description="Choose a master password in settings. It derives the key that encrypts every session before it leaves your device."
        cta={{
          label: "Initialize in settings",
          onClick: onOpenSettings
        }}
      />
    )
  }

  async function submit() {
    if (!password) {
      toast.error("Enter your master password.")
      return
    }
    setBusy(true)
    try {
      await onUnlock(password)
      setPassword("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <KeyRound className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold">Unlock vault</h2>
        <p className="text-sm text-muted-foreground">
          Your sessions are encrypted. Enter your master password to continue.
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="panel-unlock">Master password</FieldLabel>
          <PasswordInput
            id="panel-unlock"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void submit()
              }
            }}
          />
        </Field>
      </FieldGroup>

      <Button onClick={submit} disabled={busy}>
        Unlock
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  )
}

type GateEmptyProps = {
  icon: React.ReactNode
  title: string
  description: string
  cta: { label: string; onClick: () => void }
}

function GateEmpty({ icon, title, description, cta }: GateEmptyProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={cta.onClick}>{cta.label}</Button>
      </EmptyContent>
    </Empty>
  )
}
