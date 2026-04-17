import { getDomain } from "tldts"

export function getETLDPlusOne(url: string): string | null {
  if (!url) {
    return null
  }

  try {
    const domain = getDomain(url)
    return domain ?? null
  } catch {
    return null
  }
}
