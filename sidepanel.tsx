import { useState } from "react"
import { toast } from "sonner"

import "./style.css"

import { useSessionPanel } from "~lib/use-session-panel"
import { Toaster } from "~components/ui/sonner"
import { AccountsView } from "~components/panel/accounts-view"
import { AppHeader } from "~components/panel/app-header"
import { ConflictDialog } from "~components/panel/conflict-dialog"
import { SaveNewDialog } from "~components/panel/save-new-dialog"
import { SiteSidebar } from "~components/panel/site-sidebar"
import { UnlockGate } from "~components/panel/unlock-gate"

function openSettings() {
  chrome.runtime.openOptionsPage()
}

function SidePanel() {
  const panel = useSessionPanel()
  const [saveOpen, setSaveOpen] = useState(false)

  const { status, tab, conflict, dismissConflict } = panel

  const openSaveDialog = () => {
    if (!tab.domain || !tab.id) {
      toast.error("Open a supported HTTPS site in the current tab first.")
      return
    }
    setSaveOpen(true)
  }

  const body = (() => {
    if (!status) {
      return <div className="flex-1" />
    }
    if (!status.cfConfigured || !status.initialized || !status.unlocked) {
      return (
        <div className="flex flex-1 items-start justify-center p-6">
          <UnlockGate
            status={status}
            onUnlock={panel.unlock}
            onOpenSettings={openSettings}
          />
        </div>
      )
    }
    return (
      <div className="flex flex-1 overflow-hidden">
        <SiteSidebar panel={panel} onSaveCurrent={openSaveDialog} />
        <AccountsView panel={panel} onSaveCurrent={openSaveDialog} />
      </div>
    )
  })()

  return (
    <div className="flex h-screen min-h-screen flex-col bg-background text-foreground">
      <AppHeader
        status={status}
        onLock={async () => {
          try {
            await panel.lock()
            toast.success("Vault locked.")
          } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error))
          }
        }}
        onOpenSettings={openSettings}
      />

      {body}

      <SaveNewDialog
        open={saveOpen}
        domain={tab.domain}
        onClose={() => setSaveOpen(false)}
        onSave={async (label) => {
          await panel.saveCurrentAsNew(label)
          toast.success(`Saved "${label}".`)
        }}
      />

      <ConflictDialog conflict={conflict} onCancel={dismissConflict} />

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}

export default SidePanel
