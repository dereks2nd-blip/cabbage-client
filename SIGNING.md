# Code signing (SignPath OSS) — Derek's to-do

The installer is unsigned, so SmartScreen warns on download and Smart App Control
(your own PC) blocks it outright. SignPath signs open-source projects for free.

## One-time application (~10 min, approval takes a few days)

1. Go to https://signpath.org → "Get started" under the **Open Source** program.
2. Sign up with GitHub (use the `dereks2nd-blip` account) and submit
   `https://github.com/dereks2nd-blip/cabbage-client` for review.
   Requirements we already meet: public repo, OSI license (MIT), builds via CI.
3. When approved, in the SignPath dashboard create:
   - a **project** for the repo (slug e.g. `cabbage-client`),
   - an **artifact configuration** for the NSIS installer exe,
   - a **signing policy** (`release-signing`).
4. In the GitHub repo: Settings → Secrets → Actions → add `SIGNPATH_API_TOKEN`
   (from the SignPath dashboard).
5. Tell Claude "SignPath is approved" — the commented step in
   `.github/workflows/release.yml` gets filled in with your org/project ids and
   releases are signed from then on.

## What signing does / doesn't fix

- ✅ Ordinary SmartScreen "unknown publisher" friction mostly clears (fully after
  some download reputation builds).
- ⚠ Smart App Control (Enforce mode, like on this PC) is reputation-gated even for
  signed apps — expect it to relax only after the release has been downloaded a
  while. Until then, use `npm run dev` locally.
