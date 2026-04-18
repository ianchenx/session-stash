import { ChevronRight, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { SiteFavicon } from "~components/site-favicon"
import { Badge } from "~components/ui/badge"
import { Button } from "~components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "~components/ui/input-group"
import { ScrollArea } from "~components/ui/scroll-area"
import { Separator } from "~components/ui/separator"
import { cn } from "~lib/cn"
import type { PanelState } from "~lib/use-session-panel"

type Props = {
  panel: PanelState
  onSaveCurrent: () => void
}

export function SiteListView({ panel, onSaveCurrent }: Props) {
  const { domains, setSelectedDomain, tab, activeByDomain } = panel
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
    <section className="flex flex-1 flex-col">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold">Sites</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick a site to manage its saved accounts.
        </p>
        <div className="mt-3">
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
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {filtered.length === 0 && (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              {query
                ? "No matches."
                : "No sites yet. Open an HTTPS tab and save its session."}
            </p>
          )}
          {filtered.map(({ domain, count }) => {
            const isCurrent = domain === tab.domain
            const hasActive = Boolean(activeByDomain[domain])
            return (
              <button
                key={domain}
                type="button"
                onClick={() => setSelectedDomain(domain)}
                className={cn(
                  "group flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left text-sm transition-colors hover:border-border hover:bg-accent/50",
                  isCurrent && "border-primary/30 bg-primary/5"
                )}>
                <SiteFavicon domain={domain} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{domain}</span>
                    {hasActive && (
                      <span
                        role="status"
                        aria-label="Active account"
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                      />
                    )}
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Current tab
                    </span>
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {count}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
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
          <Plus />
          Save current tab
        </Button>
        {!canSaveCurrent && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Open an HTTPS site to save its session.
          </p>
        )}
      </div>
    </section>
  )
}
