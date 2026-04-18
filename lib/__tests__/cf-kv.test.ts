import { beforeEach, describe, expect, it, vi } from "vitest"

import { CfKvClient } from "../cf-kv"

const config = {
  accountId: "acc",
  namespaceId: "ns",
  apiToken: "tok"
}

function mockFetch(
  responses: Array<{
    status?: number
    ok?: boolean
    body?: ArrayBuffer | string
  }>
) {
  let index = 0
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    const response = responses[index]
    index += 1
    const ok = response.ok ?? (response.status ?? 200) < 400
    const body = response.body

    return {
      ok,
      status: response.status ?? 200,
      async arrayBuffer() {
        if (body instanceof ArrayBuffer) {
          return body
        }

        if (typeof body === "string") {
          return new TextEncoder().encode(body).buffer
        }

        return new ArrayBuffer(0)
      },
      async text() {
        if (typeof body === "string") {
          return body
        }

        return ""
      }
    } as Response
  })
  globalThis.fetch = fn as typeof fetch
  return fn
}

describe("CfKvClient", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("get returns bytes on 200", async () => {
    const fn = mockFetch([{ status: 200, body: "hello" }])
    const client = new CfKvClient(config)
    const out = await client.get("meta")

    expect(new TextDecoder().decode(out!)).toBe("hello")
    expect(fn).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acc/storage/kv/namespaces/ns/values/meta",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok" })
      })
    )
  })

  it("get returns null on 404", async () => {
    mockFetch([{ status: 404 }])
    const client = new CfKvClient(config)
    expect(await client.get("nope")).toBeNull()
  })

  it("get throws on 5xx", async () => {
    mockFetch([{ status: 500, body: "server err" }])
    const client = new CfKvClient(config)
    await expect(client.get("x")).rejects.toThrow(/500/)
  })

  it("put sends bytes with correct headers", async () => {
    const fn = mockFetch([{ status: 200 }])
    const client = new CfKvClient(config)
    await client.put("account:1", new Uint8Array([1, 2, 3]))

    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining("/values/account%3A1"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
          "Content-Type": "application/octet-stream"
        })
      })
    )
  })

  it("put throws on non-2xx", async () => {
    mockFetch([{ status: 403, body: "forbidden" }])
    const client = new CfKvClient(config)
    await expect(client.put("x", new Uint8Array([0]))).rejects.toThrow(/403/)
  })

  it("delete sends DELETE; 404 is not an error", async () => {
    mockFetch([{ status: 404 }])
    const client = new CfKvClient(config)
    await expect(client.delete("x")).resolves.toBeUndefined()
  })
})
