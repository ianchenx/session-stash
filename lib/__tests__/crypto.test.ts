import { describe, expect, it } from "vitest"

import {
  base64ToBytes,
  bytesToBase64,
  decrypt,
  deriveMasterKey,
  encrypt,
  randomSalt
} from "../crypto"

describe("crypto", () => {
  it("encrypt/decrypt roundtrip returns original plaintext", async () => {
    const salt = randomSalt()
    const key = await deriveMasterKey("correct-horse-battery-staple", salt)
    const plaintext = new TextEncoder().encode("hello session stash")
    const blob = await encrypt(key, plaintext, "account:abc")
    const decrypted = await decrypt(key, blob, "account:abc")
    expect(new TextDecoder().decode(decrypted)).toBe("hello session stash")
  })

  it("base64 roundtrip", () => {
    const bytes = new Uint8Array([1, 2, 3, 255, 0, 128])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it("wrong password fails decrypt", async () => {
    const salt = randomSalt()
    const key1 = await deriveMasterKey("password-1", salt)
    const key2 = await deriveMasterKey("password-2", salt)
    const blob = await encrypt(key1, new TextEncoder().encode("x"), "aad")
    await expect(decrypt(key2, blob, "aad")).rejects.toThrow()
  })

  it("wrong AAD fails decrypt", async () => {
    const salt = randomSalt()
    const key = await deriveMasterKey("p", salt)
    const blob = await encrypt(key, new TextEncoder().encode("x"), "aad-1")
    await expect(decrypt(key, blob, "aad-2")).rejects.toThrow()
  })

  it("tampered ciphertext fails decrypt", async () => {
    const salt = randomSalt()
    const key = await deriveMasterKey("p", salt)
    const blob = await encrypt(key, new TextEncoder().encode("hello"), "aad")
    blob[blob.length - 1] ^= 0x01
    await expect(decrypt(key, blob, "aad")).rejects.toThrow()
  })

  it("unsupported cipher version rejects", async () => {
    const salt = randomSalt()
    const key = await deriveMasterKey("p", salt)
    const blob = await encrypt(key, new TextEncoder().encode("hello"), "aad")
    blob[0] = 99
    await expect(decrypt(key, blob, "aad")).rejects.toThrow(/cipher version/)
  })
})
