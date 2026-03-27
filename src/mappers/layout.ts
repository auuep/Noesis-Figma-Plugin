import { XamlNode, makeNode } from '../core/ir'
import { DescriptionProps } from './name-parser'

/**
 * Determine the XAML panel tag for a frame/group node and compute its layout attributes.
 */
export interface LayoutResult {
  tag: string
  attributes: Record<string, string>
  // Extra child attributes to set on each child (for Canvas.Left/Top etc.)
  // keyed by child index
  childAttrs?: Map<number, Record<string, string>>
  // Row/column definition nodes (for Grid)
  gridDefinitionNodes?: XamlNode[]
}

export function resolveLayout(
  node: FrameNode | GroupNode | ComponentNode | InstanceNode,
  forcedTag: string | undefined,
  descProps: DescriptionProps,
): LayoutResult {

  // Explicit tag overrides auto-detection
  if (forcedTag === 'Grid') return buildGridLayout(node, descProps)
  if (forcedTag === 'DockPanel') return buildDockLayout(node)
  if (forcedTag === 'WrapPanel') return buildWrapPanel(node, descProps)
  if (forcedTag === 'Canvas') return buildCanvasLayout(node)
  if (forcedTag === 'UniformGrid') return buildUniformGrid(descProps)
  if (forcedTag === 'ScrollViewer') return { tag: 'ScrollViewer', attributes: sizeAttrs(node) }
  if (forcedTag === 'Viewbox') return { tag: 'Viewbox', attributes: sizeAttrs(node) }
  if (forcedTag === 'Border') return { tag: 'Border', attributes: sizeAttrs(node) }
  if (forcedTag === 'StackPanel') return buildStackPanel(node)

  // Auto-detect from Figma layout mode
  if ('layoutMode' in node) {
    if (node.layoutMode === 'VERTICAL') return buildStackPanel(node)
    if (node.layoutMode === 'HORIZONTAL') return buildStackPanel(node)
  }

  // No layout → Canvas with absolute child positions
  return buildCanvasLayout(node)
}

function buildStackPanel(node: FrameNode | GroupNode | ComponentNode | InstanceNode): LayoutResult {
  const attrs: Record<string, string> = {}

  if ('layoutMode' in node) {
    attrs['Orientation'] = node.layoutMode === 'HORIZONTAL' ? 'Horizontal' : 'Vertical'

    // Padding → Margin (StackPanel has no Padding in Noesis)
    if ('paddingTop' in node) {
      const { paddingTop: t, paddingRight: r, paddingBottom: b, paddingLeft: l } = node as FrameNode
      if (t || r || b || l) {
        attrs['Margin'] = formatThickness(l, t, r, b)
      }
    }

    // Alignment of children
    if ('primaryAxisAlignItems' in node) {
      const align = (node as FrameNode).primaryAxisAlignItems
      if (node.layoutMode === 'HORIZONTAL') {
        attrs['VerticalAlignment'] = mapAxisAlign(align)
      } else {
        attrs['HorizontalAlignment'] = mapAxisAlign(align)
      }
    }
    if ('counterAxisAlignItems' in node) {
      const align = (node as FrameNode).counterAxisAlignItems
      if (node.layoutMode === 'HORIZONTAL') {
        attrs['VerticalAlignment'] = mapCounterAxisAlign(align)
      } else {
        attrs['HorizontalAlignment'] = mapCounterAxisAlign(align)
      }
    }
  }

  addSizeAttrs(attrs, node)
  return { tag: 'StackPanel', attributes: attrs }
}

function buildCanvasLayout(node: FrameNode | GroupNode | ComponentNode | InstanceNode): LayoutResult {
  const attrs: Record<string, string> = {}
  addSizeAttrs(attrs, node)

  // Build child position attrs using absolute coordinates
  const childAttrs = new Map<number, Record<string, string>>()
  if ('children' in node) {
    node.children.forEach((child, i) => {
      if ('x' in child && 'y' in child) {
        childAttrs.set(i, {
          'Canvas.Left': child.x.toFixed(0),
          'Canvas.Top': child.y.toFixed(0),
        })
      }
    })
  }

  return { tag: 'Canvas', attributes: attrs, childAttrs }
}

function buildGridLayout(
  node: FrameNode | GroupNode | ComponentNode | InstanceNode,
  descProps: DescriptionProps,
): LayoutResult {
  const attrs: Record<string, string> = {}
  addSizeAttrs(attrs, node)

  const definitionNodes: XamlNode[] = []

  // Parse RowDefinitions/ColumnDefinitions from description
  const rowDefs = descProps['RowDefinitions']
  const colDefs = descProps['ColumnDefinitions']

  if (rowDefs) {
    const rowNode = makeNode('Grid.RowDefinitions', {}, parseGridDefs(rowDefs, 'RowDefinition', 'Height'))
    definitionNodes.push(rowNode)
  }
  if (colDefs) {
    const colNode = makeNode('Grid.ColumnDefinitions', {}, parseGridDefs(colDefs, 'ColumnDefinition', 'Width'))
    definitionNodes.push(colNode)
  }

  return { tag: 'Grid', attributes: attrs, gridDefinitionNodes: definitionNodes }
}

function buildDockLayout(node: FrameNode | GroupNode | ComponentNode | InstanceNode): LayoutResult {
  const attrs: Record<string, string> = {}
  addSizeAttrs(attrs, node)
  return { tag: 'DockPanel', attributes: attrs }
}

function buildWrapPanel(
  node: FrameNode | GroupNode | ComponentNode | InstanceNode,
  descProps: DescriptionProps,
): LayoutResult {
  const attrs: Record<string, string> = {}
  if (descProps['Orientation']) attrs['Orientation'] = descProps['Orientation']
  if (descProps['ItemWidth']) attrs['ItemWidth'] = descProps['ItemWidth']
  if (descProps['ItemHeight']) attrs['ItemHeight'] = descProps['ItemHeight']
  addSizeAttrs(attrs, node)
  return { tag: 'WrapPanel', attributes: attrs }
}

function buildUniformGrid(descProps: DescriptionProps): LayoutResult {
  const attrs: Record<string, string> = {}
  if (descProps['Rows']) attrs['Rows'] = descProps['Rows']
  if (descProps['Columns']) attrs['Columns'] = descProps['Columns']
  return { tag: 'UniformGrid', attributes: attrs }
}

function parseGridDefs(defs: string, childTag: string, sizeProp: string): XamlNode[] {
  return defs.split(',').map(def => {
    const v = def.trim()
    return makeNode(childTag, { [sizeProp]: v || '*' })
  })
}

function sizeAttrs(node: SceneNode): Record<string, string> {
  const attrs: Record<string, string> = {}
  addSizeAttrs(attrs, node)
  return attrs
}

function addSizeAttrs(attrs: Record<string, string>, node: SceneNode): void {
  if (!('layoutSizingHorizontal' in node)) {
    if ('width' in node && node.width > 0) attrs['Width'] = node.width.toFixed(0)
    if ('height' in node && node.height > 0) attrs['Height'] = node.height.toFixed(0)
    return
  }

  const fn = node as FrameNode
  if (fn.layoutSizingHorizontal === 'FIXED') attrs['Width'] = fn.width.toFixed(0)
  if (fn.layoutSizingVertical === 'FIXED') attrs['Height'] = fn.height.toFixed(0)
}

/**
 * Compute child Margin from auto-layout item spacing.
 * Splits the spacing evenly on each side.
 */
export function computeChildMargin(
  parent: FrameNode,
  isFirst: boolean,
  isLast: boolean,
): string | undefined {
  const spacing = parent.itemSpacing ?? 0
  if (spacing <= 0) return undefined

  const half = spacing / 2
  if (parent.layoutMode === 'VERTICAL') {
    const top = isFirst ? 0 : half
    const bottom = isLast ? 0 : half
    if (top === 0 && bottom === 0) return undefined
    return formatThickness(0, top, 0, bottom)
  } else {
    const left = isFirst ? 0 : half
    const right = isLast ? 0 : half
    if (left === 0 && right === 0) return undefined
    return formatThickness(left, 0, right, 0)
  }
}

export function formatThickness(l: number, t: number, r: number, b: number): string {
  if (l === t && t === r && r === b) return l.toString()
  if (l === r && t === b) return `${l},${t}`
  return `${l},${t},${r},${b}`
}

/**
 * Map Figma alignment enums to XAML alignment values.
 */
function mapAxisAlign(align: string | undefined): string {
  switch (align) {
    case 'MIN': return 'Top'
    case 'MAX': return 'Bottom'
    case 'CENTER': return 'Center'
    case 'SPACE_BETWEEN': return 'Stretch'
    default: return 'Stretch'
  }
}

function mapCounterAxisAlign(align: string | undefined): string {
  switch (align) {
    case 'MIN': return 'Top'
    case 'MAX': return 'Bottom'
    case 'CENTER': return 'Center'
    case 'STRETCH': return 'Stretch'
    case 'BASELINE': return 'Baseline'
    default: return 'Stretch'
  }
}

/**
 * Map Figma constraints/sizing to HorizontalAlignment/VerticalAlignment.
 */
export function mapAlignment(node: SceneNode, parentHasAutoLayout: boolean): Record<string, string> {
  const attrs: Record<string, string> = {}

  if (!('constraints' in node)) return attrs

  const c = (node as FrameNode).constraints
  if (!c) return attrs

  if (!parentHasAutoLayout) {
    switch (c.horizontal) {
      case 'LEFT': attrs['HorizontalAlignment'] = 'Left'; break
      case 'RIGHT': attrs['HorizontalAlignment'] = 'Right'; break
      case 'CENTER': attrs['HorizontalAlignment'] = 'Center'; break
      case 'STRETCH': attrs['HorizontalAlignment'] = 'Stretch'; break
      case 'SCALE': attrs['HorizontalAlignment'] = 'Stretch'; break
    }
    switch (c.vertical) {
      case 'TOP': attrs['VerticalAlignment'] = 'Top'; break
      case 'BOTTOM': attrs['VerticalAlignment'] = 'Bottom'; break
      case 'CENTER': attrs['VerticalAlignment'] = 'Center'; break
      case 'STRETCH': attrs['VerticalAlignment'] = 'Stretch'; break
      case 'SCALE': attrs['VerticalAlignment'] = 'Stretch'; break
    }
  }

  return attrs
}
