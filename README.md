# 🥬 Cabbage Client

A free, FPS-optimized Minecraft launcher + custom client for Windows. Like Feather/Lunar, but with more cabbage (and tennis birds).

![Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-9feaf9) ![License](https://img.shields.io/badge/license-MIT-lime) ![Platform](https://img.shields.io/badge/platform-Windows-blue)

## Download

Grab the latest `Cabbage-Client-*-setup.exe` from [Releases](../../releases).

> **Windows SmartScreen:** if you see "Windows protected your PC", click **More info → Run anyway**. The installer is safe — new apps just haven't built download reputation yet.

## Features

**Launcher**
- 🔑 Microsoft login (real online play) — no config, just sign in
- 📦 Any Minecraft version, vanilla or Fabric, auto-installed (Java included)
- 🧩 Modrinth mod browser with automatic dependency resolution
- ⚡ One-click **Max-FPS pack** (Sodium, Lithium, FerriteCore, ImmediatelyFast, EntityCulling, MoreCulling, Sodium Extra)
- 💾 **Mod profiles** — save your loadout ("PvP", "Max FPS"…) and apply it to any version
- 🗂 Per-version instances (each version gets its own mods/worlds/settings)
- 🎚 RAM slider + tuned JVM flags

**In-game client mod** (auto-installed on Fabric 1.21.11)
- 📊 Lunar-style HUD: FPS, coords, CPS, keystrokes, armor, ping, memory, clock, potions, sprint
- 🎨 Drag-and-drop HUD editor (press **Right Shift** in game)
- 🖼 Custom pixel-art title screen + skinned menus
- 👁 Player/block ESP overlays (**singleplayer/LAN only** — using ESP on servers violates their rules and will get you banned)

## Build from source

```powershell
npm install
npm run dev          # run the launcher in dev mode
npm run build        # compile
npm run package:win  # build the Windows installer into dist/
```

The in-game mod lives in `mod/` (Fabric, MC 1.21.11, Java 21, Gradle 9.5):

```powershell
cd mod
gradle build   # output: build/libs/cabbage-hud-*.jar
```

The built jar is staged at `resources/mods/cabbage-hud.jar` and bundled into the installer.

## License

MIT — see [LICENSE](LICENSE). Not affiliated with Mojang or Microsoft.
