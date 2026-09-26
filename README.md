<p align="center">
  <img alt="Disco Launcher" width="100" src="xmcl-electron-app/icons/dark@256x256.png">
</p>

<h1 align="center">Disco Launcher</h1>

<p align="center">
  A fast, lightweight, privacy-friendly Minecraft launcher — focused on the essentials and built for low-end machines.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#how-is-disco-launcher-different-from-xmcl">Differences from XMCL</a> ·
  <a href="#development">Development</a> ·
  <a href="#building">Building</a>
</p>

---

Disco Launcher is a fork of the open-source [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher), rebuilt around a single idea: **keep what makes a launcher great, strip everything else**. On top of that cleanup it adds its own skin & cape management, a redesigned Prism-inspired UI, and hardened networking defaults.

## Features

- 🪶 **Lightweight by design.** Telemetry, auto-update polling, multiplayer/P2P networking, the XMCL.org account backend and the AI assistant were all removed. Less code, fewer background processes, faster startup.
- 🔐 **Two account types, zero clutter.** Sign in with a **Microsoft account** (OAuth device code / grant code) or create **offline accounts** for LAN and `online-mode=false` servers.
- 🧥 **Local Closet (skin library).** Import skins from a PNG file, a URL, or fetch them by player name. Save skins to a local library and equip them per account — works for both Microsoft and offline accounts.
- 🎨 **Custom cape.** Attach your own PNG as a "custom cape" that lives entirely on your machine. It is independent from Mojang's official cape entitlements, never uploaded anywhere, and per account: Microsoft accounts keep using their real, official capes alongside it; offline accounts finally get capes at all.
- 🎮 **Offline skins that actually show up in game.** A built-in, launcher-local yggdrasil-compatible endpoint serves your offline profile's skin (and cape) to the game through authlib-injector during launch — no third-party services involved.
- 🧩 **Modpack market without the noise.** Browse and install CurseForge, Modrinth and FTB modpacks with full search filters (game version, mod loader, categories, sort). The flaky "Trending" carousel is gone; the discover grid is the default view.
- 🗂 **Multi-instance management.** Isolate versions, mods and settings per instance; shared assets/libraries are hard-linked to save disk space.
- 💬 **Discord Rich Presence.** Show what you're playing using Disco Launcher's own Discord application.
- 🖥 **Cross-platform targets.** Windows (NSIS installer), macOS (dmg), Linux (deb/rpm/AppImage/tar.xz/pacman). Windows is the primary, actively tested platform.

## How is Disco Launcher different from XMCL?

Disco Launcher started as an optimization fork of XMCL. The table below sums up the intentional deltas:

| Area | XMCL | Disco Launcher |
| --- | --- | --- |
| Accounts | Microsoft, offline, ely.by, littleskin.cn, arbitrary authlib-injector servers, XMCL.org account | **Microsoft + offline only** (third-party yggdrasil account system code removed) |
| Multiplayer | XMCL Together P2P multiplayer, peer hosting, network diagnostics | **Removed** |
| Auto-update | Built-in updater (electron-updater style flows) | **Removed** — update by installing a new setup bundle |
| Telemetry | Azure/OTel-based telemetry & tracing | **Removed** — nothing is collected or sent |
| AI assistant | Built-in AI chat, crash analysis, market agent | **Removed** |
| News section & Minecraft friends | Shipped in the sidebar | **Removed** |
| Skins | Skin library ("Local Closet") for Microsoft accounts | **Kept and fixed** — the closet dialog now opens for both account types; offline equips are fully local (no Mojang request) |
| Capes | Official Mojang cape picker (Microsoft accounts only) | Official picker untouched **plus a launcher-local custom cape** (any account, your own PNG, stored per account in the launcher data folder) |
| Offline skins in game | Not served by default | **Launcher-local yggdrasil endpoint** injects the offline profile's textures at launch |
| Modpack store | Discover grid + "Trending" featured carousel | Discover grid only — the trending section and its featured API calls were removed |
| Branding | XMCL user agent, XMCL Discord app | `discolauncher/disco-launcher` user agent, own Discord application id, own installer (`DiscoLauncher-Setup-*.exe`) |
| UI | Original XMCL look | **Prism-inspired flat restyle** for login, settings, create-game and profile screens |

What stays the same: the entire [@xmcl/*](packages) core library family, instance/resource linking architecture, CurseForge & Modrinth integrations, and the multi-instance model.

## Development

**Prerequisites**

- [Node.js](https://nodejs.org/) **≥ 22.16** (Node 22 LTS recommended)
- [pnpm](https://pnpm.io/) 11 (Corepack picks it up automatically — `corepack enable`)

**Getting started**

```bash
# 1. Install dependencies (workspace-wide, uses pnpm workspaces)
pnpm install --frozen-lockfile

# 2. Start the renderer dev server (http://localhost:3000)
pnpm dev:renderer

# 3. In a second terminal, compile & launch the Electron main process
pnpm dev:main
```

The dev build loads the UI from `http://localhost:3000`; renderer changes hot-reload. Renderer production build + main-process checks are what CI gates on.

**Useful commands**

| Command | What it does |
| --- | --- |
| `pnpm check` | Type-checks every workspace package (`tsc`/`vue-tsc --noEmit`) |
| `pnpm lint` | OxLint across all packages |
| `pnpm test` | Runs the vitest unit suites |
| `pnpm build:renderer` | Production build of the Vue renderer |
| `pnpm dev:main` / `pnpm dev:renderer` | Dev runners for main process / renderer |
| `pnpm test:e2e:ci` | Deterministic, network-free Playwright e2e suite (see [e2e](e2e)) |

> Conventions for agents and contributors live in [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Building

Disco Launcher uses the XMCL build pipeline (esbuild + electron-builder, driven by `xmcl-electron-app/build.ts`):

```bash
# Production renderer bundle + main process bundle
pnpm build

# Full platform packaging through electron-builder
pnpm build:all
```

Packaging targets are declared in [`xmcl-electron-app/build/electron-builder.config.ts`](xmcl-electron-app/build/electron-builder.config.ts):

- **Windows** — NSIS installer (produces `DiscoLauncher-Setup-<version>.exe`, plus a `.sha256` checksum)
- **macOS** — dmg
- **Linux** — deb, rpm, AppImage, tar.xz, pacman

For a local Windows smoke build without packaging the full matrix, `pnpm --prefix xmcl-electron-app compile` emits a production main bundle (`HAS_DEV_SERVER=false`) that serves the built renderer — handy for verifying the packaged app path before running `build:all`.

## License

[MIT](LICENSE) — Disco Launcher inherits XMCL's MIT license. All credit for the original launcher goes to the [XMCL team](https://github.com/Voxelum/x-minecraft-launcher) and its contributors.

## Credits & Acknowledgments

Disco Launcher would not exist without XMCL and its community. Original launcher, core libraries and years of maintenance by **[CI010](https://github.com/ci010)** and the XMCL contributors — thank you.

Localization contributions, package maintainers and the rest of the upstream acknowledgments are listed in the [upstream README](https://github.com/Voxelum/x-minecraft-launcher#credits--acknowledgments).
