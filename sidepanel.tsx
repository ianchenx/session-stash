import { useState } from "react"
import { toast } from "sonner"

import "./style.css"

import { AccountsView } from "~components/panel/accounts-view"
import { AppHeader } from "~components/panel/app-header"
import { ConflictDialog } from "~components/panel/conflict-dialog"
import { SaveNewDialog } from "~components/panel/save-new-dialog"
import { SiteListView } from "~components/panel/site-list-view"
import { UnlockGate } from "~components/panel/unlock-gate"
import { Toaster } from "~components/ui/sonner"
import { CenteredSpinner } from "~components/ui/spinner"
import { useSessionPanel } from "~lib/use-session-panel"

function openSettings() {
  // See popup.tsx: openOptionsPage is async and silently no-ops in Dia.
  void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })
}

function SidePanel() {
  const panel = useSessionPanel()
  const [saveOpen, setSaveOpen] = useState(false)

  const {
    status,
    tab,
    conflict,
    dismissConflict,
    selectedDomain,
    setSelectedDomain
  } = panel

  const openSaveDialog = () => {
    if (!tab.domain || !tab.id) {
      toast.error("Open a supported HTTPS site in the current tab first.")
      return
    }
    setSaveOpen(true)
  }

  const body = (() => {
    if (!status) {
      return <CenteredSpinner />
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
    if (!selectedDomain) {
      return <SiteListView panel={panel} onSaveCurrent={openSaveDialog} />
    }
    return (
      <AccountsView
        panel={panel}
        onSaveCurrent={openSaveDialog}
        onBack={() => setSelectedDomain(null)}
      />
    )
  })()

  return (
    <div className="flex h-screen min-h-screen flex-col bg-background text-foreground">
      <AppHeader
        status={status}
        onLock={async () => {
          await panel.lock()
          toast.success("Vault locked.")
        }}
        onOpenSettings={openSettings}
      />

      {body}

      <SaveNewDialog
        open={saveOpen}
        domain={tab.domain}
        showNote
        onClose={() => setSaveOpen(false)}
        onSave={async (label, note) => {
          await panel.saveCurrentAsNew(label, note)
          toast.success(`Saved "${label}".`)
        }}
      />

      <ConflictDialog conflict={conflict} onCancel={dismissConflict} />

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}

export default SidePanel
