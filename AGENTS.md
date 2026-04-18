# AGENTS.md

Guidance for coding agents (Claude Code, Codex, Gemini CLI, etc.) working in
this repository. Human contributors may also find it useful.

## Project

Session Stash — Chrome MV3 extension (Plasmo) that saves encrypted cookie +
localStorage snapshots to the user's own Cloudflare KV namespace, enabling
per-site multi-account switching.

## Build commands

`make` is the main entry. Run `make help` to see every target. The non-obvious
ones:

- `make dev` — Plasmo dev server. In Chrome: `chrome://extensions` →
  Developer mode → **Load unpacked** → `build/chrome-mv3-dev/`.
- `make check` — typecheck + prettier lint + vitest (use this before committing)
- `make format` — prettier `--write` across the repo
- `make screenshots` — regenerate `assets/screenshots/*.png` via Playwright
  (requires `pnpm exec playwright install chromium` once)

## Release flow

```
make preflight                        # clean tree + typecheck + tests
make version-{patch|minor|major}      # bumps package.json, commits
make tag                              # creates vX.Y.Z tag
make release                          # pushes main + tag
```

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds the
extension, renames the artifact to `session-stash-vX.Y.Z.zip`, and publishes a
GitHub Release with auto-generated notes.

Web Store submission is still **manual** — download the zip from the Release
page and upload it at <https://chrome.google.com/webstore/devconsole/>. The
`/ship` skill has the full runbook.

## Plasmo conventions

- The manifest lives in `package.json` under the `manifest` key. There is no
  standalone `manifest.json`. Extension version tracks `package.json.version`
  automatically — bumping one bumps the other.
- `assets/icon{16,32,48,64,128}.png` are auto-picked as extension icons. The
  16/32 variants are intentionally simplified (no dot grid) because the detailed
  mark turns to mush at small sizes — don't replace them with auto-downscales.
- TypeScript path alias: `~*` → `./*`. Imports look like
  `import { Account } from "~lib/account"`.

## Testing

Vitest only scans `lib/**/*.test.ts`. There are no component/UI tests. If
coverage is needed for behaviour currently in a component, extract the logic
into `lib/` and test it there.

## Service worker constraints (MV3)

`background.ts` runs as an MV3 service worker:

- No DOM APIs, no `window`, no `alert` / `confirm`.
- Can be recycled at any time; state must survive via `chrome.storage` or
  `chrome.alarms`, not in-memory closures.
- All user confirmation dialogs live in the UI layer
  (`components/panel/*-dialog.tsx`), never in the background.

## Frozen surfaces

Do not modify without explicit instruction:

- Encryption parameters (AES-GCM-256, PBKDF2-SHA256 with 600,000 iterations,
  per-install salt)
- Cloudflare KV key layout and ciphertext envelope
- Existing entries in `lib/messages.ts` — adding a new message type is fine;
  renaming or repurposing existing ones is not

## Commit style

Conventional commits, matching `git log --oneline` on `main`:
`build:`, `fix:`, `feat(ui):`, `docs:`, `ci:`, `chore:`. One concern per commit.
