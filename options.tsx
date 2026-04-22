import { useCallback, useEffect, useState } from "react"

import "./style.css"

import { CloudflareConfigCard } from "~components/cloudflare-config-card"
import { GithubIcon } from "~components/github-icon"
import { LockPolicyCard } from "~components/lock-policy-card"
import { MasterPasswordCard } from "~components/master-password-card"
import { ThemeCard } from "~components/theme-card"
import { Badge } from "~components/ui/badge"
import { Logo } from "~components/ui/logo"
import { Skeleton } from "~components/ui/skeleton"
import { Toaster } from "~components/ui/sonner"
import type { VaultStatus } from "~lib/messages"
import { send } from "~lib/messaging"
import { DEFAULT_LOCK_POLICY } from "~lib/session-lock"

function Options() {
  const [status, setStatus] = useState<VaultStatus | null>(null)

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
      <div className="mx-auto max-w-xl px-4 py-6">
        <header className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center shrink-0">
            <Logo className="h-full w-full shadow-sm dark:shadow-none" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold tracking-tight">
              Session Stash
            </h1>
            <p className="text-xs text-muted-foreground">
              Settings · keys, credentials, auto-lock
            </p>
          </div>
          <StatusPills status={status} />
        </header>

        {status === null ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-3">
            <CloudflareConfigCard
              configured={status.cfConfigured}
              onSaved={refresh}
            />
            <MasterPasswordCard status={status} onChanged={refresh} />
            <LockPolicyCard
              policy={status.lockPolicy ?? DEFAULT_LOCK_POLICY}
              disabled={!status.initialized}
              onChanged={refresh}
            />
            <ThemeCard />
          </div>
        )}

        <footer className="mt-6 flex flex-col items-center gap-1.5 text-[11px] text-muted-foreground">
          <p>End-to-end encrypted · PBKDF2-SHA256 600k · AES-GCM-256</p>
          <a
            href="https://github.com/ianchenx"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 hover:text-foreground">
            <GithubIcon className="h-3 w-3" />
            ianchenx
          </a>
        </footer>
      </div>

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}

function StatusPills({ status }: { status: VaultStatus | null }) {
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
            ? "bg-success text-success-foreground hover:bg-success/90"
            : ""
        }>
        {status.unlocked ? "Unlocked" : "Locked"}
      </Badge>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export default Options
