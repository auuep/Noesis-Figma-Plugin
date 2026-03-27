# Tickets

---

## #2 — Name reviewer suggests closest valid tag for unknown tags

**Status:** Backlog

**Summary:**
When a layer is named with an unrecognized tag (e.g. `Buttons.Start`), the reviewer currently strips the tag entirely and suggests `Start`. It should instead suggest the closest matching valid tag from the registry (e.g. `Button.Start`).

**Current behavior:**
`Buttons.Start` → suggested: `Start` (unknown tag stripped, bare name returned)

**Expected behavior:**
`Buttons.Start` → suggested: `Button.Start` (closest valid tag substituted)

**Implementation:**
- In `src/core/name-reviewer.ts`, when a tag candidate is not in the registry, run a fuzzy/closest match against all known tags in `TAG_REGISTRY` (e.g. case-insensitive substring match or edit distance)
- If a confident match is found, use that tag in the suggestion and change the issue label from `unknown tag "Buttons"` to something like `did you mean "Button"?`
- If no close match is found, fall back to the current behavior (strip the tag, keep the name)

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
