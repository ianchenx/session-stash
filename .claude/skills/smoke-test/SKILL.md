---
name: smoke-test
description: Full Chrome manual smoke-test checklist for Session Stash. Use before tagging a release or after any change to UI, background service worker, crypto, or KV layout. Tests land in a real Chrome profile against a live HTTPS site.
---

# Manual Chrome smoke test

Session Stash has no E2E automation. Every release requires a live click-through.
Walk this checklist top-to-bottom. Do not skip SW recycle — it's the #1 regression
source.

## Setup

1. `make dev` (keep it running)
2. Chrome → `chrome://extensions` → Developer mode **on** → **Load unpacked** →
   select `build/chrome-mv3-dev/`
3. Confirm the terracotta capsule icon appears in the toolbar
4. Toggle Chrome between light and dark themes — icon should stay legible on both

## Options / first-run init

5. Click the toolbar icon → **Settings**
6. Paste Cloudflare **Account ID**, **Namespace ID**, **API Token** (token needs
   `Account.Workers KV Storage` read+write)
7. Set a **master password** → vault initialises
8. Reload the Options page → credentials should pre-fill (GET_CF_CONFIG path)
9. Configure auto-lock timeout (pick something short, e.g. 2 min, for testing)

## Per-site save / switch / push

10. Open a real HTTPS site with login state (github.com, chatgpt.com, stripe.com…)
11. Toolbar icon → **Save current** → give it a label (e.g. `account-A`)
12. Log out of the site, log in as a different account → **Save current** with a
    new label (`account-B`)
13. In the popup, click **Switch** on `account-A` → tab reloads, identity flips
    back to A
14. Toolbar badge shows the active account label
15. Click **Push** on the active account → confirm KV got updated (no error toast,
    timestamp advances)
16. Rename an account → label updates in popup + sidepanel
17. Delete an account → confirm AlertDialog → entry disappears from both lists

## Clear flow

18. On an active-account tab: sidepanel → **Clear** → confirm dialog → tab's
    cookies + localStorage wiped → reload → you're logged out

## Sidepanel drill-in

19. Open the side panel → site list shows every site you've saved to
20. Tap a site → drills into its account list
21. Back button returns to site list
22. Search filters the site list

## Lock / unlock / auto-lock

23. Sidepanel → lock icon → vault locks → operations require master password
24. Unlock → resume
25. Leave browser idle past the auto-lock timeout → vault auto-locks
26. `chrome.alarms` based; verify by watching `chrome://extensions` → extension
    service worker console for the lock event

## Service worker recycle (critical)

27. `chrome://extensions` → **Inspect views: service worker** → note uptime
28. Wait for Chrome to recycle the SW (kill it manually from the inspector, or
    wait ~5 min idle)
29. Click toolbar icon again → operations still work → vault state warm-restores
    from `chrome.storage`
30. The in-flight badge, if any, repaints correctly after recycle

## Build + package verification

31. `make check` — typecheck + prettier + vitest all green
32. `make package` — `build/chrome-mv3-prod.zip` produced
33. Load `build/chrome-mv3-prod/` as a second unpacked extension → repeat steps
    5–18 to confirm production build parity

## Report

Report exactly which steps passed / failed. A failed smoke test blocks release.
Do not claim "smoke test passed" without having actually clicked through in a
live profile.
