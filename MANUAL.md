# NoesisGUI XAML Exporter — Designer Manual

This plugin converts your Figma designs into NoesisGUI-compatible XAML. It works by reading your **layer names** and **node descriptions** to understand what XAML element to generate. Anything the plugin can detect visually (colors, fonts, sizes, auto-layout) is exported automatically — you only need conventions for things that need XAML semantics beyond what Figma can express visually.

---

## Table of Contents

1. [The Basics](#1-the-basics)
2. [Naming Convention](#2-naming-convention)
3. [Layout Panels](#3-layout-panels)
4. [Controls](#4-controls)
5. [Text & Data Binding](#5-text--data-binding)
6. [Styles & Resources](#6-styles--resources)
7. [Images & Vectors](#7-images--vectors)
8. [Advanced Properties via Description](#8-advanced-properties-via-description)
9. [Special Prefixes](#9-special-prefixes)
10. [What Is Exported Automatically](#10-what-is-exported-automatically)
11. [What Is Not Supported](#11-what-is-not-supported)
12. [Full Example](#12-full-example)

---

## 1. The Basics

- **Select a frame** in Figma, then open the plugin.
- The plugin reads your layer tree and generates XAML in the preview panel.
- Click **Copy XAML** to copy to clipboard, or **Export .zip** to download the XAML file + image assets together.
- XAML updates live whenever you change the selection.

---

## 2. Naming Convention

Layer names follow this pattern:

```
Tag.Name
```

- **`Tag`** — a XAML element type (e.g. `Button`, `Grid`, `TextBox`). Case-insensitive.
- **`Name`** — becomes the `x:Name` attribute. Spaces and special characters are sanitized.

**Examples:**

| Figma Layer Name | XAML Output |
|---|---|
| `Button.StartGame` | `<Button x:Name="StartGame">` |
| `Grid.MainLayout` | `<Grid x:Name="MainLayout">` |
| `TextBox.PlayerName` | `<TextBox x:Name="PlayerName"/>` |
| `Slider.Volume` | `<Slider x:Name="Volume"/>` |
| `ScrollViewer.Inventory` | `<ScrollViewer x:Name="Inventory">` |
| `Border.Card` | `<Border x:Name="Card">` |

**Name only (no tag):**

If the layer name has no recognized tag, the plugin infers the XAML element from Figma's node type and layout. The name becomes `x:Name`:

```
MainPanel   →  <StackPanel x:Name="MainPanel">   (if it has auto-layout)
              <Canvas x:Name="MainPanel">         (if no auto-layout)
```

**No name:**

```
Button.    →  <Button>   (no x:Name)
```

---

## 3. Layout Panels

### Auto-detected layouts

| Figma Frame | Auto-detected XAML |
|---|---|
| Auto-layout **vertical** | `<StackPanel Orientation="Vertical">` |
| Auto-layout **horizontal** | `<StackPanel Orientation="Horizontal">` |
| **No** auto-layout | `<Canvas>` (children use absolute `Canvas.Left`/`Canvas.Top`) |

Padding and spacing from auto-layout are automatically converted to `Padding` and child `Margin` attributes.

### Forcing a layout panel

Add a tag prefix to override auto-detection:

```
Grid.MainLayout
StackPanel.ButtonRow
WrapPanel.InventoryGrid
DockPanel.AppLayout
Canvas.HudLayer
ScrollViewer.ItemList
```

### Grid layout

Tag a frame as `Grid.Name`, then set row/column definitions in its **description field**:

**Frame description:**
```
RowDefinitions=Auto,*,50
ColumnDefinitions=200,*
```

This generates:
```xml
<Grid x:Name="Stats">
  <Grid.RowDefinitions>
    <RowDefinition Height="Auto"/>
    <RowDefinition Height="*"/>
    <RowDefinition Height="50"/>
  </Grid.RowDefinitions>
  <Grid.ColumnDefinitions>
    <ColumnDefinition Width="200"/>
    <ColumnDefinition Width="*"/>
  </Grid.ColumnDefinitions>
  ...
</Grid>
```

Then on each **child** layer, add its row/column in the child's description:
```
Grid.Row=0
Grid.Column=1
Grid.ColumnSpan=2
```

### DockPanel layout

Tag frame as `DockPanel.Name`. On each child layer, add in description:
```
Dock=Top
```
```
Dock=Bottom
```
```
Dock=Left
```
```
Dock=Right
```
The last child (no Dock value) fills the remaining space.

### WrapPanel layout

```
WrapPanel.ItemGrid
```
Optional in description:
```
Orientation=Horizontal
ItemWidth=80
ItemHeight=80
```

### UniformGrid

```
UniformGrid.Hotbar
```
In description:
```
Rows=2
Columns=5
```

---

## 4. Controls

Add a control tag prefix to any frame or group:

### Button / ToggleButton / RepeatButton

```
Button.StartGame
ToggleButton.MuteToggle
RepeatButton.FastForward
```

The child text layer inside the frame becomes the button's `Content`. A child frame becomes a content template.

To attach a command (set in description):
```
Command={Binding StartCommand}
```

### CheckBox / RadioButton

```
CheckBox.RememberMe
RadioButton.DifficultyEasy
```

For RadioButton groups, add to description:
```
GroupName=Difficulty
```

### TextBox / PasswordBox

```
TextBox.PlayerName
PasswordBox.Pin
```

To set a text binding (description):
```
Text={Binding PlayerName}
```

### Slider

```
Slider.MusicVolume
```

In description:
```
Minimum=0
Maximum=100
Value={Binding MusicVolume}
Orientation=Horizontal
```

### ProgressBar

```
ProgressBar.LoadingBar
```

In description:
```
Minimum=0
Maximum=100
Value={Binding LoadProgress}
```

### ComboBox

```
ComboBox.Resolution
```

Each child frame inside becomes a `<ComboBoxItem>`.

### ListBox / ListView

```
ListBox.SaveSlots
```

Each child frame inside becomes a `<ListBoxItem>`.

### ScrollViewer

```
ScrollViewer.Inventory
```

Wrap any content that needs scrolling in a `ScrollViewer.Name` frame.

### TabControl

```
TabControl.Settings
```

Each direct child frame becomes a `<TabItem>`. The child frame's name becomes the tab `Header`.

### ContentControl / ItemsControl

```
ContentControl.PlayerCard
ItemsControl.Leaderboard
```

---

## 5. Text & Data Binding

### Plain text

Any Figma text layer exports as `<TextBlock>`. Font, size, weight, color, alignment, and wrapping are exported automatically.

### Data binding in text

If your text content contains `{Binding ...}` or `{StaticResource ...}`, it's passed through to XAML:

| Figma Text Content | XAML Output |
|---|---|
| `Hello World` | `<TextBlock Text="Hello World"/>` |
| `{Binding PlayerName}` | `<TextBlock Text="{Binding PlayerName}"/>` |
| `HP: {Binding Health}` | Uses `<Run>` inlines for mixed content |
| `{Binding Score, StringFormat=Score: \{0\}}` | Passed through directly |

### Binding via description

You can also set text bindings in the description field of a TextBlock layer:
```
Text={Binding PlayerName}
```

### Placeholder text

If your text content is `...` (three dots), the plugin marks it as a binding placeholder with a comment.

---

## 6. Styles & Resources

### Figma color styles → XAML brushes

Figma color styles defined in your document are automatically exported as `<SolidColorBrush>` resources in a `ResourceDictionary` when **"Include styles"** is checked in the plugin settings.

Example: A Figma color style named `UI/Accent` becomes:
```xml
<SolidColorBrush x:Key="UI_Accent" Color="#FF0078D4"/>
```

### Figma text styles → XAML styles

Figma text styles become `<Style TargetType="TextBlock">` resources:
```xml
<Style x:Key="Heading_Large" TargetType="{x:Type TextBlock}">
  <Setter Property="FontFamily" Value="Inter"/>
  <Setter Property="FontSize" Value="24"/>
  <Setter Property="FontWeight" Value="Bold"/>
</Style>
```

### ResourceDictionary frame

Name any top-level frame `ResourceDictionary.` to have it exported as a standalone resource dictionary XAML file (e.g. for use as a merged dictionary).

---

## 7. Images & Vectors

### Image fills

If a rectangle or frame has an **image fill**, it's exported as an `<ImageBrush>` background. The image is exported as a PNG into the `Assets/` folder in the zip.

### Standalone images

An `Image.Name` tag forces image export:
```
Image.PlayerAvatar
```
→ `<Image x:Name="PlayerAvatar" Source="Assets/PlayerAvatar.png"/>`

### Vectors / complex shapes

Figma `VECTOR`, `STAR`, `POLYGON`, and `LINE` nodes are exported as PNG images. For best results, export complex vectors as SVG by adding to the description:
```
Format=SVG
```

### Render scale

Images are exported at 2× by default. To change scale, add to the description:
```
Scale=1
Scale=3
```

---

## 8. Advanced Properties via Description

Any XAML property can be set on a node via its **description field** (right panel → Description). One property per line, `Key=Value` format.

**Example — Button with command and cursor:**
```
Command={Binding StartCommand}
CommandParameter={Binding SelectedItem}
Cursor=Hand
ToolTip=Click to start the game
IsEnabled={Binding CanStart}
```

**Example — Grid child positioning:**
```
Grid.Row=1
Grid.Column=0
Grid.ColumnSpan=2
```

**Example — Slider range:**
```
Minimum=0
Maximum=100
SmallChange=5
LargeChange=10
TickFrequency=10
IsSnapToTickEnabled=True
```

**Escape hatch — raw XAML:**

If you need to inject XAML attributes that the plugin doesn't support, add them in the description as-is. Any line that doesn't match a known property key still gets emitted as an attribute.

---

## 9. Special Prefixes

| Prefix | Effect | Example |
|---|---|---|
| `_` | Skip this layer entirely | `_Debug_Overlay` |
| `#` | Emit as XML comment | `#TODO: add animation here` |

**Skipped layers** don't appear in the XAML output at all — useful for guide layers, annotations, and dev notes.

**Comment layers** become:
```xml
<!-- TODO: add animation here -->
```

---

## 10. What Is Exported Automatically

You don't need any naming conventions for these — they just work:

| Figma Feature | XAML Output |
|---|---|
| Auto-layout vertical/horizontal | `StackPanel` with `Orientation` |
| Auto-layout padding | `Padding="L,T,R,B"` |
| Auto-layout spacing | Child `Margin` |
| Fixed width/height | `Width` / `Height` |
| Fill container (stretch) | No size attr (defaults to stretch) |
| Solid fill color | `Background="#AARRGGBB"` |
| Linear gradient fill | `<LinearGradientBrush>` |
| Radial gradient fill | `<RadialGradientBrush>` |
| Image fill | `<ImageBrush>` + PNG asset |
| Stroke color + width | `BorderBrush` + `BorderThickness` |
| Corner radius | `CornerRadius` |
| Opacity | `Opacity` |
| Drop shadow | `<DropShadowEffect>` |
| Layer blur | `<BlurEffect>` |
| Font family | `FontFamily` |
| Font size | `FontSize` |
| Font weight (bold, light, etc.) | `FontWeight` |
| Font style (italic) | `FontStyle` |
| Text color | `Foreground` |
| Text alignment | `TextAlignment` |
| Text wrapping | `TextWrapping="Wrap"` |
| Rotation | `RenderTransform` → `RotateTransform` |
| Left/right/center/stretch constraints | `HorizontalAlignment` |
| Top/bottom/center/stretch constraints | `VerticalAlignment` |
| Visibility (hidden layers are skipped) | Not emitted |

---

## 11. What Is Not Supported

These features require manual XAML work after export:

- **Animations and transitions** — Figma prototyping interactions don't map to XAML Storyboards. Use the description field to add placeholder comments describing the intended animation, then write the Storyboard in code.
- **VisualStateManager** — Must be written manually.
- **Data templates** — Must be written manually.
- **Masks** — Exported as clipped images.
- **Blend modes** (multiply, screen, etc.) — Not supported in NoesisGUI.
- **Component variants as triggers** — Each variant is exported as a separate element; you'll need to add triggers/states manually.
- **Auto-layout "wrap" mode** — Exported as `WrapPanel` (add `WrapPanel.` tag manually for now).

---

## 12. Full Example

### Figma layer tree:

```
Grid.MainHud
  description: RowDefinitions=Auto,*,Auto
               ColumnDefinitions=*

  StackPanel.TopBar
    description: Grid.Row=0
    Image.Logo
    TextBlock.ServerName
      text: {Binding ServerName}
    _DebugInfo     ← skipped

  ScrollViewer.Content
    description: Grid.Row=1
    Canvas.MapView
      Image.MapBackground
      Button.WaypointA
        TextBlock (text: A)
      Button.WaypointB
        TextBlock (text: B)

  StackPanel.BottomBar
    description: Grid.Row=2
    Slider.Volume
      description: Minimum=0
                   Maximum=100
                   Value={Binding MusicVolume}
    Button.Settings
      description: Command={Binding OpenSettingsCommand}
      TextBlock (text: ⚙)
    ProgressBar.XPBar
      description: Maximum=1000
                   Value={Binding CurrentXP}
```

### Generated XAML (simplified):

```xml
<Grid x:Name="MainHud"
      xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
      xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Grid.RowDefinitions>
    <RowDefinition Height="Auto"/>
    <RowDefinition Height="*"/>
    <RowDefinition Height="Auto"/>
  </Grid.RowDefinitions>
  <Grid.ColumnDefinitions>
    <ColumnDefinition Width="*"/>
  </Grid.ColumnDefinitions>

  <StackPanel x:Name="TopBar" Orientation="Horizontal" Grid.Row="0">
    <Image x:Name="Logo" Source="Assets/Logo.png" Width="120" Height="40"/>
    <TextBlock x:Name="ServerName" Text="{Binding ServerName}" FontSize="14"/>
  </StackPanel>

  <ScrollViewer x:Name="Content" Grid.Row="1">
    <Canvas x:Name="MapView" Width="800" Height="600">
      <Image x:Name="MapBackground" Source="Assets/MapBackground.png"
             Canvas.Left="0" Canvas.Top="0" Width="800" Height="600"/>
      <Button x:Name="WaypointA" Canvas.Left="240" Canvas.Top="180">A</Button>
      <Button x:Name="WaypointB" Canvas.Left="480" Canvas.Top="320">B</Button>
    </Canvas>
  </ScrollViewer>

  <StackPanel x:Name="BottomBar" Orientation="Horizontal" Grid.Row="2">
    <Slider x:Name="Volume" Minimum="0" Maximum="100" Value="{Binding MusicVolume}"/>
    <Button x:Name="Settings" Command="{Binding OpenSettingsCommand}">⚙</Button>
    <ProgressBar x:Name="XPBar" Maximum="1000" Value="{Binding CurrentXP}"/>
  </StackPanel>
</Grid>
```

---

*For issues or feedback, check the plugin's GitHub repository.*
