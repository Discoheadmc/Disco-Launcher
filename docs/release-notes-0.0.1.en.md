# Disco Launcher 0.0.1 — Day-0 Patch 🩹

> **Download `DiscoLauncher-Setup-0.0.1.exe` below, install, play.** Use the `.sha256` sidecar to verify the download.

This release replaces the 0.1.0 installer with a hotfix build; the version was reset to 0.0.1 to mark it. **Everyone should upgrade.**

---

## 🔥 Critical fixes

- **Offline accounts could not launch the game at all** — after "Will launch" the pipeline hung forever. Root cause: `kYggdrasilSeriveRegistry` is no longer registered anywhere after the third-party account system was removed, and `registry.get()` waits forever. Separately, the local yggdrasil endpoint was only registered under the `http` scheme, but the launcher's local Node server rewrites requests as `xmcl://launcher` — authlib-injector got a 404 and exited with code 1. Both fixed; the offline launch + session/skin chain was verified live.
- **Broken/uninstalled instances showed a green "Launch"** in the right panel — it now shows a fixed-blue **"Download"** button (the custom launch-button color does not tint this state), which runs the repair flow for missing version/java/libraries/assets; it switches back to Launch automatically when the instance is healthy again.
- **Stuck launches can now actually be cancelled** — opening another instance and pressing Cancel used to throw and do nothing; the abort now resolves the right launch.
- **Network**: the launcher no longer misdetects the whole world as inside the GFW — if `google.com` is reachable it goes straight to official endpoints instead of Chinese mirrors.
- **CurseForge metadata 401s** now produce an explicit log warning (Settings → Network → CF API key), and a corrupt project-mapping database heals itself instead of failing forever.
- **Help & feedback**: new GitHub menu (Repository, Downloads, Report Issue) pointing to `Discoheadmc/Disco-Launcher`; upstream XMCL links corrected; the abandoned OpenAI tile in the feedback dialog was replaced with the GitHub Issues channel.

## 🧹 Cleanup

- The last 6 stale unit tests were aligned with the removed features — **1760/1760 tests pass**.
- Removed 98 unused i18n keys from `en.yaml` (agent / xmclAccount / multiplayer / presence leftovers).
- Diagnostic instrumentation was rolled back from the production build.

---

## 📥 Verification

| File | Size | SHA-256 |
| --- | --- | --- |
| `DiscoLauncher-Setup-0.0.1.exe` | 94.23 MB | `e9499d4b67f4a6757753289d012c18e1e637006b7dedfcecd9491d5d41833130` |

```powershell
Get-FileHash .\DiscoLauncher-Setup-0.0.1.exe -Algorithm SHA256
```

**Known limits:** offline accounts cannot join online-mode servers (expected); singleplayer, LAN and online-mode=false servers work. The CurseForge market needs your own CF API key (Settings → Network).

---

## 🔗 Links

- 📖 [README](../README.en.md) · 🇹🇷 [Türkçe](../README.md)
- 🛠 Upstream: [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) — thank you for the MIT-licensed foundation
