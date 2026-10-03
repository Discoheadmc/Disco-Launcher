# Disco Launcher 0.0.2-beta.1 — Performance & Stability Patch 🚀

> **Download `DiscoLauncher-Setup-0.0.2-beta.1.exe` below, install, play.** Use the `.sha256` sidecar to verify the download.

This beta adds performance and stability improvements on top of 0.0.1. **Experimental build** — report issues at [github.com/Discoheadmc/Disco-Launcher/issues](https://github.com/Discoheadmc/Disco-Launcher/issues).

---

## 🔥 What's Changed

### ⚡ Performance

- **Faster startup** — heavy plugins (ResourceWorker, EncodingWorker, SaveWorker) run after `app.whenReady()` instead of blocking constructor.
- **Faster renderer** — heavy deps (three.js, skinview3d, vanta, markdown-it) split into vendor chunks.
- **Instance grid** — icon lazy-loading via `loading="lazy"` + computed icon cache; no re-computation on every render.
- **Store cards** — no more per-card render loop.

### 🧪 Stability & Memory

- **Download concurrency bounded** — fewer memory spikes on 100+ file installs (in-flight dedup).
- **Adaptive controller enabled for all hosts** — Mojang/Modrinth/CF get adaptive downloads too, not just BMCL; fewer 429s.
- **CurseForge/metadata warnings explicit** — missing API key logs a clear message (Settings → Network).
- **Discord Rich Presence debounced** — 500ms; prevents update spam while launching.
- **Diagnosis cache LRU** — long sessions no longer grow memory unbounded.

### 🩹 Critical repair (reproduced live)

- **Offline account never launched** — `Will launch` hang + 404 yggdrasil chain fixed (registry.get never resolved + wrong scheme).
- **Broken/uninstalled instances showed green 'Launch'** — now shows fixed blue **'Download'** that runs the repair flow on click, then reverts to Launch when healthy.
- **Stuck launches can now actually cancel** — abort() no longer crashes.

### 🔧 Setup language persistence fixed

- Selecting Turkish during setup now updates i18n locale + settings atomically — no more TR-then-EN flip.

---

## 📥 Verification

| File | Size | SHA-256 |
| --- | --- | --- |
| `DiscoLauncher-Setup-0.0.2-beta.1.exe` | 94.20 MB | `4f28314b82597d2cc045f8df6f7b6dc555489609dd640b7e2dbcba1590f706fa` |

```powershell
Get-FileHash .\DiscoLauncher-Setup-0.0.2-beta.1.exe -Algorithm SHA256
```

**Known limits:** Instance scanning and heavy file hashing still run on the main thread (worker move is a follow-up). Offline accounts cannot join online-mode servers (expected).

---

## 🔗 Links

- 📖 [README](../README.en.md) · 🇹🇷 [Türkçe](../README.md)
- 🐛 [Open Issue](https://github.com/Discoheadmc/Disco-Launcher/issues)
- 🛠️ Upstream: [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) — thank you for the MIT-licensed foundation
