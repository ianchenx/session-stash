import { Eraser } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "~components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "~components/ui/dialog"

type Props = {
  open: boolean
  domain: string | null
  hasSavedAccount: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function ClearSessionDialog({
  open,
  domain,
  hasSavedAccount,
  onClose,
  onConfirm
}: Props) {
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      await onConfirm()
      toast.success("Session cleared.")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Eraser className="h-4 w-4" />
            </div>
            <DialogTitle>Clear this session?</DialogTitle>
          </div>
          <DialogDescription>
            {hasSavedAccount ? (
              <>
                Reloads{" "}
                <span className="font-medium">{domain ?? "this site"}</span>{" "}
                with no cookies or local storage, so you can log in as another
                user.{" "}
                <span className="font-medium">
                  Push any unsaved changes first
                </span>{" "}
                — clearing doesn&apos;t sync your current state to the cloud.
              </>
            ) : (
              <>
                Reloads{" "}
                <span className="font-medium">{domain ?? "this site"}</span>{" "}
                with no cookies or local storage, so you can log in as another
                user. Nothing here is saved; your current session will be gone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void run()}
            disabled={busy}>
            <Eraser />
            Clear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
