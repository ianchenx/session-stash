import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { PendingConflict } from "~lib/use-session-panel"
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
  conflict: PendingConflict | null
  onCancel: () => void
}

export function ConflictDialog({ conflict, onCancel }: Props) {
  const [busy, setBusy] = useState(false)

  async function resolve(resolution: "overwrite" | "discard") {
    if (!conflict) {
      return
    }
    setBusy(true)
    try {
      await conflict.retry(resolution)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={conflict !== null} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <DialogTitle>Version conflict</DialogTitle>
          </div>
          <DialogDescription>
            The cloud copy of your currently-loaded account is newer than your
            local version. Choose how to reconcile before switching.
          </DialogDescription>
        </DialogHeader>

        {conflict && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p>
              <span className="text-muted-foreground">Account:</span>{" "}
              <span className="font-mono">{conflict.info.accountId}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Local version:</span>{" "}
              v{conflict.info.localVersion}
            </p>
            <p>
              <span className="text-muted-foreground">Remote version:</span>{" "}
              v{conflict.info.remoteVersion}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => void resolve("discard")}
            disabled={busy}>
            Discard local
          </Button>
          <Button onClick={() => void resolve("overwrite")} disabled={busy}>
            Overwrite cloud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
