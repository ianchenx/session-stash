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
import { useAsyncAction } from "~lib/use-async-action"

type Props = {
  target: IndexEntry | null
  onClose: () => void
  onRename: (accountId: string, label: string) => Promise<void>
}

export function RenameDialog({ target, onClose, onRename }: Props) {
  const [label, setLabel] = useState("")
  const renamer = useAsyncAction(
    async (id: string, value: string) => {
      await onRename(id, value)
    },
    { onSuccess: onClose }
  )

  useEffect(() => {
    setLabel(target?.label ?? "")
  }, [target])

  function submit() {
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
    void renamer.run(target.id, trimmed)
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next && !renamer.busy) {
          onClose()
        }
      }}>
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
                  submit()
                }
              }}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={renamer.busy}>
            Cancel
          </Button>
          <Button loading={renamer.busy} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
