import {
  deleteAccount,
  loadAccount,
  loadIndex,
  saveAccount,
  saveIndex
} from "./account"
import { CfKvClient } from "./cf-kv"
import { checkHealth } from "./session"
import type {
  Account,
  ConflictInfo,
  ConflictResolution,
  Index,
  SessionSnapshot
} from "./types"

export type SaveAsNewAccountArgs = {
  client: CfKvClient
  key: CryptoKey
  domain: string
  label: string
  snapshot: SessionSnapshot
}

export async function saveAsNewAccount(
  args: SaveAsNewAccountArgs
): Promise<string> {
  const { client, key, domain, label, snapshot } = args
  const index = await loadIndex(client, key)

  const conflict = index.accounts.find(
    (account) => account.domain === domain && account.label === label
  )
  if (conflict) {
    throw new Error(`duplicate label "${label}" for domain ${domain}`)
  }

  const now = Date.now()
  const account: Account = {
    id: crypto.randomUUID(),
    domain,
    label,
    version: 1,
    updatedAt: now,
    cookies: snapshot.cookies,
    localStorage: snapshot.localStorage,
    criticalKeys: {
      cookies: snapshot.cookies.map((cookie) => cookie.name),
      localStorage: Object.keys(snapshot.localStorage)
    }
  }

  await saveAccount(client, key, account)
  const next: Index = {
    accounts: [
      ...index.accounts,
      {
        id: account.id,
        domain: account.domain,
        label: account.label,
        version: account.version,
        updatedAt: account.updatedAt
      }
    ],
    updatedAt: now
  }
  await saveIndex(client, key, next)
  return account.id
}

export type SessionAdapter = {
  snapshot(): Promise<SessionSnapshot>
  clear(): Promise<void>
  inject(snapshot: SessionSnapshot): Promise<void>
  reload(): Promise<void>
}

export type SwitchArgs = {
  client: CfKvClient
  key: CryptoKey
  adapter: SessionAdapter
  fromAccountId: string
  toAccountId: string
  localFromVersion?: number
  onConflict?: (info: ConflictInfo) => Promise<ConflictResolution>
}

export type SwitchResult = {
  pushedFrom: boolean
  newFromVersion: number | null
  conflictResolution: ConflictResolution | null
}

export async function switchAccount(args: SwitchArgs): Promise<SwitchResult> {
  const { client, key, adapter, fromAccountId, toAccountId } = args

  const index = await loadIndex(client, key)
  const fromEntry = index.accounts.find(
    (account) => account.id === fromAccountId
  )
  const toEntry = index.accounts.find((account) => account.id === toAccountId)
  if (!toEntry) {
    throw new Error(`target account ${toAccountId} not found`)
  }

  const fromAccount = fromEntry
    ? await loadAccount(client, key, fromAccountId)
    : null
  const liveSnapshot = await adapter.snapshot()
  const health = fromAccount
    ? checkHealth(liveSnapshot, fromAccount.criticalKeys)
    : "EMPTY"

  let pushedFrom = false
  let newFromVersion: number | null = null
  let conflictResolution: ConflictResolution | null = null

  if (health === "OK" && fromAccount && fromEntry) {
    const localVersion = args.localFromVersion ?? fromEntry.version
    if (localVersion < fromEntry.version) {
      if (!args.onConflict) {
        throw new Error(
          `version conflict for ${fromAccountId} (local ${localVersion}, remote ${fromEntry.version}); no resolver provided`
        )
      }

      conflictResolution = await args.onConflict({
        accountId: fromAccountId,
        localVersion,
        remoteVersion: fromEntry.version
      })

      if (conflictResolution === "cancel") {
        return {
          pushedFrom: false,
          newFromVersion: null,
          conflictResolution
        }
      }

      if (conflictResolution === "overwrite") {
        newFromVersion = fromEntry.version + 1
      }
    } else {
      newFromVersion = fromEntry.version + 1
    }

    if (newFromVersion !== null) {
      const updated: Account = {
        ...fromAccount,
        cookies: liveSnapshot.cookies,
        localStorage: liveSnapshot.localStorage,
        version: newFromVersion,
        updatedAt: Date.now()
      }

      await saveAccount(client, key, updated)
      const nextIndex: Index = {
        accounts: index.accounts.map((entry) =>
          entry.id === fromAccountId
            ? {
                ...entry,
                version: newFromVersion!,
                updatedAt: updated.updatedAt
              }
            : entry
        ),
        updatedAt: Date.now()
      }
      await saveIndex(client, key, nextIndex)
      pushedFrom = true
    }
  }

  const toAccount = await loadAccount(client, key, toAccountId)
  if (!toAccount) {
    throw new Error(`target account ${toAccountId} not found`)
  }

  const rollbackBuffer = liveSnapshot
  try {
    await adapter.clear()
    await adapter.inject({
      cookies: toAccount.cookies,
      localStorage: toAccount.localStorage
    })
    await adapter.reload()
  } catch (error) {
    try {
      await adapter.clear()
      await adapter.inject(rollbackBuffer)
    } catch {
      // Best effort rollback only.
    }
    throw error
  }

  return {
    pushedFrom,
    newFromVersion,
    conflictResolution
  }
}

export type OverwriteArgs = {
  client: CfKvClient
  key: CryptoKey
  adapter: Pick<SessionAdapter, "snapshot">
  accountId: string
}

export async function overwriteWithCurrent(
  args: OverwriteArgs
): Promise<number> {
  const { client, key, adapter, accountId } = args
  const index = await loadIndex(client, key)
  const entry = index.accounts.find((account) => account.id === accountId)
  if (!entry) {
    throw new Error(`account ${accountId} not found`)
  }

  const account = await loadAccount(client, key, accountId)
  if (!account) {
    throw new Error(`account ${accountId} missing from KV`)
  }

  const snapshot = await adapter.snapshot()
  const health = checkHealth(snapshot, account.criticalKeys)
  if (health !== "OK") {
    throw new Error(`refusing to overwrite: session health is ${health}`)
  }

  const newVersion = entry.version + 1
  const now = Date.now()
  await saveAccount(client, key, {
    ...account,
    cookies: snapshot.cookies,
    localStorage: snapshot.localStorage,
    version: newVersion,
    updatedAt: now
  })
  await saveIndex(client, key, {
    accounts: index.accounts.map((existing) =>
      existing.id === accountId
        ? { ...existing, version: newVersion, updatedAt: now }
        : existing
    ),
    updatedAt: now
  })
  return newVersion
}

export type DeleteArgs = {
  client: CfKvClient
  key: CryptoKey
  accountId: string
}

export async function deleteAccountFlow(args: DeleteArgs): Promise<void> {
  const { client, key, accountId } = args
  const index = await loadIndex(client, key)
  const next: Index = {
    accounts: index.accounts.filter((account) => account.id !== accountId),
    updatedAt: Date.now()
  }
  await saveIndex(client, key, next)
  await deleteAccount(client, accountId)
}

export type RenameArgs = {
  client: CfKvClient
  key: CryptoKey
  accountId: string
  label: string
}

export async function renameAccount(args: RenameArgs): Promise<void> {
  const { client, key, accountId, label } = args
  const trimmed = label.trim()
  if (!trimmed) {
    throw new Error("label cannot be empty")
  }

  const account = await loadAccount(client, key, accountId)
  if (!account) {
    throw new Error(`account ${accountId} not found`)
  }

  const index = await loadIndex(client, key)
  const conflict = index.accounts.find(
    (entry) =>
      entry.id !== accountId &&
      entry.domain === account.domain &&
      entry.label === trimmed
  )
  if (conflict) {
    throw new Error(`duplicate label "${trimmed}" for domain ${account.domain}`)
  }

  const now = Date.now()
  const renamed: Account = { ...account, label: trimmed, updatedAt: now }
  await saveAccount(client, key, renamed)

  const next: Index = {
    accounts: index.accounts.map((entry) =>
      entry.id === accountId
        ? { ...entry, label: trimmed, updatedAt: now }
        : entry
    ),
    updatedAt: now
  }
  await saveIndex(client, key, next)
}
