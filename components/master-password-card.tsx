import { AlertTriangle, Lock, Unlock } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { respError, send } from "~lib/messaging"
import { Alert, AlertDescription, AlertTitle } from "~components/ui/alert"
import { Button } from "~components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "~components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~components/ui/field"
import { PasswordInput } from "~components/password-input"

type Status = {
  cfConfigured: boolean
  initialized: boolean
  unlocked: boolean
}

type Props = {
  status: Status
  onChanged: () => void
}

export function MasterPasswordCard({ status, onChanged }: Props) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  const cfMissing = !status.cfConfigured

  async function initPassword() {
    if (password.length < 12) {
      toast.error("Password must be at least 12 characters.")
      return
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.")
      return
    }

    setBusy(true)
    const response = await send({ type: "INIT_META", password })
    setBusy(false)

    const error = respError(response)
    if (error) {
      toast.error(error)
      return
    }

    toast.success("Vault initialized and unlocked.")
    setPassword("")
    setConfirm("")
    onChanged()
  }

  async function unlock() {
    if (!password) {
      toast.error("Enter your master password.")
      return
    }

    setBusy(true)
    const response = await send({ type: "UNLOCK", password })
    setBusy(false)

    const error = respError(response)
    if (error) {
      toast.error(error)
      return
    }

    toast.success("Unlocked.")
    setPassword("")
    onChanged()
  }

  async function lock() {
    setBusy(true)
    const response = await send({ type: "LOCK" })
    setBusy(false)

    const error = respError(response)
    if (error) {
      toast.error(error)
      return
    }

    toast.success("Locked.")
    onChanged()
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center gap-2">
          {status.unlocked ? (
            <Unlock className="h-4 w-4 text-emerald-500" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
          <CardTitle className="text-base">Master Password</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Derives the encryption key. Never leaves your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0">
        {cfMissing && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Cloudflare config required</AlertTitle>
            <AlertDescription>
              Save your Cloudflare credentials above before initializing the vault.
            </AlertDescription>
          </Alert>
        )}

        {!status.initialized && !cfMissing && (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No recovery possible</AlertTitle>
              <AlertDescription>
                If you forget this password, every stored session becomes
                permanently unreadable.
              </AlertDescription>
            </Alert>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="mp-new">New master password</FieldLabel>
                <PasswordInput
                  id="mp-new"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 12 characters"
                />
                <FieldDescription>
                  A long passphrase is far better than a complex short one.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="mp-confirm">Confirm</FieldLabel>
                <PasswordInput
                  id="mp-confirm"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </>
        )}

        {status.initialized && !status.unlocked && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="mp-unlock">Master password</FieldLabel>
              <PasswordInput
                id="mp-unlock"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void unlock()
                  }
                }}
              />
            </Field>
          </FieldGroup>
        )}

        {status.unlocked && (
          <div className="flex items-center gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
            <Unlock className="h-4 w-4 text-emerald-500" />
            <div className="flex-1">
              <p className="font-medium">Vault unlocked</p>
              <p className="text-muted-foreground text-xs">
                The session key is cached until your auto-lock policy triggers or you
                lock manually.
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2 p-4 pt-3">
        {!status.initialized && !cfMissing && (
          <Button onClick={initPassword} disabled={busy}>
            Initialize vault
          </Button>
        )}
        {status.initialized && !status.unlocked && (
          <Button onClick={unlock} disabled={busy}>
            Unlock
          </Button>
        )}
        {status.unlocked && (
          <Button variant="outline" onClick={lock} disabled={busy}>
            <Lock className="h-4 w-4" data-icon="inline-start" />
            Lock now
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
