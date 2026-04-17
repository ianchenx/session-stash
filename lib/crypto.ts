import { CIPHER_VERSION, PBKDF2_ITERATIONS } from "./types"

export async function deriveMasterKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encrypt(
  masterKey: CryptoKey,
  plaintext: Uint8Array,
  aad: string
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
      masterKey,
      plaintext
    )
  )
  const out = new Uint8Array(1 + iv.byteLength + ciphertext.byteLength)
  out[0] = CIPHER_VERSION
  out.set(iv, 1)
  out.set(ciphertext, 1 + iv.byteLength)
  return out
}

export async function decrypt(
  masterKey: CryptoKey,
  blob: Uint8Array,
  aad: string
): Promise<Uint8Array> {
  if (blob[0] !== CIPHER_VERSION) {
    throw new Error(`unsupported cipher version: ${blob[0]}`)
  }

  const iv = blob.slice(1, 13)
  const ciphertext = blob.slice(13)
  const enc = new TextEncoder()
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
    masterKey,
    ciphertext
  )

  return new Uint8Array(plaintext)
}

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function randomIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12))
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
