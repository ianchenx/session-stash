import {
  ArrowUpFromLine,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Trash2
} from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "~components/ui/avatar"
import { Button } from "~components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "~components/ui/dropdown-menu"
import { cn } from "~lib/cn"
import { faviconUrl } from "~lib/favicon"
import { formatRelative } from "~lib/format"
import type { IndexEntry } from "~lib/types"

type Props = {
  account: IndexEntry
  active: boolean
  isCurrentDomain: boolean
  onSwitch: () => void
  onPush: () => void
  onRename: () => void
  onDelete: () => void
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
        "flex items-center gap-2.5 rounded-lg border bg-card p-2.5 transition-colors",
        active && "border-primary/40 bg-primary/5"
      )}>
      <div className="relative shrink-0">
        <Avatar className="size-8">
          <AvatarImage
            src={faviconUrl(account.domain)}
            alt=""
            className="p-1"
          />
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {initialsFor(account.label)}
          </AvatarFallback>
        </Avatar>
        {active && (
          <span
            role="status"
            aria-label="Active"
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{account.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {active && <span className="text-emerald-600">Active · </span>}
          {formatRelative(account.updatedAt)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {isCurrentDomain && !active && (
          <Button
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() => void run(onSwitch)}>
            <RefreshCcw />
            Switch
          </Button>
        )}
        {isCurrentDomain && active && (
          <Button
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() => void run(onPush)}>
            <ArrowUpFromLine />
            Push
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={busy}>
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
