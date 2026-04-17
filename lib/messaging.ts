import type { UiMsg, UiResp } from "./messages"

export async function send(msg: UiMsg): Promise<UiResp> {
  return (await chrome.runtime.sendMessage(msg)) as UiResp
}

export function isErrorResp(
  resp: UiResp
): resp is { ok: false; error: string } {
  return resp.ok === false
}

export function respError(resp: UiResp): string | null {
  return isErrorResp(resp) ? resp.error : null
}
