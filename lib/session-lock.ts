import { base64ToBytes, bytesToBase64 } from "./crypto"

const SESSION_KEY = "sessionMasterKey"
const LOCK_POLICY_KEY = "lockPolicy"
const LOCK_ALARM_NAME = "session-stash:auto-lock"

export type LockPolicy =
  | { kind: "timeout"; minutes: number }
  | { kind: "browser_restart" }

export const DEFAULT_LOCK_POLICY: LockPolicy = { kind: "timeout", minutes: 15 }

export const TIMEOUT_OPTIONS: LockPolicy[] = [
  { kind: "timeout", minutes: 5 },
  { kind: "timeout", minutes: 15 },
  { kind: "timeout", minutes: 30 },
  { kind: "timeout", minutes: 60 },
  { kind: "timeout", minutes: 240 },
  { kind: "browser_restart" }
]

export async function persistSessionKey(key: CryptoKey): Promise<void> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key))
  await chrome.storage.session.set({ [SESSION_KEY]: bytesToBase64(raw) })
}

export async function restoreSessionKey(): Promise<CryptoKey | null> {
  const result = await chrome.storage.session.get(SESSION_KEY)
  const encoded = result[SESSION_KEY] as string | undefined
  if (!encoded) {
    return null
  }

  const raw = base64ToBytes(encoded)
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function clearSessionKey(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY)
}

export async function getLockPolicy(): Promise<LockPolicy> {
  const result = await chrome.storage.local.get(LOCK_POLICY_KEY)
  return (
    (result[LOCK_POLICY_KEY] as LockPolicy | undefined) ?? DEFAULT_LOCK_POLICY
  )
}

export async function setLockPolicy(policy: LockPolicy): Promise<void> {
  await chrome.storage.local.set({ [LOCK_POLICY_KEY]: policy })
}

export async function scheduleAutoLock(policy: LockPolicy): Promise<void> {
  await chrome.alarms.clear(LOCK_ALARM_NAME)
  if (policy.kind === "timeout") {
    chrome.alarms.create(LOCK_ALARM_NAME, { delayInMinutes: policy.minutes })
  }
}

export async function cancelAutoLock(): Promise<void> {
  await chrome.alarms.clear(LOCK_ALARM_NAME)
}

export function isLockAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm.name === LOCK_ALARM_NAME
}

export function describeLockPolicy(policy: LockPolicy): string {
  if (policy.kind === "browser_restart") {
    return "Until browser closes"
  }

  const minutes = policy.minutes
  if (minutes < 60) {
    return `${minutes} minutes`
  }

  const hours = minutes / 60
  return hours === 1 ? "1 hour" : `${hours} hours`
}
