import { ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import "./style.css"

import { DEFAULT_LOCK_POLICY, type LockPolicy } from "~lib/session-lock"
import { send } from "~lib/messaging"
import { Badge } from "~components/ui/badge"
import { Separator } from "~components/ui/separator"
import { Skeleton } from "~components/ui/skeleton"
import { Toaster } from "~components/ui/sonner"
import { CloudflareConfigCard } from "~components/cloudflare-config-card"
import { LockPolicyCard } from "~components/lock-policy-card"
import { MasterPasswordCard } from "~components/master-password-card"

type Status = {
  cfConfigured: boolean
  initialized: boolean
  unlocked: boolean
  lockPolicy: LockPolicy
}

function Options() {
  const [status, setStatus] = useState<Status | null>(null)

  const refresh = useCallback(async () => {
    const response = await send({ type: "STATUS" })
    if (response.ok && "kind" in response && response.kind === "status") {
      setStatus({
        cfConfigured: response.cfConfigured,
        initialized: response.initialized,
        unlocked: response.unlocked,
        lockPolicy: response.lockPolicy
      })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Session Stash</h1>
            <p className="text-sm text-muted-foreground">
              Settings · encryption keys, credentials, auto-lock
            </p>
          </div>
          <StatusPills status={status} />
        </header>

        {status === null ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-6">
            <CloudflareConfigCard
              configured={status.cfConfigured}
              onSaved={refresh}
            />
            <Separator />
            <MasterPasswordCard status={status} onChanged={refresh} />
            <LockPolicyCard
              policy={status.lockPolicy ?? DEFAULT_LOCK_POLICY}
              disabled={!status.initialized}
              onChanged={refresh}
            />
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          End-to-end encrypted · PBKDF2-SHA256 600k · AES-GCM-256
        </footer>
      </div>

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}

function StatusPills({ status }: { status: Status | null }) {
  if (!status) {
    return <Skeleton className="h-6 w-32" />
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={status.cfConfigured ? "default" : "secondary"}>
        {status.cfConfigured ? "CF ready" : "No CF"}
      </Badge>
      <Badge variant={status.initialized ? "default" : "secondary"}>
        {status.initialized ? "Vault ready" : "Not initialized"}
      </Badge>
      <Badge
        variant={status.unlocked ? "default" : "outline"}
        className={
          status.unlocked
            ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
            : ""
        }>
        {status.unlocked ? "Unlocked" : "Locked"}
      </Badge>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

export default Options
