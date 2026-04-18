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
import { useAsyncAction } from "~lib/use-async-action"

type Props = {
  open: boolean
  domain: string | null
  onClose: () => void
  onSave: (label: string) => Promise<void>
}

export function SaveNewDialog({ open, domain, onClose, onSave }: Props) {
  const [label, setLabel] = useState("")
  const saver = useAsyncAction(
    async (value: string) => {
      await onSave(value)
    },
    { onSuccess: onClose }
  )

  useEffect(() => {
    if (open) {
      setLabel("")
    }
  }, [open])

  function submit() {
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error("Give this account a short label.")
      return
    }
    void saver.run(trimmed)
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
