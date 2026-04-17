import { Globe, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { cn } from "~lib/cn"
import type { PanelState } from "~lib/use-session-panel"
import { Badge } from "~components/ui/badge"
import { Button } from "~components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "~components/ui/input-group"
import { ScrollArea } from "~components/ui/scroll-area"
import { Separator } from "~components/ui/separator"

type Props = {
  panel: PanelState
  onSaveCurrent: () => void
}

export function SiteSidebar({ panel, onSaveCurrent }: Props) {
  const { domains, selectedDomain, setSelectedDomain, tab, activeByDomain } =
    panel
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return domains
    }
    return domains.filter((d) => d.domain.toLowerCase().includes(q))
  }, [domains, query])

  const canSaveCurrent = Boolean(tab.domain && tab.id)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/20">
      <div className="p-3">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search sites…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-2">
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {query ? "No matches." : "No sites yet."}
            </p>
          )}
          {filtered.map(({ domain, count }) => {
            const isSelected = domain === selectedDomain
            const isCurrent = domain === tab.domain
            const hasActive = Boolean(activeByDomain[domain])
            return (
              <button
                key={domain}
                type="button"
                onClick={() => setSelectedDomain(domain)}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}>
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{domain}</span>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Current tab
                    </span>
                  )}
                </div>
                {hasActive && (
                  <span
                    aria-label="Active account"
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                )}
                <Badge
                  variant="secondary"
                  className="text-[10px] tabular-nums">
                  {count}
                </Badge>
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <Button
          variant="outline"
          className="w-full"
          disabled={!canSaveCurrent}
          onClick={onSaveCurrent}>
          <Plus className="mr-1 h-4 w-4" />
          Save current tab
        </Button>
        {!canSaveCurrent && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Open an HTTPS site to save its session.
          </p>
        )}
      </div>
    </aside>
  )
}
