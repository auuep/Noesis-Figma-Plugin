# Tickets

---

## #1 — Unreal Engine export mode

**Status:** Backlog

**Summary:**
Add an "Unreal Engine" export mode to the plugin that rewrites asset references to be compatible with Unreal's content browser and asset system.

**Background:**
The core XAML output is already fully compatible with NoesisGUI in Unreal Engine. The differences are purely in how assets and bindings are referenced.

**Changes needed:**

| Area | Current (Custom C++) | Unreal target |
|---|---|---|
| Image paths | `Assets/image.png` | `/{Game}/UI/Assets/image` |
| Font references | `Fonts/Inter.ttf` | `font:/Game/UI/Fonts/Inter` |
| Data binding targets | C++ class properties | UObject `UPROPERTY` fields or Blueprint variables |
| Code-behind | Custom C++ class | UObject subclass via NoesisGUI Unreal plugin |
| Commands | `ICommand` implementation | Blueprint functions or C++ `UFUNCTION` |

**Implementation:**
- Add an "Unreal Engine" toggle in plugin settings
- Post-processing pass on generated XAML that rewrites asset `Source` and `FontFamily` paths
- Configurable project root / game name (e.g. `MyGame`) for path prefix
- Optional `x:Class` field in export settings for code-behind hookup
- Generate a zip with Unreal-friendly folder structure (`Content/UI/...`)
