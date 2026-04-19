export type Theme = "light" | "dark" | "system"

export const DEFAULT_THEME: Theme = "system"

const THEME_KEY = "theme"

function normalize(value: unknown): Theme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : DEFAULT_THEME
}

export async function getTheme(): Promise<Theme> {
  const result = await chrome.storage.local.get(THEME_KEY)
  return normalize(result[THEME_KEY])
}

export async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ [THEME_KEY]: theme })
}

export function onThemeChange(cb: (theme: Theme) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName
  ) => {
    if (area !== "local" || !(THEME_KEY in changes)) {
      return
    }
    cb(normalize(changes[THEME_KEY].newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
