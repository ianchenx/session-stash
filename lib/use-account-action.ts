import { useState } from "react"

import { useAsyncAction } from "./use-async-action"

export function useAccountAction() {
  const [pendingId, setPendingId] = useState<string | null>(null)

  const action = useAsyncAction(async (id: string, fn: () => Promise<void>) => {
    setPendingId(id)
    try {
      await fn()
    } finally {
      setPendingId(null)
    }
  })

  return { pendingId, run: action.run }
}
