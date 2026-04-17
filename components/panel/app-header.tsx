import { Lock, Settings, ShieldCheck, Unlock } from "lucide-react"

import { describeLockPolicy } from "~lib/session-lock"
import type { Status } from "~lib/use-session-panel"
import { Badge } from "~components/ui/badge"
import { Button } from "~components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~components/ui/tooltip"

type Props = {
  status: Status | null
  onLock: () => void
  onOpenSettings: () => void
}

export function AppHeader({ status, onLock, onOpenSettings }: Props) {
  const locked = !status?.unlocked
  return (
    <header className="flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ShieldCheck className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight">
          Session Stash
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {status === null
            ? "Loading…"
            : locked
              ? "Locked"
              : `Auto-lock: ${describeLockPolicy(status.lockPolicy)}`}
        </p>
      </div>

      {status?.unlocked ? (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-500/90">
          <Unlock className="mr-1 h-3 w-3" />
          Unlocked
        </Badge>
      ) : (
        <Badge variant="outline">
          <Lock className="mr-1 h-3 w-3" />
          Locked
        </Badge>
      )}

      <TooltipProvider delayDuration={200}>
        {status?.unlocked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onLock}>
                <Lock className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Lock now</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>
  )
}
