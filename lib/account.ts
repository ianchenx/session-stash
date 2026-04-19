import { CfKvClient } from "./cf-kv"
import {
  base64ToBytes,
  bytesToBase64,
  decrypt,
  deriveMasterKey,
  encrypt,
  randomSalt
} from "./crypto"
import type { Account, Index, Meta } from "./types"
import {
  KV_KEY_ACCOUNT_PREFIX,
  KV_KEY_INDEX,
  KV_KEY_META,
  SCHEMA_VERSION,
  VERIFIER_PLAINTEXT
} from "./types"

export async function isInitialized(client: CfKvClient): Promise<boolean> {
  const raw = await client.get(KV_KEY_META)
  return raw !== null
}

export async function initializeMeta(
  client: CfKvClient,
  password: string
): Promise<CryptoKey> {
  if (await isInitialized(client)) {
    throw new Error("meta already initialized")
  }

  const salt = randomSalt()
  const key = await deriveMasterKey(password, salt)
  const verifierCipher = await encrypt(
    key,
    new TextEncoder().encode(VERIFIER_PLAINTEXT),
    "verifier"
  )
  const meta: Meta = {
    schemaVersion: SCHEMA_VERSION,
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(verifierCipher)
  }

  await client.put(KV_KEY_META, new TextEncoder().encode(JSON.stringify(meta)))
  return key
}

export function validateSchemaVersion(meta: Meta): void {
  if (typeof meta.schemaVersion !== "number") {
    throw new Error("meta is corrupted: schemaVersion missing or invalid")
  }
  if (meta.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `vault schema v${meta.schemaVersion} is newer than this extension supports (v${SCHEMA_VERSION}); please update the extension`
    )
  }
  if (meta.schemaVersion < SCHEMA_VERSION) {
    throw new Error(
      `vault schema v${meta.schemaVersion} is older than supported (v${SCHEMA_VERSION}); migration not implemented`
    )
  }
}

export async function unlock(
  client: CfKvClient,
  password: string
): Promise<CryptoKey> {
  const raw = await client.get(KV_KEY_META)
  if (raw === null) {
    throw new Error("not initialized")
  }

  const meta = JSON.parse(new TextDecoder().decode(raw)) as Meta
  validateSchemaVersion(meta)
  const salt = base64ToBytes(meta.salt)
  const key = await deriveMasterKey(password, salt)
  const verifierCipher = base64ToBytes(meta.verifier)
  const plaintext = await decrypt(key, verifierCipher, "verifier")

  if (new TextDecoder().decode(plaintext) !== VERIFIER_PLAINTEXT) {
    throw new Error("verifier mismatch")
  }

  return key
}

export async function loadMeta(client: CfKvClient): Promise<Meta | null> {
  const raw = await client.get(KV_KEY_META)
  if (raw === null) {
    return null
  }

  return JSON.parse(new TextDecoder().decode(raw)) as Meta
}

const EMPTY_INDEX: Index = { accounts: [], updatedAt: 0 }

export async function loadIndex(
  client: CfKvClient,
  key: CryptoKey
): Promise<Index> {
  const raw = await client.get(KV_KEY_INDEX)
  if (raw === null) {
    return { ...EMPTY_INDEX }
  }

  const plaintext = await decrypt(key, raw, KV_KEY_INDEX)
  return JSON.parse(new TextDecoder().decode(plaintext)) as Index
}

export async function saveIndex(
  client: CfKvClient,
  key: CryptoKey,
  index: Index
): Promise<void> {
  const plaintext = new TextEncoder().encode(JSON.stringify(index))
  const blob = await encrypt(key, plaintext, KV_KEY_INDEX)
  await client.put(KV_KEY_INDEX, blob)
}

export function accountKey(id: string): string {
  return `${KV_KEY_ACCOUNT_PREFIX}${id}`
}

export async function loadAccount(
  client: CfKvClient,
  key: CryptoKey,
  id: string
): Promise<Account | null> {
  const kvKey = accountKey(id)
  const raw = await client.get(kvKey)

  if (raw === null) {
    return null
  }

  const plaintext = await decrypt(key, raw, kvKey)
  return JSON.parse(new TextDecoder().decode(plaintext)) as Account
}

export async function saveAccount(
  client: CfKvClient,
  key: CryptoKey,
  account: Account
): Promise<void> {
  const kvKey = accountKey(account.id)
  const plaintext = new TextEncoder().encode(JSON.stringify(account))
  const blob = await encrypt(key, plaintext, kvKey)
  await client.put(kvKey, blob)
}

export async function deleteAccount(
  client: CfKvClient,
  id: string
): Promise<void> {
  await client.delete(accountKey(id))
}
