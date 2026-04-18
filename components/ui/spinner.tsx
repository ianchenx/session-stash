import { Loader2 } from "lucide-react"

import { cn } from "~lib/cn"

type Props = {
  className?: string
}

export function Spinner({ className }: Props) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("animate-spin", className)}
    />
  )
}

export function CenteredSpinner({ className }: Props) {
  return (
    <div className={cn("flex flex-1 items-center justify-center p-6", className)}>
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  )
}
