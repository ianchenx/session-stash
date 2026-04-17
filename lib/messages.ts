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

export type UiResp =
  | { ok: true; data?: unknown }
  | { ok: false; error: string }
  | {
      ok: true
      kind: "status"
      initialized: boolean
      unlocked: boolean
      cfConfigured: boolean
    }
  | {
      ok: true
      kind: "accounts"
      entries: IndexEntry[]
      activeId: string | null
    }
  | {
      ok: true
      kind: "switched"
      pushedFrom: boolean
      newFromVersion: number | null
    }
  | { ok: true; kind: "conflict"; info: ConflictInfo }

export type { ConflictInfo, ConflictResolution, HealthStatus } from "./types"
