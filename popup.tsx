import {
  ArrowUpFromLine,
  Eraser,
  Lock,
  PanelRightOpen,
  Plus,
  RefreshCcw,
  Settings
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import "./style.css"

import { GithubIcon } from "~components/github-icon"
import { ClearSessionDialog } from "~components/panel/clear-session-dialog"
import { ConflictDialog } from "~components/panel/conflict-dialog"
import { SaveNewDialog } from "~components/panel/save-new-dialog"
import { PasswordInput } from "~components/password-input"
import { SiteFavicon } from "~components/site-favicon"
import { Badge } from "~components/ui/badge"
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
import { Logo } from "~components/ui/logo"
import { ScrollArea } from "~components/ui/scroll-area"
import { Separator } from "~components/ui/separator"
import { Toaster } from "~components/ui/sonner"
import { CenteredSpinner } from "~components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~components/ui/tooltip"
import { cn } from "~lib/cn"
import { formatRelative } from "~lib/format"
import { useAccountAction } from "~lib/use-account-action"
import { useAsyncAction } from "~lib/use-async-action"
import { useSessionPanel } from "~lib/use-session-panel"

const POPUP_WIDTH = 360

function openSettings() {
  // chrome.runtime.openOptionsPage() is async and silently no-ops on some
  // Chromium forks (e.g. Dia); its rejection can't be caught synchronously.
  // Open a plain tab instead — works everywhere because options_ui is set.
  void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })
  window.close()
}

async function openFullPanel() {
  try {
    const [current] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })
    if (current?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: current.windowId })
      window.close()
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

function Popup() {
  const panel = useSessionPanel()
  const [saveOpen, setSaveOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const { status, tab, conflict, dismissConflict, activeIdForSelected } = panel

  return (
    <div
      className="flex min-h-[420px] flex-col bg-background text-foreground"
      style={{ width: POPUP_WIDTH }}>
      <Header panel={panel} />

      {!status ? (
        <CenteredSpinner />
      ) : !status.cfConfigured || !status.initialized ? (
        <SetupGate
          needsCf={!status.cfConfigured}
          needsInit={status.cfConfigured && !status.initialized}
        />
      ) : !status.unlocked ? (
        <UnlockInline onUnlock={panel.unlock} />
      ) : (
        <Body
          panel={panel}
          onOpenSave={() => setSaveOpen(true)}
          onOpenClear={() => setClearOpen(true)}
        />
      )}

      <SaveNewDialog
        open={saveOpen}
        domain={tab.domain}
        onClose={() => setSaveOpen(false)}
        onSave={async (label) => {
          await panel.saveCurrentAsNew(label)
          toast.success(`Saved "${label}".`)
        }}
      />

      <ClearSessionDialog
        open={clearOpen}
        domain={tab.domain}
        hasSavedAccount={Boolean(activeIdForSelected)}
        onClose={() => setClearOpen(false)}
        onConfirm={panel.wipeCurrent}
      />

      <ConflictDialog conflict={conflict} onCancel={dismissConflict} />

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}

function Header({ panel }: { panel: ReturnType<typeof useSessionPanel> }) {
  const { status } = panel
  const locker = useAsyncAction(async () => {
    await panel.lock()
    toast.success("Locked.")
  })

  return (
    <header className="flex items-center gap-2 border-b px-3 py-2.5">
      <div className="flex h-7 w-7 items-center justify-center shrink-0">
        <Logo className="h-full w-full shadow-sm dark:shadow-none" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-none">
          Session Stash
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {status?.unlocked
            ? "Unlocked"
            : status?.initialized
              ? "Locked"
              : "Not set up"}
        </p>
      </div>
      <TooltipProvider delayDuration={200}>
        {status?.unlocked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                loading={locker.busy}
                onClick={() => void locker.run()}>
                <Lock className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Lock now</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => void openFullPanel()}>
              <PanelRightOpen className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open side panel</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={openSettings}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground">
              <a
                href="https://github.com/ianchenx"
                target="_blank"
                rel="noreferrer noopener">
                <GithubIcon className="h-3.5 w-3.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>GitHub · ianchenx</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>
  )
}

function SetupGate({
  needsCf,
  needsInit
}: {
  needsCf: boolean
  needsInit: boolean
}) {
  return (
    <div className="flex flex-1 items-start justify-center p-4">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>
            {needsCf ? "Configure Cloudflare" : "Initialize vault"}
          </EmptyTitle>
          <EmptyDescription>
            {needsCf
              ? "Paste your Cloudflare Account ID, namespace, and API token in settings to start."
              : "Choose a master password in settings. It encrypts every session locally."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openSettings}>Open settings</Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

function UnlockInline({
  onUnlock
}: {
  onUnlock: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState("")
  const unlocker = useAsyncAction(
    async (pw: string) => {
      await onUnlock(pw)
      setPassword("")
    },
    { onError: (error) => toast.error(error.message) }
  )

  function submit() {
    if (!password) {
      toast.error("Enter your master password.")
      return
    }
    void unlocker.run(password)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Vault is locked</p>
        <p className="text-xs text-muted-foreground">
          Enter your master password to continue.
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="popup-unlock">Master password</FieldLabel>
          <PasswordInput
            id="popup-unlock"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submit()
              }
            }}
          />
        </Field>
      </FieldGroup>
      <Button loading={unlocker.busy} onClick={submit}>
        Unlock
      </Button>
    </div>
  )
}

function Body({
  panel,
  onOpenSave,
  onOpenClear
}: {
  panel: ReturnType<typeof useSessionPanel>
  onOpenSave: () => void
  onOpenClear: () => void
}) {
  const {
    tab,
    selectedDomain,
    selectedAccounts,
    activeIdForSelected,
    doSwitch,
    pushCurrent
  } = panel
  const { pendingId, run: runWithPending } = useAccountAction()

  const showingCurrent = tab.domain && selectedDomain === tab.domain
  const accounts = showingCurrent ? selectedAccounts : []

  if (!tab.domain) {
    return (
      <div className="flex flex-1 items-start justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Unsupported tab</EmptyTitle>
            <EmptyDescription>
              The active tab is not an HTTPS website. Open the side panel to
              manage all saved sites.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void openFullPanel()}>
              Open side panel
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <SiteFavicon domain={tab.domain} size={20} />
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
              Current site
            </p>
            <p className="truncate text-sm font-medium">{tab.domain}</p>
          </div>
        </div>
        <Badge variant="secondary">
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
        </Badge>
      </div>

      <Separator />

      <ScrollArea className="max-h-72 flex-1">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No accounts saved for this site yet.
            </p>
            <Button variant="outline" size="sm" onClick={onOpenSave}>
              <Plus />
              Save current session
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 p-2">
            {accounts.map((account) => {
              const active = account.id === activeIdForSelected
              const busy = pendingId === account.id
              const disabledOthers =
                pendingId !== null && pendingId !== account.id
              return (
                <div
                  key={account.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2",
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-muted/40",
                    disabledOthers && "opacity-60"
                  )}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {account.label}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {active && (
                        <span className="text-success">Active · </span>
                      )}
                      {formatRelative(account.updatedAt)}
                    </p>
                  </div>
                  {active ? (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      loading={busy}
                      disabled={disabledOthers}
                      onClick={() =>
                        void runWithPending(account.id, async () => {
                          await pushCurrent(account.id)
                          toast.success("Pushed.")
                        })
                      }>
                      <ArrowUpFromLine />
                      Push
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      loading={busy}
                      disabled={disabledOthers}
                      onClick={() =>
                        void runWithPending(account.id, async () => {
                          await doSwitch(account.id)
                          toast.success(`Switched to ${account.label}.`)
                        })
                      }>
                      <RefreshCcw />
                      Switch
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <Separator />

      <div className="flex items-center gap-2 p-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={!tab.id}
          onClick={onOpenSave}>
          <Plus />
          Save current
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-muted-foreground hover:text-destructive"
          disabled={!tab.id}
          onClick={onOpenClear}>
          <Eraser />
          Clear
        </Button>
      </div>
    </div>
  )
}

export default Popup
