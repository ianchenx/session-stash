import type { LockPolicy } from "./session-lock"
import type {
  CfConfig,
  ConflictInfo,
  ConflictResolution,
  HealthStatus,
  IndexEntry
} from "./types"

export type UiMsg =
  | { type: "STATUS" }
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
  | { type: "SET_LOCK_POLICY"; policy: LockPolicy }
  | { type: "GET_LOCK_POLICY" }

export type UiResp =
  | { ok: true; data?: unknown }
  | { ok: false; error: string }
  | {
      ok: true
      kind: "status"
      initialized: boolean
      unlocked: boolean
      cfConfigured: boolean
      lockPolicy: LockPolicy
    }
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
    }
  | { ok: true; kind: "conflict"; info: ConflictInfo }
  | { ok: true; kind: "lock-policy"; policy: LockPolicy }

export type { ConflictInfo, ConflictResolution, HealthStatus } from "./types"
export type { LockPolicy } from "./session-lock"
