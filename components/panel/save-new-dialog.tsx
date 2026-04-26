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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from "~components/ui/field"
import { Input } from "~components/ui/input"
import { Textarea } from "~components/ui/textarea"
import { useAsyncAction } from "~lib/use-async-action"

type Props = {
  open: boolean
  domain: string | null
  showNote?: boolean
  onClose: () => void
  onSave: (label: string, note?: string) => Promise<void>
}

export function SaveNewDialog({
  open,
  domain,
  showNote,
  onClose,
  onSave
}: Props) {
  const [label, setLabel] = useState("")
  const [note, setNote] = useState("")
  const saver = useAsyncAction(
    async (value: string, noteValue?: string) => {
      await onSave(value, noteValue)
    },
    { onSuccess: onClose }
  )

  useEffect(() => {
    if (open) {
      setLabel("")
      setNote("")
    }
  }, [open])

  function submit() {
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error("Give this account a short label.")
      return
    }
    void saver.run(trimmed, note.trim() || undefined)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saver.busy) {
          onClose()
        }
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save current session</DialogTitle>
          <DialogDescription>
            {domain
              ? `Snapshot cookies and localStorage for ${domain} as a new account.`
              : "Snapshot cookies and localStorage as a new account."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="save-label">Account label</FieldLabel>
            <Input
              id="save-label"
              autoFocus
              placeholder="e.g. Work, Personal, Alice"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submit()
                }
              }}
            />
            <FieldDescription>
              Labels must be unique per site and are shown everywhere.
            </FieldDescription>
          </Field>
          {showNote && (
            <Field>
              <FieldLabel htmlFor="save-note">Note</FieldLabel>
              <Textarea
                id="save-note"
                className="min-h-[60px] resize-none"
                placeholder="e.g. Main work account, testing only…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          )}
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
