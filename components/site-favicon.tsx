import { Globe } from "lucide-react"
import { useState } from "react"

import { faviconUrl } from "~lib/favicon"

export function SiteFavicon({
  domain,
  size = 16
}: {
  domain: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <Globe style={{ width: size, height: size }} className="shrink-0 text-muted-foreground" />
  }

  return (
    <img
      src={faviconUrl(domain, size >= 24 ? 32 : 16)}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  )
}
