import type { LockPolicy } from "./session-lock"
import type {
  CfConfig,
  ConflictInfo,
  ConflictResolution,
  IndexEntry
} from "./types"

export type VaultStatus = {
  cfConfigured: boolean
  initialized: boolean
  unlocked: boolean
  lockPolicy: LockPolicy
}

export type UiMsg =
  | { type: "STATUS" }
  | { type: "GET_CF_CONFIG" }
  | { type: "SET_CF_CONFIG"; cfg: CfConfig }
  | { type: "INIT_META"; password: string }
  | { type: "UNLOCK"; password: string }
  | { type: "LOCK" }
  | { type: "LIST_ALL" }
  | { type: "LIST_ACCOUNTS"; domain: string }
  | { type: "SAVE_NEW"; domain: string; label: string; tabId: number }
  | {
      type: "SWITCH"
      domain: string
      fromId: string | null
      toId: string
      tabId: number
      localFromVersion?: number
      resolution?: ConflictResolution
    }
  | { type: "OVERWRITE"; accountId: string; tabId: number }
  | { type: "DELETE"; accountId: string; tabId: number }
  | { type: "RENAME"; accountId: string; label: string }
  | { type: "WIPE_CURRENT"; domain: string; tabId: number }
  | { type: "SET_LOCK_POLICY"; policy: LockPolicy }
  | { type: "GET_LOCK_POLICY" }

export type UiResp =
  | { ok: true; data?: unknown }
  | { ok: false; error: string }
  | ({ ok: true; kind: "status" } & VaultStatus)
  | {
      ok: true
      kind: "accounts"
      entries: IndexEntry[]
      activeId: string | null
    }
  | {
      ok: true
      kind: "all-accounts"
      entries: IndexEntry[]
      activeByDomain: Record<string, string>
    }
  | {
      ok: true
      kind: "switched"
      pushedFrom: boolean
      newFromVersion: number | null
      syncedTabCount: number
    }
  | { ok: true; kind: "conflict"; info: ConflictInfo }
  | { ok: true; kind: "lock-policy"; policy: LockPolicy }
  | { ok: true; kind: "cf-config"; config: CfConfig | null }

export type { ConflictInfo, ConflictResolution, HealthStatus } from "./types"
export type { LockPolicy } from "./session-lock"
