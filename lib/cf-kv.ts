import type { CfConfig } from "./types"

const BASE = "https://api.cloudflare.com/client/v4"

const TIMEOUT_MS = 15_000

export class CfKvClient {
  constructor(private readonly config: CfConfig) {}

  private url(key: string): string {
    const { accountId, namespaceId } = this.config
    return `${BASE}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.apiToken}` }
  }

  async get(key: string): Promise<Uint8Array | null> {
    const response = await fetch(this.url(key), {
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`KV get ${key} failed: ${response.status} ${body}`)
    }

    return new Uint8Array(await response.arrayBuffer())
  }

  async put(key: string, value: Uint8Array): Promise<void> {
    const response = await fetch(this.url(key), {
      method: "PUT",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/octet-stream"
      },
      body: value,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`KV put ${key} failed: ${response.status} ${body}`)
    }
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(this.url(key), {
      method: "DELETE",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })

    if (!response.ok && response.status !== 404) {
      const body = await response.text().catch(() => "")
      throw new Error(`KV delete ${key} failed: ${response.status} ${body}`)
    }
  }
}
