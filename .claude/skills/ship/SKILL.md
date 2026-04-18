---
name: ship
description: End-to-end release runbook for Session Stash. Handles version bump, git tag, push, and the manual Chrome Web Store upload. Use when the user says "ship it", "release", "cut a version", or similar.
---

# Release runbook

Session Stash releases in two halves:

1. **Automated** — Makefile targets bump the version, tag the commit, and push
   (which triggers the `build.yml` CI job that uploads the packaged zip as an
   Actions artifact).
2. **Manual** — the user downloads that zip and uploads it to the Chrome Web
   Store dashboard. We do **not** automate the Web Store submission; it's a
   deliberate manual gate because a bad release is user-visible and hard to
   revert.

## Precondition: smoke test

If UI, background service worker, crypto, or KV code changed since the last
release, run `/smoke-test` first. A release without a passing smoke test is
not allowed.

## Step 1 — Decide the bump

Ask the user which bump, based on what's changed since the last tag:

- **patch** (`0.1.0 → 0.1.1`) — bug fix only, no user-visible behaviour change
- **minor** (`0.1.0 → 0.2.0`) — new feature, backwards compatible
- **major** (`0.1.0 → 1.0.0`) — breaking change for saved data or config shape

## Step 2 — Run the Makefile pipeline

```bash
make preflight               # clean tree + typecheck + tests
make version-{patch|minor|major}   # bumps package.json, commits as "chore: bump version to X.Y.Z"
make tag                     # creates vX.Y.Z tag on HEAD
make release-dry             # show what would be pushed (no side effects)
make release                 # pushes main + tag → triggers build.yml
```

If `release-dry` shows unexpected commits, **stop** and resolve before pushing.

## Step 3 — Wait for CI

- GitHub Actions → find the `Build` workflow run for the new commit
- Wait for it to go green
- Open the run → **Artifacts** → download `session-stash-<sha>`

## Step 4 — Upload to Chrome Web Store (manual)

1. Unzip the downloaded artifact → confirms `chrome-mv3-prod.zip` inside
2. Go to <https://chrome.google.com/webstore/devconsole/>
3. Select the Session Stash listing
4. **Package** tab → **Upload new package** → select the zip
5. **Store listing** tab → update screenshots if they changed (regenerate with
   `make screenshots` beforehand)
6. Fill the release notes in the version history field
7. **Submit for review**

## Step 5 — Post-release

- Review can take a few hours to several days; don't assume instant rollout
- If review rejects, the fix is a patch release: amend + `/ship` again
- After approval, verify the new version appears at
  `https://chromewebstore.google.com/detail/session-stash/<ext-id>` and that
  an existing install auto-updates within ~24h

## What this skill does NOT do

- Does not touch the Web Store automatically (no BPP / SUBMIT_KEYS path — see
  `submit.yml` workflow_dispatch, kept as a future option)
- Does not skip the smoke test — do not rationalise around it
- Does not amend the previous release commit — use a fresh commit for any fix
