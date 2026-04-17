export const SCHEMA_VERSION = 1
export const CIPHER_VERSION = 1
export const PBKDF2_ITERATIONS = 600_000
export const VERIFIER_PLAINTEXT = "session-stash-v1"

export const KV_KEY_META = "meta"
export const KV_KEY_INDEX = "index"
export const KV_KEY_ACCOUNT_PREFIX = "account:"

export type SerializedCookie = {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: "no_restriction" | "lax" | "strict" | "unspecified"
  expirationDate?: number
  storeId?: string
}

export type CriticalKeys = {
  cookies: string[]
  localStorage: string[]
}

export type Account = {
  id: string
  domain: string
  label: string
  version: number
  updatedAt: number
  cookies: SerializedCookie[]
  localStorage: Record<string, string>
  criticalKeys: CriticalKeys
}

export type IndexEntry = {
  id: string
  domain: string
  label: string
  version: number
  updatedAt: number
}

export type Index = {
  accounts: IndexEntry[]
  updatedAt: number
}

export type Meta = {
  schemaVersion: number
  salt: string
  verifier: string
}

export type CfConfig = {
  accountId: string
  namespaceId: string
  apiToken: string
}

export type SessionSnapshot = {
  cookies: SerializedCookie[]
  localStorage: Record<string, string>
}

export type HealthStatus = "OK" | "STALE" | "EMPTY"

export type ConflictResolution = "overwrite" | "discard" | "cancel"

export type ConflictInfo = {
  accountId: string
  localVersion: number
  remoteVersion: number
}
