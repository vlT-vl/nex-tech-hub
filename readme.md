<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="res/nex-tech-hub-full-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="res/nex-tech-hub-full.svg" />
    <img src="res/nex-tech-hub-full.svg" alt="nex tech hub" width="300" />
  </picture>
</p>

<p align="center">
  Web hub for technicians and sysadmins — VMware · Proxmox · Kubernetes · Linux<br/>
  <sub>Frontend React · Build Vite · Deploy GitHub Pages</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--R180726-5b5bd6?style=flat-square" alt="version"/>
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="react"/>
  <img src="https://img.shields.io/badge/vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="vite"/>
  <img src="https://img.shields.io/badge/deploy-GitHub%20Pages-black?style=flat-square&logo=github" alt="deploy"/>
  <img src="https://img.shields.io/badge/license-proprietary-critical?style=flat-square" alt="license"/>
</p>

---

## Overview

**nex tech hub** is a web Single Page Application that provides a centralized panel for technicians and sysadmins working on VMware, Proxmox, Kubernetes and Linux environments. Distributed as a static page on GitHub Pages, it requires no application backend: data is fetched via public APIs.

Access uses an AES-GCM encrypted user payload generated during the GitHub Actions pipeline and served as a static deploy asset. The decryption token is never exposed in plain text in the source or in `VITE_` variables: it is read at build-time, obfuscated in the bundle and reconstructed at runtime by the client.

---

## Features

| Section | Description |
|---|---|
| **Dashboard** | Release Widget (PVE/PBS/PDM), Download ISO Widget with SHA256, CVE Widget with NVD NIST queries, News Widget from RSS feeds |
| **Tech Release** | Full release table for PVE/PBS/PDM, VMware ESXi/vCenter, Kubernetes, Ubuntu, Debian, RHEL, Rocky, Fedora |
| **Infrastructure Insights** | Multi-vendor dashboard: Proxmox (datacenter/VM/LXC/nodes/storage/network/margins tabs) and VMware (dynamic tabs from vmwtools JSON); drag-and-drop report upload; RVTools XLSX → vmwtools JSON conversion |
| **GitHub Repo** | Vendor/category repository view generated as static JSON in `public/data/github/`, with `vlt-website`-style repo cards/modals, vlT cube icon, and strict vendor-tech filtering for vlT repos |
| **About** | Version, build, tech stack, license, localized IT/EN legal notes and link to the vlT website |
| **Login** | Authentication with `settings.enc.json` AES-GCM v2 and sanitized session; no recent-user/last-login list is stored |

### Interface

- Light/dark theme with preference saved in `localStorage` (key `nth_theme`)
- **nex tech hub** logo as an inline SVG component (`NexthLogo`) with Nasalization font — smaller "nex", "tech hub" highlighted; suited for sidebar, dashboard and login screen without depending on a PNG file
- Neutral professional palette: dark navy `#090d19`, purple-blue accent `#5b5bd6`, green accent `#00b36b`
- Dashboard grid contained within the visible viewport with internal scroll on the cards
- IT/EN language switcher in the sidebar with preference saved in `localStorage` (key `nth_lang`)
- Localization extended to sidebar, login, Dashboard, release/download/CVE widgets, Proxmox Release and About
- vlT logo on the About page, clickable and linking to `https://lorenzoveronesi.it/`
- Restrained animations: light transitions on view and filter changes

### Dashboard Widgets

**Release Widget** — tracks the latest releases of:
- Proxmox VE 9 and 8 (PVE)
- Proxmox Backup Server (PBS)
- Proxmox Datacenter Manager (PDM)

**Download Widget** — direct links to official ISOs with verifiable SHA256, with an interactive product selector.

**CVE Widget** — searches active CVEs via [NVD NIST API 2.0](https://nvd.nist.gov/developers/vulnerabilities), with automatic product detection and severity badges (CRITICAL / HIGH / MEDIUM / LOW).

**News Widget** — shows Proxmox product news using a static IT/EN RSS feed served from a CORS-friendly source, with no quota-limited APIs or external proxies. The card also includes a quick link to Google News.

---

## Architecture

```
nex-tech-hub/
├── scripts/
│   ├── fetch-static-data.mjs       # CI/dev: pre-fetches CVE + news + GitHub repo data into public/data/
│   └── vmwtools.js                 # RVTools XLSX parser → vmwtools JSON (ESM)
├── src/
│   ├── pages/
│   │   ├── login.jsx               # animated login without recent-user storage
│   │   ├── homepage.jsx            # shell with sidebar, theme and language
│   │   ├── dashboard.jsx           # widget aggregator + NexthLogo logo
│   │   ├── relasewidget.jsx        # PVE/PBS/PDM release widget
│   │   ├── downloadwidget.jsx      # ISO download widget
│   │   ├── cvewidget.jsx           # NVD NIST CVE widget
│   │   ├── newswidget.jsx          # multi-tech news widget via RSS
│   │   ├── techrelease.jsx         # full release table + animated filters
│   │   ├── githubrepo.jsx          # static GitHub repo view + repo modals
│   │   ├── infrainsights.jsx       # Infrastructure Insights — Proxmox/VMware shell
│   │   ├── proxmoxinfradash.jsx    # Proxmox dashboard tabs (datacenter/vm/lxc/nodes/storage/network/margins)
│   │   ├── vmwareinfradash.jsx     # VMware dashboard tabs (dynamic, from vmwtools JSON)
│   │   ├── vmwtools.jsx            # RVTools converter XLSX → JSON
│   │   ├── admin.jsx               # administrative export of settings.enc.json
│   │   ├── about.jsx               # about + license + stack + IT/EN texts
│   │   └── info.jsx                # version/build info page (not currently routed)
│   ├── components/
│   │   ├── NexthLogo.jsx           # inline SVG logo (variants: full, icon, text, stacked)
│   │   ├── VltLogo.jsx             # vlT logo for the About footer
│   │   └── DashModal.jsx           # reusable modal sheet for dashboard widgets
│   ├── lib/
│   │   ├── authSecurity.js         # sanitized session + client-side auth helpers
│   │   ├── token.js                # reconstruction of the XOR-obfuscated token
│   │   └── uiText.js               # localized IT/EN texts
│   ├── App.jsx
│   └── main.jsx
├── auth/
│   ├── settingsAuth.js             # fetch + decrypt AES-GCM v2 auth (browser)
│   └── encrypt-settings.mjs        # CLI: generates/validates/exports settings.enc.json v2
├── css/
│   ├── index.css                   # base, CSS custom properties, NexthLogo
│   ├── animations.css              # global keyframes + .view-panel
│   ├── login.css                   # animated login, glassmorphism
│   ├── home.css                    # responsive sidebar, layout
│   ├── dashboard.css               # widgets, release card, CVE table
│   ├── admin.css                   # auth user management, per-user view permissions
│   ├── techrelease.css             # Tech Release page (Nasalization font, .tech-selector/.tech-pill)
│   ├── nexthlogo.css               # NexthLogo component (Nasalization font, variants)
│   ├── vltlogo.css                 # VltLogo component
│   ├── infrainsights.css           # Infrastructure Insights shell (.insights-*, .iv-upload-form)
│   ├── proxmoxinfra.css            # Proxmox dashboard tabs (orange accent #f97316)
│   ├── vmwareinfra.css             # VMware dashboard tabs (green accent #56a668)
│   ├── info.css                    # info page styles
│   └── about.css                   # about, license modal
├── res/
│   ├── nex-tech-hub.svg            # hexagonal hub icon (favicon + NexthLogo)
│   ├── vltcube.svg                 # vlT vector logo
│   ├── iso-icon.png                # ISO icon in the download widget
│   ├── nasalization.ttf            # Nasalization logo font
│   └── CenturyGothic.ttf          # Century Gothic UI font
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD → GitHub Pages
├── vite.config.js                  # token obfuscation plugin + build
├── index.html
└── package.json
```

### Logo — NexthLogo SVG

The logo does not depend on a PNG file. `src/components/NexthLogo.jsx` is a React component with an inline SVG that includes:
- A large hexagon with a purple-blue gradient (`#6D6DD0 → #4B4BC1 → #31319A`)
- A lighter secondary hexagon overlaid on top
- "nex" text in Nasalization at a reduced size (0.68 em, 65% opacity)
- "tech hub" text in Nasalization at full size (1 em, white)

Available variants: `full` (icon + text, default), `icon` (SVG only), `text` (text only), `stacked` (icon + "nex" centered below, used in the sidebar). SVG gradient IDs are prefixed with `nth-` to avoid conflicts between multiple instances of the same component.

### Security — AES Token

The AES token used to decrypt credentials is never stored in plain text in the source code, in public `.env` files, or in `import.meta.env`:

- In `.env` the token uses the `NTH_` prefix (not `VITE_`) — Vite does not inject it into `import.meta.env`
- `vite.config.js` reads `NTH_AES_TOKEN` from the environment at build-time, XOR-obfuscates it and injects it as a `define` constant into the bundle (`__NTH_D__`, `__NTH_K1__`, `__NTH_K2__`)
- `src/lib/token.js` performs the reconstruction at runtime from the compiled bundle
- In CI the token comes from GitHub Actions Secrets, never from the repository

> Security note: decryption happens in the browser, so the token must be reconstructible by the client at runtime. This protects against accidental exposure in the source and trivial scraping of the encrypted JSON, but it does not replace server-side validation.

```
.env (NTH_AES_TOKEN) ──► vite.config.js (XOR + base64)
                              └──► bundle: __NTH_D__ + __NTH_K1__ + __NTH_K2__
                                       └──► src/lib/token.js: getToken()
```

### Authentication

```
Login (email + password)
  └── loadSettingsPayload(SETTINGS_URL, getToken())
        ├── fetch AES-GCM encrypted JSON from public/settings.enc.json
        └── decrypt + verify passwordHash → match user
              └── persistSessionUser() → sanitized localStorage "nth_user" → navigate /home
```

`settings.enc.json` is not committed. In dev it must exist locally at `public/settings.enc.json`; in production it is written by GitHub Actions before the build. The client decrypts the payload only at runtime using the token reconstructed from the bundle.

### User Admin

The Admin view is shown only to the `vlt@hub.local` session. It allows loading the current user list, adding/removing users and setting new passwords without ever exporting plain-text passwords.

Saving generates a new `settings.enc.json` AES-GCM v2 payload with random salt/iv. In production the Admin UI calls the GitHub `workflow_dispatch` API directly, using a GitHub token entered by the admin at runtime — never embedded in the bundle and never saved to `.env`.

### Client-side Hardening

- `authSecurity.js` strips sensitive fields from the session before saving (`password`, `token`, `secret`, `hash`, `apiKey`, etc.)
- Old sessions already present in `localStorage` are automatically cleaned up on read
- Password comparison only accepts PBKDF2 `passwordHash`
- The WebCrypto key derived for AES-GCM v2 is non-extractable
- `auth/settingsAuth.js` validates the encrypted format, envelope type (`nth-auth-users`), payload size and user schema

### Session Privacy

The login page does not store recent users, last-login email addresses or login history. Only the sanitized active session is persisted in `localStorage` under `nth_user`.

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.7 | UI framework |
| `react-dom` | ^19.2.7 | DOM renderer |
| `react-router-dom` | ^7.18.1 | SPA routing (HashRouter) |
| `react-icons` | ^5.7.0 | Icon library |
| `react-dropzone` | ^17.0.0 | Drag-and-drop JSON report upload |

| Dev | Version | Purpose |
|---|---|---|
| `vite` | ^8.1.5 | Build tool + dev server |
| `@vitejs/plugin-react` | ^6.0.3 | React Fast Refresh + JSX |
| `playwright` | ^1.61.1 | CI static-data fetch (Chromium via `pwRequest`) |

---

## Local Development

Create an `.env` file in the root with only the variables used by the frontend/dev:

```env
# Dev only: enables real testing of workflow_dispatch from the Admin page.
VITE_NTH_ENABLE_ADMIN_DISPATCH_TEST=false

# Auth token read by Vite at build/dev time. Do not use the VITE_ prefix.
NTH_AES_TOKEN=<aes_token>
```

> `NTH_AES_TOKEN` does not have the `VITE_` prefix — it is never exposed in `import.meta.env`. It is read exclusively by the Vite plugin at build-time and obfuscated in the bundle.

A local `public/settings.enc.json` file is required to work in dev. The file is ignored by Git and must not be committed.

To generate the local v2 file from a plain-text user JSON (`NTH_AES_TOKEN` must be set in `.env`):

```bash
npm run auth:encrypt -- /path/to/users.json
```

This writes `public/settings.enc.json` by default (pass a second argument to override the output path).

To prepare the initial value for the `NTH_SETTINGS_ENC_JSON_B64` secret:

```bash
npm run auth:secret
```

The external static-data workflow also generates `public/data/github/*.json` for the GitHub Repo view. In GitHub Actions it uses the automatic `GITHUB_TOKEN` for higher API quota; local runs use `GITHUB_TOKEN`/`GH_TOKEN` when set and otherwise try the GitHub CLI token from `gh auth token`, falling back to anonymous public requests only when no token is available. The frontend consumes only the static JSON, includes base-path fallbacks for dev/build hosting, and keeps the repo loading effect keyed only by selected category.

Category filters are applied both during static-data generation and again in the frontend as a defensive pass over existing JSON files. Each category defines required and excluded keywords, using word-boundary matching to avoid accidental substring matches. Repository text is restricted to IT/EN letters only: `A-Z/a-z` plus Italian accented vowels are allowed, while any other Unicode letter excludes the repository. For example, the Proxmox category excludes macOS/OSX/Hackintosh/OpenCore-style repositories that only mention Proxmox as an installation platform.

Repository lists use their own TTL (`GITHUB_TTL_HOURS`, default 24h, based on each JSON `generatedAt` value), so scheduled data refreshes do not refetch complete GitHub metadata on every CVE/news run unless `GITHUB_FORCE=1` or `--force-github` is used. If a JSON is still missing README or details data and a token is available, the script ignores the TTL for that category and completes the backfill. Enrichment is budgeted globally per run: with a token the default budget is high enough to populate all README and detail payloads, while anonymous mode stays conservative. Rendered README data fills `readmeHtml`, `previewImage`/`readmeImage`, and `readmeFetchedAt`; the heavier languages/contents/commits/latest-release payload fills `dash` and `dashFetchedAt`. Detail endpoints are fetched independently: a transient failure on one endpoint saves a partial `dash` for the UI but leaves `dashFetchedAt` unset so the repo is retried next run. Relative image `src`/`srcset` in the README HTML are rewritten to `raw.githubusercontent.com` so README images render correctly in the modal and card thumbnails. Every GitHub call goes through a single serialized queue that checks live rate-limit headers before each request and stops gracefully once quota gets low, resuming on the next run instead of erroring.

If the repo modal shows missing README/details, inspect `public/data/github/*.json`: empty `readmeHtml`, `dash: null`, and no `readmeFetchedAt`/`dashFetchedAt` mean the local dataset is still the base list and needs a refreshed static-data artifact from the external workflow. Cards follow the same thumbnail method used by `vlt-website`: the first README `<img>` becomes a small square overlay inside the repo icon box, with the normal repo icon as fallback. The modal details tab also falls back to base repository metadata when the heavier `dash` payload is not available yet. The modal overlay intentionally avoids CSS backdrop blur to keep the sheet crisp.

---

## GitHub Actions Admin

There is no application backend: GitHub Actions handles generation/deploy once triggered.

```text
Admin UI
  -> generates encrypted settings.enc.json
  -> calls the GitHub workflow_dispatch API with a token entered at runtime
  -> .github/workflows/deploy.yml receives settings_enc_json_b64
  -> auth:write-dispatch writes public/settings.enc.json
  -> build + deploy to GitHub Pages
```

The GitHub token box is always visible in the Admin header as a compact key control that expands on hover/focus; in compact state it fully hides the input and placeholder. The token must be a fine-grained token from the admin account with permission to trigger workflows on the `vlT-vl/nex-tech-hub` repo; it is kept in the admin browser's `sessionStorage` (`nth_admin_github_token`) and is never committed. In dev it remains disabled unless dispatch testing is explicitly enabled.

---

## Deploy — GitHub Pages

Deployment is automated via GitHub Actions. On every push to `sourcecode` the workflow:

1. Installs dependencies (`npm ci`)
2. Writes `public/settings.enc.json` from the Admin payload (`workflow_dispatch` input `settings_enc_json_b64`) or from the base `NTH_SETTINGS_ENC_JSON_B64` secret
3. Runs the build, injecting `NTH_AES_TOKEN` from the repository secret
4. Publishes the CI-generated `dist/` folder to GitHub Pages

Configure these secrets in `Settings → Secrets and variables → Actions`:

| Name | Required | Description |
|---|---|---|
| `NTH_AES_TOKEN` | Yes | Auth token used by Vite and the auth scripts during deploy |
| `NTH_SETTINGS_ENC_JSON_B64` | Yes | Base encrypted `settings.enc.json`, used on push/schedule deploys and re-persisted after an Admin dispatch |
| `NTH_DEPLOY_KEY` | No | Fine-grained PAT with repo secrets write access — lets the workflow self-update `NTH_SETTINGS_ENC_JSON_B64` after an Admin UI dispatch; without it the dispatch still deploys but doesn't persist the new settings |

The static-data fetch step (`scripts/fetch-static-data.mjs`) never fails the pipeline: if a single external source (NVD, CIRCL, an RSS feed, GitHub) is temporarily unreachable, that section keeps the last known-good file on disk and retries on the next scheduled run, while the rest of the run — commit, build, deploy — still proceeds.

The page will be available at: `https://vlt-vl.github.io/nex-tech-hub/`

> `dist/` must not be versioned or left in the project's working directory. The build must only happen inside the CI/CD workflow.

---

## Version and Build

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Build | R180726 |
| Updated | July 18, 2026 |
| Initial build | R110326 |

---

## License

nex tech hub is distributed under a **Proprietary License** — Copyright © 2026 Veronesi Lorenzo (vlT).

nex tech hub is a proprietary portal. Access and use are reserved exclusively for parties explicitly authorized by the author. Without the prior written consent of the owner, the following are expressly forbidden:

- **Unauthorized access** — use is permitted exclusively to those who receive explicit authorization from the author
- **Modification** — adaptation, translation or creation of derivative works
- **Redistribution** — copying, forking, republishing, sublicensing or repackaging
- **Reverse engineering** — decompilation or disassembly of the minified/bundled output
- **Commercial exploitation** — sale or incorporation into commercial products/services

All intellectual property rights remain exclusively with Veronesi Lorenzo (vlT). The software is provided "as is", without warranties of any kind.

The license is governed by Italian law; exclusive competent court: Milan (MI).

For license requests or authorizations: [veronesilorenzo@outlook.com](mailto:veronesilorenzo@outlook.com)

---

**Copyright © 2026 vlT di Veronesi Lorenzo. All rights reserved.**
