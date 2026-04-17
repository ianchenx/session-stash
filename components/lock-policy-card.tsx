import { useState } from "react"
import { toast } from "sonner"

import {
  describeLockPolicy,
  TIMEOUT_OPTIONS,
  type LockPolicy
} from "~lib/session-lock"
import { respError, send } from "~lib/messaging"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "~components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "~components/ui/toggle-group"

type Props = {
  policy: LockPolicy
  disabled?: boolean
  onChanged: () => void
}

function policyToValue(policy: LockPolicy): string {
  return policy.kind === "browser_restart" ? "restart" : `t${policy.minutes}`
}

function valueToPolicy(value: string): LockPolicy | null {
  if (value === "restart") {
    return { kind: "browser_restart" }
  }
  if (value.startsWith("t")) {
    const minutes = Number(value.slice(1))
    if (Number.isFinite(minutes) && minutes > 0) {
      return { kind: "timeout", minutes }
    }
  }
  return null
}

export function LockPolicyCard({ policy, disabled, onChanged }: Props) {
  const [pending, setPending] = useState(false)

  async function apply(next: LockPolicy) {
    setPending(true)
    const response = await send({ type: "SET_LOCK_POLICY", policy: next })
    setPending(false)

    const error = respError(response)
    if (error) {
      toast.error(error)
      return
    }

    toast.success(`Auto-lock: ${describeLockPolicy(next)}`)
    onChanged()
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Auto-lock</CardTitle>
        <CardDescription className="text-xs">
          How long the vault stays unlocked after last use.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ToggleGroup
          type="single"
          value={policyToValue(policy)}
          disabled={disabled || pending}
          onValueChange={(value) => {
            if (!value) {
              return
            }
            const next = valueToPolicy(value)
            if (next) {
              void apply(next)
            }
          }}
          className="flex-wrap justify-start">
          {TIMEOUT_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={policyToValue(option)}
              value={policyToValue(option)}
              variant="outline"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              {describeLockPolicy(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  )
}
