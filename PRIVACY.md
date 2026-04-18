# Session Stash — Privacy Policy

_Last updated: 2026-04-18_

Session Stash ("the extension") is a Chrome extension that helps you manage
multiple account sessions on the same website by saving encrypted snapshots of
cookies and localStorage to a storage location **you control**.

This policy explains what data the extension handles, where it goes, and what
it never does.

## Data the extension handles

On websites you explicitly choose to save a session for, the extension reads
and writes the following:

- **Cookies** — the authentication state for your account on that site
- **localStorage entries** — site-specific data that some applications use
  alongside cookies for login state

The extension also stores locally (inside the browser):

- Your encrypted vault metadata (site list, account labels)
- Your Cloudflare credentials, which are themselves encrypted with your
  master password before being written to `chrome.storage`

## Where your data goes

Snapshots are encrypted **inside the browser** before leaving your machine:

- Symmetric cipher: AES-GCM-256
- Key derivation: PBKDF2-SHA256, 600,000 iterations, salted per install
- The encryption key is derived from your **master password**, which is
  never stored on disk and never transmitted anywhere

The resulting ciphertext is written to a **Cloudflare KV namespace that you
own and authenticate to with your own API token**. The extension has no
backend. The author operates no servers and has no way to read, request, or
intercept your data.

## Data the extension does not collect

- No personally identifiable information
- No browsing history
- No analytics, telemetry, or crash reports
- No advertising identifiers
- No third-party services of any kind

The extension makes network requests **only** to:

1. The Cloudflare KV API (`https://api.cloudflare.com/*`), using the token
   you provided
2. Favicon endpoints, to show site icons in the UI

## Your control

- Delete a snapshot from within the extension to remove it from Cloudflare KV
- Revoke the Cloudflare API token at any time to cut off access entirely
- Uninstall the extension to clear all local state (encrypted vault,
  credentials, settings)
- Wipe the Cloudflare KV namespace from the Cloudflare dashboard to remove
  all remote data

Because encryption keys are derived from your master password and never
leave your browser, **losing the password means losing access to stored
snapshots**. There is no recovery path, by design.

## Permissions and why they exist

| Permission                          | Use                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `cookies`                           | Read and write cookies for the active site to save/restore sessions                        |
| `storage`                           | Persist the encrypted vault and settings locally                                           |
| `scripting`                         | Inject a small script to read and write `localStorage` on the active tab                   |
| `tabs` / `activeTab`                | Determine the current site and act only on the tab you invoke the extension from           |
| `alarms`                            | Auto-lock the vault after an idle timeout you configure                                    |
| `sidePanel`                         | Render the management UI in the browser side panel                                         |
| `favicon`                           | Display site icons in the account list                                                     |
| Host `https://*/*`                  | Required to read and write cookies and localStorage on any HTTPS site you choose to manage |
| Host `https://api.cloudflare.com/*` | Sync encrypted session data to your own Cloudflare KV                                      |

## Changes to this policy

Material changes will be reflected in the `Last updated` date at the top of
this document and in the extension's release notes on the Chrome Web Store.

## Contact

Questions or concerns: **hi@ianx.dev**
