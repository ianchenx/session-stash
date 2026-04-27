import { useState } from "react"
import { toast } from "sonner"

type Options = {
  successMessage?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<unknown>,
  options?: Options
) {
  const [busy, setBusy] = useState(false)

  const run = async (...args: TArgs) => {
    setBusy(true)
    try {
      await action(...args)
      if (options?.successMessage) {
        toast.success(options.successMessage)
      }
      options?.onSuccess?.()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      if (err.name === "AbortError") return
      if (options?.onError) {
        options.onError(err)
      } else {
        toast.error(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return { run, busy }
}
