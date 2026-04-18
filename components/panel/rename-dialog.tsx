import { useEffect, useState } from "react"
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
import { Field, FieldGroup, FieldLabel } from "~components/ui/field"
import { Input } from "~components/ui/input"
import type { IndexEntry } from "~lib/types"

type Props = {
  target: IndexEntry | null
  onClose: () => void
  onRename: (accountId: string, label: string) => Promise<void>
}

export function RenameDialog({ target, onClose, onRename }: Props) {
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLabel(target?.label ?? "")
  }, [target])

  async function submit() {
    if (!target) {
      return
    }
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error("Label cannot be empty.")
      return
    }
    if (trimmed === target.label) {
      onClose()
      return
    }
    setBusy(true)
    try {
      await onRename(target.id, trimmed)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename account</DialogTitle>
          <DialogDescription>
            Change the label for this account on {target?.domain ?? "the site"}.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="rename-label">New label</FieldLabel>
            <Input
              id="rename-label"
              autoFocus
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void submit()
                }
              }}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
