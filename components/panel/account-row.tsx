import {
  ArrowUpFromLine,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Trash2
} from "lucide-react"
import { useState } from "react"

import { cn } from "~lib/cn"
import type { IndexEntry } from "~lib/types"
import { Avatar, AvatarFallback } from "~components/ui/avatar"
import { Badge } from "~components/ui/badge"
import { Button } from "~components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "~components/ui/dropdown-menu"

type Props = {
  account: IndexEntry
  active: boolean
  isCurrentDomain: boolean
  onSwitch: () => void
  onPush: () => void
  onRename: () => void
  onDelete: () => void
}

function formatRelative(ts: number): string {
  const delta = Date.now() - ts
  if (delta < 60_000) return "just now"
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return `${months}mo ago`
}

function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

export function AccountRow({
  account,
  active,
  isCurrentDomain,
  onSwitch,
  onPush,
  onRename,
  onDelete
}: Props) {
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void> | void) {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
        active && "border-primary/40 bg-primary/5"
      )}>
      <Avatar className="size-9">
        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
          {initialsFor(account.label)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{account.label}</p>
          {active && (
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-500/90">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Active
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          v{account.version} · updated {formatRelative(account.updatedAt)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {isCurrentDomain && !active && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(onSwitch)}>
            <RefreshCcw className="mr-1 h-3.5 w-3.5" />
            Switch
          </Button>
        )}
        {isCurrentDomain && active && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(onPush)}>
            <ArrowUpFromLine className="mr-1 h-3.5 w-3.5" />
            Push
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" disabled={busy}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
