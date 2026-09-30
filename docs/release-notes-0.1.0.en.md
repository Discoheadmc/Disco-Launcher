# Disco Launcher 0.1.0 — First Release 🚀

The first public release of Disco Launcher: an XMCL-based, Windows-focused, lightweight and minimalist Minecraft launcher.

> **Install:** download `DiscoLauncher-Setup-0.1.0.exe` below, install, play. Use the `.sha256` sidecar to verify the download.

---

## ✨ Highlights

- 🪶 **Lightweight** — no telemetry, auto-update, P2P multiplayer or AI assistant
- 🔐 **Microsoft + offline accounts**
- 🧥 **Local skins & custom capes** — offline skins show up in game
- 🧩 **Modpack market** — CurseForge (own API key), Modrinth, FTB
- 🎨 **Prism-minimal theme** — 8 color pickers, incl. the Launch button color
- 🗂 **Multi-instance** · 💬 **Discord Rich Presence** · 🖥 **Windows / macOS / Linux**

---

## 🔧 What Changed?

### Stripping It Down

Deliberate removals from upstream XMCL: the P2P multiplayer stack, third-party accounts (ely.by, LittleSkin, xmcl.org), the AI agent backend, the auto-update infrastructure and telemetry exporters were all removed; the News section and Minecraft friends were deleted; 17+ unused dependencies were pruned. **Result:** installer 93.85 → 91.30 MB, fewer background processes, faster startup.

### Performance & Networking

- V8 on-disk code cache for faster warm boots
- undici `bodyTimeout` 10 s → 60 s: large downloads no longer die on slow CDN pauses
- Default `maxSockets` 64 → 16; store trending/latest requests are gated behind section visibility
- Quiet logs: production no longer writes undici.log on every request

### UI: Prism-Minimal Theme

- Flat/opaque surfaces across Settings, Create Game, login and setup screens; blur and animation flourishes removed
- **Appearance > Theme Colors:** 8 independent color pickers + one-click reset; persists through theme export/import and Save to Library
- 🆕 **Dedicated Launch button color:** independent from all other colors, applied only to the Launch button; the default green is kept when unset; persisted in theme.json
- Square switches, a horizontal color picker that opens below its swatch (512×316), classic-only sidebar
- The home launch pill is gone; the full-height quick-actions panel moved to the right column

### Accounts & Login

- The authority dropdown is back and scoped by account type: no password field for Microsoft; offline shows only a username field with a local-scope hint
- Flat setup background and an offline-account hint in the setup wizard (EN/TR)

### Modpack Market

- **CurseForge API key:** the key entered under Settings > Network > API Keys is applied to both the search and install pipelines; it is never bundled with the launcher
- **FTB:** the full discover list (`getAllModpacks`) when the keyword is empty
- The discover grid replaces the Trending carousel, with full search filters

### Skins & Capes

- **Local Closet:** import skins from a PNG/URL/player name, equip per account (Microsoft + offline)
- **Custom cape:** your own PNG — entirely on your machine, per account; Microsoft accounts keep their official capes alongside it
- **Visible in game:** a launcher-local yggdrasil endpoint serves the offline skin through authlib-injector; the optional bundled WSkinLoader Fabric mod makes the custom cape visible in game

### Branding

- Rich Presence through our own Discord application ("Playing {instance}")
- Transparent, multi-size app icon (16–256 ico/icns/png) regenerated from a single source logo
- Our own installer: `DiscoLauncher-Setup-*.exe`

### Fixes

- Fixed the `kUpdateSettings` injection error that crashed the menu bar on every start; the startup console is clean
- The OptiFine resolver window is sandboxed; the splash animation is static; the .gitignore was repaired
- The local skin service was hardened not to hang after the third-party account systems were removed

---

## 📥 Verification

| File | SHA-256 |
| --- | --- |
| `DiscoLauncher-Setup-0.1.0.exe` (≈ 91.5 MB) | `c78cda94b6e915c93667b3432d7b1d5f6555ab78b1f6237d4cd57565422c93f5` |

**Platforms:** Windows (NSIS) is the primary, actively tested target · macOS (dmg) and Linux (deb/rpm/AppImage/tar.xz/pacman) targets are configured

**Requirements:** Java 8+ (depends on the game version) — the launcher can manage the required Java automatically

---

## 🔗 Links

- 📖 [README](../../blob/master/README.en.md) · 🇹🇷 [Türkçe](../../blob/master/README.md)
- 🛠 Upstream: [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) — thank you for the MIT-licensed foundation

**Full changelog and development categories:** [docs/Disco-Launcher-Gelistirme-Sunumu.md](../../blob/master/docs/Disco-Launcher-Gelistirme-Sunumu.md)
