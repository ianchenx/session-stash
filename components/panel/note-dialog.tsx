import { useEffect, useState } from "react"

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
import { Textarea } from "~components/ui/textarea"
import type { IndexEntry } from "~lib/types"
import { useAsyncAction } from "~lib/use-async-action"

type Props = {
  target: IndexEntry | null
  onClose: () => void
  onSave: (accountId: string, note: string) => Promise<void>
}

export function NoteDialog({ target, onClose, onSave }: Props) {
  const [note, setNote] = useState("")
  const saver = useAsyncAction(
    async (id: string, value: string) => {
      await onSave(id, value)
    },
    { onSuccess: onClose }
  )

  useEffect(() => {
    if (target) setNote(target.note ?? "")
  }, [target])

  function submit() {
    if (!target) return
    const trimmed = note.trim()
    if (trimmed === (target.note ?? "")) {
      onClose()
      return
    }
    void saver.run(target.id, trimmed)
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next && !saver.busy) onClose()
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target?.note ? "Edit note" : "Add note"}</DialogTitle>
          <DialogDescription>
            Add a note for &ldquo;{target?.label}&rdquo; on{" "}
            {target?.domain ?? "the site"}.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="note-input">Note</FieldLabel>
            <Textarea
              id="note-input"
              autoFocus
              className="min-h-[60px] resize-none"
              placeholder="e.g. Main work account, testing only…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  submit()
                }
              }}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saver.busy}>
            Cancel
          </Button>
          <Button loading={saver.busy} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
