// Registry of known NoesisGUI XAML tags and their metadata

export type TagCategory = 'panel' | 'control' | 'shape' | 'display' | 'resource'

export interface TagInfo {
  tag: string              // canonical PascalCase tag name
  category: TagCategory
  selfClosing?: boolean    // true if element typically has no children
  contentProp?: string     // which prop holds text content (e.g. 'Content', 'Text')
}

const TAG_REGISTRY: TagInfo[] = [
  // Layout panels
  { tag: 'Grid',           category: 'panel' },
  { tag: 'StackPanel',     category: 'panel' },
  { tag: 'WrapPanel',      category: 'panel' },
  { tag: 'DockPanel',      category: 'panel' },
  { tag: 'Canvas',         category: 'panel' },
  { tag: 'UniformGrid',    category: 'panel' },
  { tag: 'Border',         category: 'panel' },
  { tag: 'Viewbox',        category: 'panel' },
  { tag: 'ScrollViewer',   category: 'panel' },
  { tag: 'TabControl',     category: 'panel' },
  { tag: 'TabItem',        category: 'panel', contentProp: 'Header' },

  // Input controls
  { tag: 'Button',         category: 'control', contentProp: 'Content' },
  { tag: 'RepeatButton',   category: 'control', contentProp: 'Content' },
  { tag: 'ToggleButton',   category: 'control', contentProp: 'Content' },
  { tag: 'RadioButton',    category: 'control', contentProp: 'Content' },
  { tag: 'CheckBox',       category: 'control', contentProp: 'Content' },
  { tag: 'TextBox',        category: 'control', selfClosing: true },
  { tag: 'PasswordBox',    category: 'control', selfClosing: true },
  { tag: 'Slider',         category: 'control', selfClosing: true },
  { tag: 'ComboBox',       category: 'control' },
  { tag: 'ListBox',        category: 'control' },
  { tag: 'ListView',       category: 'control' },
  { tag: 'TreeView',       category: 'control' },

  // Display
  { tag: 'TextBlock',      category: 'display', contentProp: 'Text' },
  { tag: 'Image',          category: 'display', selfClosing: true },
  { tag: 'ProgressBar',    category: 'display', selfClosing: true },
  { tag: 'MediaElement',   category: 'display', selfClosing: true },
  { tag: 'ContentControl', category: 'display' },
  { tag: 'ItemsControl',   category: 'display' },
  { tag: 'Ellipse',        category: 'shape',   selfClosing: true },
  { tag: 'Rectangle',      category: 'shape',   selfClosing: true },
  { tag: 'Line',           category: 'shape',   selfClosing: true },
  { tag: 'Path',           category: 'shape',   selfClosing: true },

  // Resource containers
  { tag: 'ResourceDictionary', category: 'resource' },
  { tag: 'UserControl',        category: 'control' },
]

// Build lookup map (lowercase key → TagInfo)
const TAG_MAP = new Map<string, TagInfo>()
for (const info of TAG_REGISTRY) {
  TAG_MAP.set(info.tag.toLowerCase(), info)
}

export function lookupTag(name: string): TagInfo | undefined {
  return TAG_MAP.get(name.toLowerCase())
}

export function isKnownTag(name: string): boolean {
  return TAG_MAP.has(name.toLowerCase())
}
