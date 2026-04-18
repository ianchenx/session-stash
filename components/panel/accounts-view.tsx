import {
  ChevronLeft,
  Eraser,
  MoreHorizontal,
  Plus,
  UserPlus
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { AccountRow } from "~components/panel/account-row"
import { ClearSessionDialog } from "~components/panel/clear-session-dialog"
import { ConfirmDialog } from "~components/panel/confirm-dialog"
import { RenameDialog } from "~components/panel/rename-dialog"
import { Button } from "~components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "~components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "~components/ui/empty"
import { ScrollArea } from "~components/ui/scroll-area"
import type { IndexEntry } from "~lib/types"
import type { PanelState } from "~lib/use-session-panel"

type Props = {
  panel: PanelState
  onSaveCurrent: () => void
  onBack?: () => void
}

export function AccountsView({ panel, onSaveCurrent, onBack }: Props) {
  const [renameTarget, setRenameTarget] = useState<IndexEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IndexEntry | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const {
    selectedDomain,
    selectedAccounts,
    activeIdForSelected,
    tab,
    doSwitch,
    pushCurrent,
    rename,
    remove,
    wipeCurrent
  } = panel

  if (!selectedDomain) {
    return null
  }

  const isCurrentDomain = tab.domain === selectedDomain
  const canClear = isCurrentDomain && Boolean(tab.id)

  async function runWithPending(id: string, fn: () => Promise<void>) {
    setPendingId(id)
    try {
      await fn()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex items-start gap-2 border-b px-3 py-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 h-8 w-8 shrink-0"
            onClick={onBack}
            aria-label="Back to sites">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{selectedDomain}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {selectedAccounts.length} account
            {selectedAccounts.length === 1 ? "" : "s"}
            {isCurrentDomain ? " · current tab" : ""}
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 shrink-0"
          disabled={!tab.domain || !tab.id}
          onClick={onSaveCurrent}>
          <Plus />
          Save
        </Button>
        {canClear && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setClearOpen(true)}
                className="text-destructive focus:text-destructive">
                <Eraser className="mr-2 h-4 w-4" />
                Clear session…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ScrollArea className="flex-1">
        {selectedAccounts.length === 0 ? (
          <div className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UserPlus className="h-5 w-5" />
                </EmptyMedia>
                <EmptyTitle>No accounts for this site</EmptyTitle>
                <EmptyDescription>
                  {isCurrentDomain
                    ? "Sign in on this tab first, then snapshot the session as your first account."
                    : `Open ${selectedDomain} in a tab to save its first session.`}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onClick={onSaveCurrent}
                  disabled={!isCurrentDomain || !tab.id}>
                  <Plus />
                  Save current session
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            {selectedAccounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                active={account.id === activeIdForSelected}
                isCurrentDomain={isCurrentDomain}
                busy={pendingId === account.id}
                disabledOthers={
                  pendingId !== null && pendingId !== account.id
                }
                onSwitch={() =>
                  void runWithPending(account.id, () => doSwitch(account.id))
                }
                onPush={() =>
                  void runWithPending(account.id, async () => {
                    await pushCurrent(account.id)
                    toast.success("Pushed current session to cloud.")
                  })
                }
                onRename={() => setRenameTarget(account)}
                onDelete={() => setDeleteTarget(account)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={async (id, label) => {
          await rename(id, label)
          toast.success("Renamed.")
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete account?"
        description={
          deleteTarget
            ? `Permanently delete "${deleteTarget.label}" from the cloud. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        successMessage={
          deleteTarget ? `Deleted ${deleteTarget.label}.` : undefined
        }
        onConfirm={async () => {
          if (deleteTarget) {
            await remove(deleteTarget.id)
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />

      <ClearSessionDialog
        open={clearOpen}
        domain={selectedDomain}
        hasSavedAccount={Boolean(activeIdForSelected)}
        onClose={() => setClearOpen(false)}
        onConfirm={wipeCurrent}
      />
    </section>
  )
}
