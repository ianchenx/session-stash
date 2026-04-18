export function faviconUrl(domain: string, size = 32): string {
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=https://${domain}&size=${size}`
}
